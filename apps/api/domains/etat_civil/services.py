"""Business logic for état civil — actes, déclarations, résidence, stats."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import String, cast, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.civil_config import NUMBERING_PATTERN
from apps.api.domains.etat_civil.enums import (
    ActStatus,
    ActType,
    DeclarationStatus,
    DeclarationType,
    ResidenceStatus,
)
from apps.api.domains.etat_civil.models import (
    ActNumberCounter,
    CivilAct,
    CivilDeclaration,
    CorrectionRequest,
    ResidenceRecord,
)
from apps.api.domains.etat_civil.schemas import (
    CivilActCreate,
    DeclarationCreate,
    DeclarationValidateRequest,
    PopulationHit,
    PopulationSearchQuery,
    ResidenceCreate,
)

logger = logging.getLogger(__name__)


def _advisory_lock_key(commune_code: str, year: int, act_type: str) -> int:
    """Stable positive int64 for pg_advisory_xact_lock."""
    raw = f"{commune_code}|{year}|{act_type}".encode()
    return int.from_bytes(raw[:8].ljust(8, b"\0"), "big", signed=False) & 0x7FFFFFFFFFFFFFFF


async def allocate_act_number(
    db: AsyncSession,
    *,
    commune_code: str,
    act_type: str,
    year: int | None = None,
) -> str:
    """Allocate next sequential number: {commune}/{year}/{seq:06d}."""
    y = year or datetime.now(UTC).year
    lock_key = _advisory_lock_key(commune_code, y, act_type)
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": lock_key})

    row = await db.scalar(
        select(ActNumberCounter)
        .where(
            ActNumberCounter.commune_code == commune_code,
            ActNumberCounter.year == y,
            ActNumberCounter.act_type == act_type,
        )
        .with_for_update()
    )
    if row is None:
        row = ActNumberCounter(
            commune_code=commune_code,
            year=y,
            act_type=act_type,
            last_seq=0,
        )
        db.add(row)
        await db.flush()

    row.last_seq = int(row.last_seq or 0) + 1
    await db.flush()
    return NUMBERING_PATTERN.format(
        commune_code=commune_code,
        year=y,
        seq=row.last_seq,
    )


async def resolve_and_enforce_bureau(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    bureau_id: uuid.UUID | None,
) -> uuid.UUID | None:
    """Auto-fill bureau from active assignment; enforce territorial scope when set."""
    from fastapi import HTTPException

    from apps.api.domains.identity.iam_services import (
        get_active_assignment_for_user,
        load_user_with_rbac,
        user_has_bureau_access,
    )

    resolved = bureau_id
    if actor_id is None:
        return resolved

    user = await load_user_with_rbac(db, actor_id)
    if user is None:
        return resolved

    if resolved is None:
        assignment = await get_active_assignment_for_user(db, user)
        if assignment is not None:
            resolved = assignment.bureau_id

    if resolved is not None and not await user_has_bureau_access(db, user, resolved):
        raise HTTPException(status_code=403, detail="Bureau hors périmètre d'affectation / scope")
    return resolved


def _attach_authentication(
    act: CivilAct,
    *,
    actor_id: uuid.UUID | None,
    officer_name: str | None = None,
    officer_matricule: str | None = None,
    seal_ref: str | None = None,
    signature_ref: str | None = None,
    at: datetime | None = None,
) -> None:
    """Cachet / signature officier — bloc immuable dans le payload à la validation."""
    now = at or datetime.now(UTC)
    payload = dict(act.payload or {})
    auth = {
        "officer_id": str(actor_id) if actor_id else None,
        "officer_name": officer_name or payload.get("officer_name") or "Officier d'état civil",
        "officer_matricule": officer_matricule or "OFFICIER_ETAT_CIVIL",
        "seal_ref": seal_ref
        or (f"SEAL-{act.bureau_id}" if act.bureau_id else f"SEAL-{act.commune_code}"),
        "signature_ref": signature_ref
        or (f"SIG-{actor_id}" if actor_id else f"SIG-{act.act_number}"),
        "authenticated_at": now.isoformat(),
        "act_version": int(act.version or 1),
    }
    payload["authentication"] = auth
    payload["officer_name"] = auth["officer_name"]
    act.payload = payload


async def search_population(
    db: AsyncSession,
    query: PopulationSearchQuery,
) -> list[PopulationHit]:
    """
    Population search stub calling conceptual citizen_reference.

    Tries Core Registry when available; otherwise returns an empty conceptual hit list.
    """
    hits: list[PopulationHit] = []
    try:
        from apps.api.domains.core_registry.models import Citizen

        stmt = select(Citizen)
        if query.family_name:
            stmt = stmt.where(Citizen.family_name.ilike(f"%{query.family_name}%"))
        if query.given_names:
            stmt = stmt.where(Citizen.given_names.ilike(f"%{query.given_names}%"))
        if query.q:
            like = f"%{query.q}%"
            stmt = stmt.where(
                (Citizen.family_name.ilike(like))
                | (Citizen.given_names.ilike(like))
                | (Citizen.nic.ilike(like))
            )
        stmt = stmt.limit(query.limit)
        rows = (await db.execute(stmt)).scalars().all()
        for c in rows:
            hits.append(
                PopulationHit(
                    citizen_id=c.id,
                    nic=c.nic,
                    given_names=c.given_names,
                    family_name=c.family_name,
                    date_of_birth=c.date_of_birth.isoformat() if c.date_of_birth else None,
                    status=c.status,
                    source="citizen_reference",
                )
            )
    except Exception as exc:  # noqa: BLE001 — soft dependency
        logger.info("citizen_reference unavailable (%s); returning stub result", exc)
        if query.q or query.family_name:
            hits.append(
                PopulationHit(
                    citizen_id=None,
                    nic=None,
                    given_names=query.given_names,
                    family_name=query.family_name or query.q,
                    date_of_birth=query.date_of_birth,
                    status="UNKNOWN",
                    source="citizen_reference_stub",
                )
            )
    return hits


async def create_act(
    db: AsyncSession,
    data: CivilActCreate,
    *,
    actor_id: uuid.UUID | None = None,
) -> CivilAct:
    from fastapi import HTTPException

    from apps.api.domains.civil_config import ACT_TYPES_DEPRECATED_WRITE, ACT_TYPES_ENABLED

    if data.act_type is None:
        raise ValueError("act_type is required")
    if data.act_type.value in ACT_TYPES_DEPRECATED_WRITE:
        raise HTTPException(
            status_code=400,
            detail=f"Act type {data.act_type.value} is not an état-civil write path (use mobility/census modules)",
        )
    if data.act_type.value not in ACT_TYPES_ENABLED:
        raise HTTPException(status_code=400, detail=f"Act type {data.act_type.value} disabled by config")

    bureau_id = await resolve_and_enforce_bureau(
        db, actor_id=actor_id, bureau_id=getattr(data, "bureau_id", None)
    )

    # SEC-01: never create already-VALIDATED acts — use /transition with civil:act:validate.
    if data.status != ActStatus.DRAFT:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail="Acts must be created as DRAFT; use POST /civil/acts/{id}/transition to validate",
        )

    number = data.act_number or await allocate_act_number(
        db, commune_code=data.commune_code, act_type=data.act_type.value
    )
    payload = dict(data.payload or {})
    # NIC national unique porté dans l'acte (jamais dans le QR brut comme PII étendu)
    national_id = payload.get("national_id") or payload.get("nic")
    if not national_id:
        national_id = f"NIC-{uuid.uuid4().hex[:12].upper()}"
        payload["national_id"] = national_id
    act = CivilAct(
        act_type=data.act_type.value,
        act_number=number,
        commune_code=data.commune_code,
        status=ActStatus.DRAFT.value,
        citizen_id=data.citizen_id,
        related_citizen_ids=[str(x) for x in data.related_citizen_ids]
        if data.related_citizen_ids
        else None,
        payload=payload,
        created_by=actor_id,
        verification_code=uuid.uuid4().hex[:16].upper(),
        bureau_id=bureau_id,
    )
    db.add(act)
    await db.flush()
    # QR = référence signée vers l'acte (pas de PII)
    try:
        from apps.api.domains.cards.qr import build_qr_payload

        qr = build_qr_payload(act.id, version=1)
        payload = dict(act.payload or {})
        payload["qr"] = qr
        payload["act_ref"] = act.act_number
        payload["national_id"] = national_id
        act.payload = payload
    except Exception as exc:  # noqa: BLE001
        logger.info("qr attach skipped: %s", exc)
    await db.commit()
    await db.refresh(act)
    return act


async def transition_act_status(
    db: AsyncSession,
    act_id: uuid.UUID,
    target_status: str,
    *,
    actor_id: uuid.UUID | None = None,
    officer_name: str | None = None,
    officer_matricule: str | None = None,
    seal_ref: str | None = None,
    signature_ref: str | None = None,
) -> CivilAct:
    from fastapi import HTTPException

    from apps.api.domains.civil_config import can_transition
    from apps.api.domains.audit.services import write_audit

    act = await get_act(db, act_id)
    if act is None or act.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Act not found")
    if not can_transition(act.status, target_status):
        raise HTTPException(
            status_code=409,
            detail=f"Illegal transition {act.status} → {target_status}",
        )

    await resolve_and_enforce_bureau(db, actor_id=actor_id, bureau_id=act.bureau_id)

    old = act.status
    act.status = target_status
    act.version = int(act.version or 1) + 1
    now = datetime.now(UTC)
    if target_status == ActStatus.VALIDATED.value:
        act.issued_at = now
        act.validated_by = actor_id
        act.registered_at = now
        # Enrich officer name from user profile when omitted.
        name = officer_name
        if name is None and actor_id is not None:
            from apps.api.domains.identity.iam_services import load_user_with_rbac

            user = await load_user_with_rbac(db, actor_id)
            if user is not None:
                name = user.full_name
        _attach_authentication(
            act,
            actor_id=actor_id,
            officer_name=name,
            officer_matricule=officer_matricule,
            seal_ref=seal_ref,
            signature_ref=signature_ref,
            at=now,
        )
        registry_result = await apply_registry_on_validation(
            db, act, actor_id=actor_id, at=now
        )
    else:
        registry_result = None
    if target_status == ActStatus.ARCHIVED.value:
        act.archived_at = now
    await write_audit(
        db,
        action="civil.act.transition",
        actor_id=actor_id,
        resource_type="civil_act",
        resource_id=str(act.id),
        old_value={"status": old},
        new_value={
            "status": target_status,
            "authenticated": target_status == ActStatus.VALIDATED.value,
            "registry": registry_result,
        },
        commit=False,
    )
    await db.commit()
    await db.refresh(act)
    return act


async def soft_delete_act(
    db: AsyncSession, act_id: uuid.UUID, *, actor_id: uuid.UUID | None = None
) -> CivilAct:
    from fastapi import HTTPException

    from apps.api.domains.audit.services import write_audit

    act = await get_act(db, act_id)
    if act is None or act.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Act not found")
    if act.status == ActStatus.VALIDATED.value:
        raise HTTPException(
            status_code=403,
            detail="Validated acts cannot be deleted; archive or rectify instead",
        )
    await resolve_and_enforce_bureau(db, actor_id=actor_id, bureau_id=act.bureau_id)
    act.deleted_at = datetime.now(UTC)
    await write_audit(
        db,
        action="civil.act.soft_delete",
        actor_id=actor_id,
        resource_type="civil_act",
        resource_id=str(act.id),
        commit=False,
    )
    await db.commit()
    await db.refresh(act)
    return act


async def add_mention(
    db: AsyncSession,
    *,
    target_act_id: uuid.UUID,
    mention_type: str,
    source_act_id: uuid.UUID | None = None,
    authority: str | None = None,
    reference: str | None = None,
    justificatif: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> Any:
    from datetime import date as date_cls

    from fastapi import HTTPException

    from apps.api.domains.audit.services import write_audit
    from apps.api.domains.etat_civil.models import Mention

    target = await get_act(db, target_act_id)
    if target is None or target.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Target act not found")
    if target.status not in {ActStatus.VALIDATED.value, ActStatus.ARCHIVED.value}:
        raise HTTPException(status_code=409, detail="Mentions only on validated/archived acts")
    await resolve_and_enforce_bureau(db, actor_id=actor_id, bureau_id=target.bureau_id)
    row = Mention(
        target_act_id=target_act_id,
        mention_type=mention_type,
        source_act_id=source_act_id,
        authority=authority,
        mention_date=date_cls.today(),
        reference=reference,
        justificatif=justificatif,
        created_by=actor_id,
    )
    db.add(row)
    await db.flush()
    await write_audit(
        db,
        action="civil.mention.add",
        actor_id=actor_id,
        resource_type="mention",
        resource_id=str(row.id),
        new_value={"target_act_id": str(target_act_id), "mention_type": mention_type},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def create_filiation(
    db: AsyncSession,
    *,
    relation_type: str,
    parent_citizen_id: uuid.UUID | None = None,
    child_citizen_id: uuid.UUID | None = None,
    parent_label: str | None = None,
    child_label: str | None = None,
    act_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
) -> Any:
    from apps.api.domains.audit.services import write_audit
    from apps.api.domains.etat_civil.models import Filiation

    row = Filiation(
        relation_type=relation_type,
        parent_citizen_id=parent_citizen_id,
        child_citizen_id=child_citizen_id,
        parent_label=parent_label,
        child_label=child_label,
        act_id=act_id,
        source="ACT",
        status="ACTIVE",
    )
    db.add(row)
    await db.flush()
    await write_audit(
        db,
        action="civil.filiation.create",
        actor_id=actor_id,
        resource_type="filiation",
        resource_id=str(row.id),
        new_value={"relation_type": relation_type},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def create_transcription(
    db: AsyncSession,
    *,
    source_act_ref: str,
    source_place: str | None = None,
    source_authority: str | None = None,
    source_date: str | None = None,
    source_number: str | None = None,
    bureau_id: uuid.UUID | None = None,
    citizen_id: uuid.UUID | None = None,
    resulting_act_id: uuid.UUID | None = None,
    status: str = "REGISTERED",
    actor_id: uuid.UUID | None = None,
) -> Any:
    from datetime import date as date_cls

    from fastapi import HTTPException

    from apps.api.domains.audit.services import write_audit
    from apps.api.domains.etat_civil.models import Transcription

    resolved_bureau = await resolve_and_enforce_bureau(db, actor_id=actor_id, bureau_id=bureau_id)
    parsed_date = None
    if source_date:
        try:
            parsed_date = date_cls.fromisoformat(source_date[:10])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="source_date must be YYYY-MM-DD") from exc

    if resulting_act_id is not None:
        target = await get_act(db, resulting_act_id)
        if target is None or target.deleted_at is not None:
            raise HTTPException(status_code=404, detail="resulting_act_id not found")

    row = Transcription(
        source_act_ref=source_act_ref,
        source_place=source_place,
        source_authority=source_authority,
        source_date=parsed_date,
        source_number=source_number,
        bureau_id=resolved_bureau,
        citizen_id=citizen_id,
        resulting_act_id=resulting_act_id,
        status=status or "REGISTERED",
        created_by=actor_id,
    )
    db.add(row)
    await db.flush()
    await write_audit(
        db,
        action="civil.transcription.create",
        actor_id=actor_id,
        resource_type="transcription",
        resource_id=str(row.id),
        new_value={"source_act_ref": source_act_ref, "bureau_id": str(resolved_bureau) if resolved_bureau else None},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def list_mentions_for_act(db: AsyncSession, act_id: uuid.UUID) -> list[Any]:
    from apps.api.domains.etat_civil.models import Mention

    stmt = (
        select(Mention)
        .where(Mention.target_act_id == act_id)
        .order_by(Mention.created_at.asc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_official_extract(db: AsyncSession, act_id: uuid.UUID) -> dict[str, Any]:
    from fastapi import HTTPException

    act = await get_act(db, act_id)
    if act is None or act.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Act not found")
    mentions = await list_mentions_for_act(db, act_id)
    payload = dict(act.payload or {})
    qr = payload.get("qr") if isinstance(payload.get("qr"), dict) else None
    authentication = payload.get("authentication") if isinstance(payload.get("authentication"), dict) else None
    return {
        "act": act,
        "mentions": mentions,
        "verification_code": act.verification_code,
        "qr": qr,
        "authentication": authentication,
        "conservation": {
            "status": act.status,
            "version": int(act.version or 1),
            "registered_at": act.registered_at.isoformat() if act.registered_at else None,
            "archived_at": act.archived_at.isoformat() if act.archived_at else None,
            "deleted": act.deleted_at is not None,
            "immutable_when_validated": act.status
            in {ActStatus.VALIDATED.value, ActStatus.ARCHIVED.value},
        },
    }


async def person_civil_history(db: AsyncSession, citizen_id: uuid.UUID) -> list[dict[str, Any]]:
    """Chronologie dérivée des actes (pas un champ texte manuel)."""
    stmt = (
        select(CivilAct)
        .where(CivilAct.citizen_id == citizen_id, CivilAct.deleted_at.is_(None))
        .order_by(CivilAct.created_at.asc())
    )
    acts = list((await db.execute(stmt)).scalars().all())
    # Related parties stored in JSONB — filter in Python for portability.
    extra = list(
        (
            await db.execute(
                select(CivilAct).where(CivilAct.deleted_at.is_(None)).limit(500)
            )
        ).scalars().all()
    )
    cid = str(citizen_id)
    related = [
        a
        for a in extra
        if a.related_citizen_ids and cid in [str(x) for x in (a.related_citizen_ids or [])]
    ]
    seen: set[uuid.UUID] = set()
    events: list[dict[str, Any]] = []
    for act in acts + related:
        if act.id in seen:
            continue
        seen.add(act.id)
        events.append(
            {
                "at": act.issued_at or act.created_at,
                "act_type": act.act_type,
                "act_number": act.act_number,
                "status": act.status,
                "act_id": str(act.id),
            }
        )
    events.sort(key=lambda e: e["at"] or datetime.min.replace(tzinfo=UTC))
    return events


async def verify_document_code(db: AsyncSession, code: str) -> dict[str, Any]:
    """Public verification — minimal disclosure."""
    act = await db.scalar(
        select(CivilAct).where(
            CivilAct.verification_code == code.upper().strip(),
            CivilAct.deleted_at.is_(None),
        )
    )
    if act is None or act.status not in {ActStatus.VALIDATED.value, ActStatus.ARCHIVED.value}:
        return {"status": "DOCUMENT_INVALIDE"}
    mentions = await list_mentions_for_act(db, act.id)
    payload = dict(act.payload or {})
    auth = payload.get("authentication") if isinstance(payload.get("authentication"), dict) else {}
    return {
        "status": "DOCUMENT_VALIDE",
        "act_type": act.act_type,
        "act_number": act.act_number,
        "commune_code": act.commune_code,
        "issued_at": act.issued_at.isoformat() if act.issued_at else None,
        "mentions_count": len(mentions),
        "authenticated": bool(auth),
        "officer_matricule": auth.get("officer_matricule"),
        "seal_ref": auth.get("seal_ref"),
    }


async def get_act(db: AsyncSession, act_id: uuid.UUID) -> CivilAct | None:
    act = await db.get(CivilAct, act_id)
    if act is None or act.deleted_at is not None:
        return None
    return act


async def get_act_for_actor(
    db: AsyncSession,
    act_id: uuid.UUID,
    *,
    actor_id: uuid.UUID | None = None,
) -> CivilAct | None:
    """Fetch act with bureau scope enforcement for non-national actors."""
    from fastapi import HTTPException

    act = await get_act(db, act_id)
    if act is None:
        return None
    if actor_id is None:
        return act
    try:
        await resolve_and_enforce_bureau(db, actor_id=actor_id, bureau_id=act.bureau_id)
    except HTTPException:
        return None
    return act


async def list_acts(
    db: AsyncSession,
    *,
    act_type: ActType | None = None,
    commune_code: str | None = None,
    bureau_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CivilAct]:
    stmt = (
        select(CivilAct)
        .where(CivilAct.deleted_at.is_(None))
        .order_by(CivilAct.created_at.desc())
    )
    if act_type:
        stmt = stmt.where(CivilAct.act_type == act_type.value)
    if commune_code:
        stmt = stmt.where(CivilAct.commune_code == commune_code)
    if bureau_id is not None:
        stmt = stmt.where(CivilAct.bureau_id == bureau_id)
    elif actor_id is not None:
        # Scope list to bureaux the actor can access (national roles see all).
        from apps.api.domains.identity.iam_services import load_user_with_rbac, user_role_codes

        user = await load_user_with_rbac(db, actor_id)
        if user is not None:
            roles = user_role_codes(user)
            if not (roles & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN", "ADMIN_NATIONAL"}):
                allowed = await _actor_bureau_ids(db, user)
                if allowed is not None:
                    stmt = stmt.where(CivilAct.bureau_id.in_(allowed))
    stmt = stmt.limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def _actor_bureau_ids(db: AsyncSession, user) -> list[uuid.UUID] | None:
    """Return explicit bureau IDs for scoped users, or None if unrestricted."""
    from apps.api.domains.identity.iam_services import (
        get_active_assignment_for_user,
        list_scopes,
        user_role_codes,
    )
    from apps.api.domains.identity.models import BureauEtatCivil

    roles = user_role_codes(user)
    if roles & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN", "ADMIN_NATIONAL"}:
        return None
    ids: set[uuid.UUID] = set()
    scopes = await list_scopes(db, user.id)
    for s in scopes:
        if s.scope_type == "NATIONAL":
            return None
        if s.bureau_id:
            ids.add(s.bureau_id)
        if s.scope_type == "PROVINCE" and s.territory_id:
            rows = await db.execute(
                select(BureauEtatCivil.id).where(BureauEtatCivil.province_id == s.territory_id)
            )
            ids.update(rows.scalars().all())
        if s.scope_type == "VILLE" and s.territory_id:
            rows = await db.execute(
                select(BureauEtatCivil.id).where(BureauEtatCivil.ville_id == s.territory_id)
            )
            ids.update(rows.scalars().all())
        if s.scope_type == "COMMUNE" and s.territory_id:
            rows = await db.execute(
                select(BureauEtatCivil.id).where(BureauEtatCivil.commune_id == s.territory_id)
            )
            ids.update(rows.scalars().all())
    assignment = await get_active_assignment_for_user(db, user)
    if assignment and assignment.bureau_id:
        ids.add(assignment.bureau_id)
    if user.province_id or user.ville_id or user.commune_id:
        q = select(BureauEtatCivil.id)
        if user.commune_id:
            q = q.where(BureauEtatCivil.commune_id == user.commune_id)
        elif user.ville_id:
            q = q.where(BureauEtatCivil.ville_id == user.ville_id)
        elif user.province_id:
            q = q.where(BureauEtatCivil.province_id == user.province_id)
        rows = await db.execute(q)
        ids.update(rows.scalars().all())
    return list(ids) if ids else []


async def list_declarations(
    db: AsyncSession,
    *,
    status: str | None = None,
    declaration_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CivilDeclaration]:
    stmt = select(CivilDeclaration).order_by(CivilDeclaration.created_at.desc())
    if status:
        stmt = stmt.where(CivilDeclaration.status == status)
    if declaration_type:
        stmt = stmt.where(CivilDeclaration.declaration_type == declaration_type)
    stmt = stmt.limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def create_declaration(
    db: AsyncSession,
    data: DeclarationCreate,
) -> tuple[CivilDeclaration, dict[str, Any]]:
    """Receive hospital/commune declaration and emit notification workflow status."""
    decl = CivilDeclaration(
        source=data.source.value,
        declaration_type=data.declaration_type.value,
        payload=data.payload or {},
        status=DeclarationStatus.PENDING_OFFICER.value,
    )
    db.add(decl)
    await db.commit()
    await db.refresh(decl)

    notification = {
        "channel": "civil_officer_queue",
        "event": "DECLARATION_RECEIVED",
        "declaration_id": str(decl.id),
        "declaration_type": decl.declaration_type,
        "status": decl.status,
        "message": "Déclaration transmise à l'officier d'état civil",
    }
    # Soft notify if notifications domain exists
    try:
        from apps.api.domains.notifications import service as notif_service  # type: ignore

        if hasattr(notif_service, "emit"):
            await notif_service.emit(notification)
    except Exception:  # noqa: BLE001
        logger.debug("notifications domain not available; status recorded only")

    return decl, notification


async def signal_registry_status_change(
    db: AsyncSession,
    *,
    citizen_id: uuid.UUID | None,
    event: str,
    payload: dict[str, Any] | None = None,
    actor_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Apply Core Registry status change (DECEASED / STATUS_CHANGED) when possible."""
    result: dict[str, Any] = {
        "signalled": False,
        "citizen_id": str(citizen_id) if citizen_id else None,
        "event": event,
        "payload": payload or {},
    }
    if citizen_id is None:
        result["note"] = "no citizen_id"
        return result
    try:
        from apps.api.domains.core_registry.enums import CitizenEventType, CitizenStatus
        from apps.api.domains.core_registry.models import Citizen, CitizenHistory

        citizen = await db.get(Citizen, citizen_id)
        if citizen is None:
            result["note"] = "citizen not found"
            return result

        now = datetime.now(UTC)
        old_status = citizen.status
        if event in {"CIVIL_DEATH_VALIDATED", "DEATH"}:
            citizen.status = CitizenStatus.DECEASED.value
            citizen.deceased_at = now
            citizen.updated_at = now
            db.add(
                CitizenHistory(
                    citizen_id=citizen.id,
                    event_type=CitizenEventType.STATUS_CHANGED.value,
                    payload={
                        "old_status": old_status,
                        "new_status": CitizenStatus.DECEASED.value,
                        "source": "etat_civil",
                        "event": event,
                        **(payload or {}),
                    },
                    actor_id=actor_id,
                    created_at=now,
                )
            )
            result["signalled"] = True
            result["new_status"] = CitizenStatus.DECEASED.value
        else:
            db.add(
                CitizenHistory(
                    citizen_id=citizen.id,
                    event_type=CitizenEventType.STATUS_CHANGED.value,
                    payload={
                        "old_status": old_status,
                        "event": event,
                        "source": "etat_civil",
                        **(payload or {}),
                    },
                    actor_id=actor_id,
                    created_at=now,
                )
            )
            result["signalled"] = True
            result["note"] = "history recorded"
        await db.flush()
    except Exception as exc:  # noqa: BLE001
        result["note"] = f"registry signal failed ({exc})"
        logger.info("registry signal: %s", result["note"])
    return result


