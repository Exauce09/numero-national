"""Business logic for état civil — actes, déclarations, résidence, stats."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.etat_civil.enums import (
    ActStatus,
    ActType,
    DeclarationStatus,
    DeclarationType,
    ResidenceStatus,
)
from apps.api.domains.etat_civil.models import CivilAct, CivilDeclaration, ResidenceRecord
from apps.api.domains.etat_civil.schemas import (
    CivilActCreate,
    DeclarationCreate,
    DeclarationValidateRequest,
    PopulationHit,
    PopulationSearchQuery,
    ResidenceCreate,
)

logger = logging.getLogger(__name__)


def _act_number(prefix: str, commune_code: str) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    short = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{commune_code}-{stamp}-{short}"


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
    if data.act_type is None:
        raise ValueError("act_type is required")
    prefix = data.act_type.value[:3]
    number = data.act_number or _act_number(prefix, data.commune_code)
    act = CivilAct(
        act_type=data.act_type.value,
        act_number=number,
        commune_code=data.commune_code,
        status=data.status.value,
        citizen_id=data.citizen_id,
        related_citizen_ids=[str(x) for x in data.related_citizen_ids]
        if data.related_citizen_ids
        else None,
        payload=data.payload or {},
    )
    if data.status == ActStatus.VALIDATED:
        act.issued_at = datetime.now(UTC)
        act.validated_by = actor_id
    db.add(act)
    await db.commit()
    await db.refresh(act)
    return act


async def get_act(db: AsyncSession, act_id: uuid.UUID) -> CivilAct | None:
    return await db.get(CivilAct, act_id)


async def list_acts(
    db: AsyncSession,
    *,
    act_type: ActType | None = None,
    commune_code: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CivilAct]:
    stmt = select(CivilAct).order_by(CivilAct.created_at.desc())
    if act_type:
        stmt = stmt.where(CivilAct.act_type == act_type.value)
    if commune_code:
        stmt = stmt.where(CivilAct.commune_code == commune_code)
    stmt = stmt.limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


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
    *,
    citizen_id: uuid.UUID | None,
    event: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Stub: signal Core Registry status change when registry is importable."""
    result = {
        "signalled": False,
        "citizen_id": str(citizen_id) if citizen_id else None,
        "event": event,
        "payload": payload or {},
    }
    if citizen_id is None:
        return result
    try:
        # Soft dependency — do not hard-import registry services if unfinished.
        from apps.api.domains.core_registry import models as registry_models  # noqa: F401

        logger.info(
            "registry status change stub: citizen=%s event=%s", citizen_id, event
        )
        result["signalled"] = True
        result["note"] = "registry module present; status change recorded conceptually"
    except Exception as exc:  # noqa: BLE001
        result["note"] = f"registry not imported ({exc})"
        logger.info("registry signal stub: %s", result["note"])
    return result


async def validate_declaration(
    db: AsyncSession,
    declaration_id: uuid.UUID,
    body: DeclarationValidateRequest,
    *,
    actor_id: uuid.UUID | None = None,
) -> tuple[CivilDeclaration, CivilAct | None, dict[str, Any]]:
    decl = await db.get(CivilDeclaration, declaration_id)
    if decl is None:
        raise ValueError("Declaration not found")

    if body.reject:
        decl.status = DeclarationStatus.REJECTED.value
        await db.commit()
        await db.refresh(decl)
        return decl, None, {"rejected": True, "reason": body.rejection_reason}

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
        act.payload = payload
        act.status = ActStatus.VALIDATED.value
        act.issued_at = datetime.now(UTC)
        act.validated_by = actor_id
        if citizen_id:
            act.citizen_id = citizen_id
        if body.related_citizen_ids:
            act.related_citizen_ids = [str(x) for x in body.related_citizen_ids]
    else:
        act = CivilAct(
            act_type=act_type.value,
            act_number=body.act_number or _act_number(act_type.value[:3], body.commune_code),
            commune_code=body.commune_code,
            status=ActStatus.VALIDATED.value,
            citizen_id=citizen_id,
            related_citizen_ids=[str(x) for x in body.related_citizen_ids]
            if body.related_citizen_ids
            else None,
            payload=payload,
            issued_at=datetime.now(UTC),
            validated_by=actor_id,
        )
        db.add(act)
        await db.flush()
        decl.linked_act_id = act.id

    decl.status = DeclarationStatus.VALIDATED.value
    await db.commit()
    await db.refresh(decl)
    await db.refresh(act)

    registry_signal = await signal_registry_status_change(
        citizen_id=act.citizen_id,
        event="CIVIL_ACT_VALIDATED",
        payload={"act_id": str(act.id), "act_type": act.act_type},
    )
    return decl, act, registry_signal


async def create_residence(db: AsyncSession, data: ResidenceCreate) -> ResidenceRecord:
    number = data.attestation_number or _act_number("RES", data.commune_code)
    record = ResidenceRecord(
        citizen_id=data.citizen_id,
        line1=data.line1,
        line2=data.line2,
        city=data.city,
        commune_code=data.commune_code,
        province_code=data.province_code,
        country_code=data.country_code,
        attestation_number=number,
        status=data.status.value,
        notes=data.notes,
    )
    db.add(record)
    # Also create a civil act of type RESIDENCE_ATTESTATION for audit trail
    act = CivilAct(
        act_type=ActType.RESIDENCE_ATTESTATION.value,
        act_number=number,
        commune_code=data.commune_code,
        status=ActStatus.VALIDATED.value,
        citizen_id=data.citizen_id,
        payload={
            "line1": data.line1,
            "line2": data.line2,
            "city": data.city,
            "province_code": data.province_code,
            "country_code": data.country_code,
        },
        issued_at=datetime.now(UTC),
    )
    db.add(act)
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