def _payload_str(payload: dict[str, Any], *keys: str) -> str | None:
    for k in keys:
        v = payload.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


def _parse_birth_date(payload: dict[str, Any]) -> Any:
    from datetime import date as date_cls

    raw = _payload_str(payload, "date_of_birth", "date_naissance", "child_dob")
    if not raw:
        return None
    try:
        return date_cls.fromisoformat(raw[:10])
    except ValueError:
        return None


def _map_sex(raw: str | None) -> str:
    from apps.api.domains.core_registry.enums import Sex

    if not raw:
        return Sex.UNKNOWN.value
    key = raw.strip().upper()
    if key in {"M", "MALE", "H", "HOMME", "GARCON", "GARÇON"}:
        return Sex.MALE.value
    if key in {"F", "FEMALE", "FEMME", "FILLE"}:
        return Sex.FEMALE.value
    return Sex.UNKNOWN.value


async def apply_registry_on_validation(
    db: AsyncSession,
    act: CivilAct,
    *,
    actor_id: uuid.UUID | None = None,
    at: datetime | None = None,
) -> dict[str, Any]:
    """On VALIDATED BIRTH create/link citizen; on VALIDATED DEATH mark deceased."""
    now = at or datetime.now(UTC)
    payload = dict(act.payload or {})
    result: dict[str, Any] = {"act_type": act.act_type, "action": None}

    if act.act_type == ActType.BIRTH.value:
        if act.citizen_id is not None:
            result["action"] = "linked_existing"
            result["citizen_id"] = str(act.citizen_id)
            await signal_registry_status_change(
                db,
                citizen_id=act.citizen_id,
                event="CIVIL_BIRTH_VALIDATED",
                payload={"act_id": str(act.id), "act_number": act.act_number},
                actor_id=actor_id,
            )
            return result

        family_name = _payload_str(
            payload, "child_family_name", "child_nom", "nom", "family_name"
        )
        given_names = _payload_str(
            payload, "child_given_names", "child_prenom", "prenom", "given_names"
        )
        dob = _parse_birth_date(payload)
        if not family_name or not given_names or dob is None:
            result["action"] = "skipped"
            result["note"] = "missing birth identity fields for citizen create"
            return result

        try:
            from apps.api.domains.core_registry.duplicate_service import (
                check_and_record_duplicates,
            )
            from apps.api.domains.core_registry.enums import CitizenEventType, CitizenStatus
            from apps.api.domains.core_registry.models import Citizen, CitizenHistory

            sex = _map_sex(_payload_str(payload, "sex", "sexe"))
            place = _payload_str(
                payload, "place_of_birth", "lieu_naissance", "lieu_etat_civil"
            )
            citizen = Citizen(
                status=CitizenStatus.DRAFT.value,
                nic=None,
                sex=sex,
                date_of_birth=dob,
                place_of_birth=place,
                nationality="COD",
                given_names=given_names,
                family_name=family_name,
                created_at=now,
                updated_at=now,
            )
            db.add(citizen)
            await db.flush()
            db.add(
                CitizenHistory(
                    citizen_id=citizen.id,
                    event_type=CitizenEventType.CREATED.value,
                    payload={
                        "status": CitizenStatus.DRAFT.value,
                        "source": "etat_civil.birth",
                        "act_id": str(act.id),
                        "act_number": act.act_number,
                    },
                    actor_id=actor_id,
                    created_at=now,
                )
            )
            try:
                await check_and_record_duplicates(db, citizen)
            except Exception as exc:  # noqa: BLE001
                logger.info("birth duplicate check skipped: %s", exc)

            act.citizen_id = citizen.id
            nic_assigned: str | None = None
            try:
                from apps.api.domains.core_registry.nic_service import (
                    NicGenerationError,
                    assign_nic,
                )

                nic_assigned = await assign_nic(db, citizen=citizen, actor_id=actor_id)
            except Exception as nic_exc:  # noqa: BLE001 — duplicates / generation
                logger.info("NIC assign deferred for birth citizen %s: %s", citizen.id, nic_exc)
                result["nic_note"] = str(nic_exc)

            payload["citizen_id"] = str(citizen.id)
            if nic_assigned:
                payload["nic"] = nic_assigned
                payload["national_id"] = nic_assigned
            act.payload = payload
            result["action"] = "created_citizen"
            result["citizen_id"] = str(citizen.id)
            if nic_assigned:
                result["nic"] = nic_assigned
        except Exception as exc:  # noqa: BLE001
            result["action"] = "error"
            result["note"] = str(exc)
            logger.exception("birth registry coupling failed")
        return result

    if act.act_type == ActType.DEATH.value:
        citizen_id = act.citizen_id
        if citizen_id is None:
            raw = _payload_str(payload, "citizen_id")
            if raw:
                try:
                    citizen_id = uuid.UUID(raw)
                except ValueError:
                    citizen_id = None
        signal = await signal_registry_status_change(
            db,
            citizen_id=citizen_id,
            event="CIVIL_DEATH_VALIDATED",
            payload={"act_id": str(act.id), "act_number": act.act_number},
            actor_id=actor_id,
        )
        result["action"] = "mark_deceased"
        result.update(signal)
        return result

    result["action"] = "noop"
    return result


async def search_acts(
    db: AsyncSession,
    *,
    q: str | None = None,
    act_type: str | None = None,
    status_filter: str | None = None,
    commune_code: str | None = None,
    actor_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CivilAct]:
    """Bureau-scoped act search for officers."""
    stmt = (
        select(CivilAct)
        .where(CivilAct.deleted_at.is_(None))
        .order_by(CivilAct.created_at.desc())
    )
    if act_type:
        stmt = stmt.where(CivilAct.act_type == act_type.upper())
    if status_filter:
        stmt = stmt.where(CivilAct.status == status_filter.upper())
    if commune_code:
        stmt = stmt.where(CivilAct.commune_code == commune_code)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                CivilAct.act_number.ilike(like),
                CivilAct.verification_code.ilike(like),
                CivilAct.commune_code.ilike(like),
                cast(CivilAct.payload, String).ilike(like),
            )
        )
    if actor_id is not None:
        from apps.api.domains.identity.iam_services import load_user_with_rbac, user_role_codes

        user = await load_user_with_rbac(db, actor_id)
        if user is not None:
            roles = user_role_codes(user)
            if not (roles & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN", "ADMIN_NATIONAL"}):
                allowed = await _actor_bureau_ids(db, user)
                if allowed is not None:
                    stmt = stmt.where(CivilAct.bureau_id.in_(allowed))
    stmt = stmt.limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def list_correction_requests(
    db: AsyncSession,
    *,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CorrectionRequest]:
    stmt = select(CorrectionRequest).order_by(CorrectionRequest.created_at.desc())
    if status_filter:
        stmt = stmt.where(CorrectionRequest.status == status_filter.upper())
    stmt = stmt.limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def review_correction_request(
    db: AsyncSession,
    request_id: uuid.UUID,
    *,
    approve: bool,
    review_note: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> CorrectionRequest:
    from datetime import date as date_cls

    from fastapi import HTTPException

    from apps.api.domains.audit.services import write_audit

    row = await db.get(CorrectionRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Correction request not found")
    if row.status not in {"SUBMITTED", "PENDING"}:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot review request in status {row.status}",
        )

    applied: dict[str, Any] = {}
    if approve:
        allowed = {
            "given_names",
            "family_name",
            "place_of_birth",
            "nationality",
            "sex",
            "date_of_birth",
        }
        field = (row.field_name or "").strip().lower()
        # Accept French aliases from citizen portal
        aliases = {
            "prenom": "given_names",
            "prénom": "given_names",
            "nom": "family_name",
            "lieu_naissance": "place_of_birth",
            "lieu_de_naissance": "place_of_birth",
            "sexe": "sex",
            "date_naissance": "date_of_birth",
            "nationalite": "nationality",
            "nationalité": "nationality",
        }
        field = aliases.get(field, field)
        if field not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Field '{row.field_name}' cannot be corrected via this workflow",
            )
        try:
            from apps.api.domains.core_registry.enums import CitizenEventType
            from apps.api.domains.core_registry.models import Citizen, CitizenHistory

            citizen = await db.get(Citizen, row.citizen_id)
            if citizen is None:
                raise HTTPException(status_code=404, detail="Citizen not found for correction")
            old_val = getattr(citizen, field, None)
            new_val: Any = row.requested_value
            if field == "date_of_birth":
                new_val = date_cls.fromisoformat(str(row.requested_value).strip()[:10])
            elif field == "sex":
                new_val = _map_sex(str(row.requested_value))
            setattr(citizen, field, new_val)
            citizen.updated_at = datetime.now(UTC)
            db.add(
                CitizenHistory(
                    citizen_id=citizen.id,
                    event_type=CitizenEventType.STATUS_CHANGED.value,
                    payload={
                        "source": "etat_civil.correction",
                        "field": field,
                        "old_value": str(old_val) if old_val is not None else None,
                        "new_value": str(new_val),
                        "correction_request_id": str(row.id),
                    },
                    actor_id=actor_id,
                    created_at=datetime.now(UTC),
                )
            )
            applied = {"field": field, "old": str(old_val) if old_val is not None else None, "new": str(new_val)}
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"Cannot apply correction: {exc}") from exc

    row.status = "APPROVED" if approve else "REJECTED"
    row.reviewed_by = actor_id
    row.reviewed_at = datetime.now(UTC)
    row.review_note = review_note
    await write_audit(
        db,
        action="civil.correction.approve" if approve else "civil.correction.reject",
        actor_id=actor_id,
        resource_type="correction_request",
        resource_id=str(row.id),
        new_value={"status": row.status, "review_note": review_note, "applied": applied},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def validate_declaration(
    db: AsyncSession,
    declaration_id: uuid.UUID,
    body: DeclarationValidateRequest,
    *,
    actor_id: uuid.UUID | None = None,
) -> tuple[CivilDeclaration, CivilAct | None, dict[str, Any]]:
    """Accept/reject a declaration.

    SEC-02: never jump an act to VALIDATED here — create/link a DRAFT act and
    require POST /civil/acts/{id}/transition (cachet / workflow / audit).
    """
    from fastapi import HTTPException

    from apps.api.domains.audit.services import write_audit

    decl = await db.get(CivilDeclaration, declaration_id)
    if decl is None:
        raise ValueError("Declaration not found")

    if body.reject:
        decl.status = DeclarationStatus.REJECTED.value
        await write_audit(
            db,
            action="civil.declaration.reject",
            actor_id=actor_id,
            resource_type="civil_declaration",
            resource_id=str(decl.id),
            new_value={"reason": body.rejection_reason},
            commit=False,
        )
        await db.commit()
        await db.refresh(decl)
        return decl, None, {"rejected": True, "reason": body.rejection_reason}

    bureau_id = await resolve_and_enforce_bureau(
        db, actor_id=actor_id, bureau_id=getattr(body, "bureau_id", None)
    )

    act_type = (
        ActType.BIRTH
        if decl.declaration_type == DeclarationType.BIRTH.value
        else ActType.DEATH
    )
    payload = {**(decl.payload or {}), **(body.payload_overrides or {})}
    citizen_id = body.citizen_id
    if citizen_id is None and isinstance(payload.get("citizen_id"), str):
        try:
            citizen_id = uuid.UUID(payload["citizen_id"])
        except ValueError:
            citizen_id = None

    if decl.linked_act_id:
        act = await db.get(CivilAct, decl.linked_act_id)
        if act is None:
            raise ValueError("Linked act missing")
        if act.status == ActStatus.VALIDATED.value:
            raise HTTPException(
                status_code=409,
                detail="Linked act already validated; use rectification workflow",
            )
        act.payload = payload
        if citizen_id:
            act.citizen_id = citizen_id
        if body.related_citizen_ids:
            act.related_citizen_ids = [str(x) for x in body.related_citizen_ids]
        if bureau_id:
            act.bureau_id = bureau_id
        if act.status == ActStatus.DRAFT.value:
            act.status = ActStatus.SUBMITTED.value
    else:
        act = CivilAct(
            act_type=act_type.value,
            act_number=body.act_number
            or await allocate_act_number(
                db, commune_code=body.commune_code, act_type=act_type.value
            ),
            commune_code=body.commune_code,
            status=ActStatus.DRAFT.value,
            citizen_id=citizen_id,
            related_citizen_ids=[str(x) for x in body.related_citizen_ids]
            if body.related_citizen_ids
            else None,
            payload=payload,
            created_by=actor_id,
            bureau_id=bureau_id,
            verification_code=uuid.uuid4().hex[:16].upper(),
        )
        db.add(act)
        await db.flush()
        decl.linked_act_id = act.id

    decl.status = DeclarationStatus.VALIDATED.value
    await write_audit(
        db,
        action="civil.declaration.accept",
        actor_id=actor_id,
        resource_type="civil_declaration",
        resource_id=str(decl.id),
        new_value={
            "linked_act_id": str(act.id),
            "act_status": act.status,
            "bureau_id": str(bureau_id) if bureau_id else None,
        },
        commit=False,
    )
    registry_signal = await signal_registry_status_change(
        db,
        citizen_id=act.citizen_id,
        event="CIVIL_DECLARATION_ACCEPTED",
        payload={"act_id": str(act.id), "act_type": act.act_type, "act_status": act.status},
        actor_id=actor_id,
    )
    await db.commit()
    await db.refresh(decl)
    await db.refresh(act)
    return decl, act, registry_signal


async def create_residence(
    db: AsyncSession,
    data: ResidenceCreate,
    *,
    actor_id: uuid.UUID | None = None,
) -> ResidenceRecord:
    bureau_id = await resolve_and_enforce_bureau(
        db, actor_id=actor_id, bureau_id=getattr(data, "bureau_id", None)
    )
    # Residence attestation starts DRAFT; activate record only after act validation.
    record_status = (
        ResidenceStatus.DRAFT.value
        if data.status == ResidenceStatus.ACTIVE
        else data.status.value
    )
    number = data.attestation_number or await allocate_act_number(
        db,
        commune_code=data.commune_code,
        act_type=ActType.RESIDENCE_ATTESTATION.value,
    )
    record = ResidenceRecord(
        citizen_id=data.citizen_id,
        line1=data.line1,
        line2=data.line2,
        city=data.city,
        commune_code=data.commune_code,
        province_code=data.province_code,
        country_code=data.country_code,
        attestation_number=number,
        status=record_status,
        notes=data.notes,
    )
    db.add(record)
    # Audit trail act — DRAFT only (SEC-01); validate via /transition.
    act = CivilAct(
        act_type=ActType.RESIDENCE_ATTESTATION.value,
        act_number=number,
        commune_code=data.commune_code,
        status=ActStatus.DRAFT.value,
        citizen_id=data.citizen_id,
        created_by=actor_id,
        bureau_id=bureau_id,
        verification_code=uuid.uuid4().hex[:16].upper(),
        payload={
            "line1": data.line1,
            "line2": data.line2,
            "city": data.city,
            "province_code": data.province_code,
            "country_code": data.country_code,
            "residence_record_id": None,
        },
    )
    db.add(act)
    await db.flush()
    payload = dict(act.payload or {})
    payload["residence_record_id"] = str(record.id)
    act.payload = payload
    await db.commit()
    await db.refresh(record)
    return record


async def list_residence(
    db: AsyncSession,
    *,
    citizen_id: uuid.UUID | None = None,
    commune_code: str | None = None,
    limit: int = 50,
) -> list[ResidenceRecord]:
    stmt = select(ResidenceRecord).order_by(ResidenceRecord.created_at.desc()).limit(limit)
    if citizen_id:
        stmt = stmt.where(ResidenceRecord.citizen_id == citizen_id)
    if commune_code:
        stmt = stmt.where(ResidenceRecord.commune_code == commune_code)
    return list((await db.execute(stmt)).scalars().all())


async def stats_by_act_type(db: AsyncSession, commune_code: str) -> dict[str, Any]:
    stmt = (
        select(CivilAct.act_type, func.count())
        .where(CivilAct.commune_code == commune_code)
        .group_by(CivilAct.act_type)
    )
    rows = (await db.execute(stmt)).all()
    counts = {act_type: int(count) for act_type, count in rows}
    for t in ActType:
        counts.setdefault(t.value, 0)
    return {
        "commune_code": commune_code,
        "counts": counts,
        "total": sum(counts.values()),
    }


async def attach_document_to_act(
    db: AsyncSession,
    act_id: uuid.UUID,
    *,
    document_type: str,
    institution_id: uuid.UUID | None,
    citizen_id: uuid.UUID | None,
    content: bytes,
) -> Any:
    """Integrate with documents domain service."""
    act = await db.get(CivilAct, act_id)
    if act is None:
        raise ValueError("Act not found")
    from apps.api.domains.documents.services import create_document

    doc = await create_document(
        db,
        document_type=document_type,
        institution_id=institution_id,
        citizen_id=citizen_id or act.citizen_id,
        content=content,
        extra_meta={"civil_act_id": str(act.id), "act_type": act.act_type},
    )
    payload = dict(act.payload or {})
    docs = list(payload.get("document_ids") or [])
    docs.append(str(doc.document_id))
    payload["document_ids"] = docs
    act.payload = payload
    await db.commit()
    return doc
