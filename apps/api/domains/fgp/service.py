"""Module 5 FGP — santé, événements idempotents, filiation, rectification (sur core_registry)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.core_registry.enums import CitizenEventType, RelationType
from apps.api.domains.core_registry.models import (
    Citizen,
    CitizenHistory,
    DuplicateCandidate,
    FamilyRelation,
)
from apps.api.domains.core_registry.enums import DuplicateStatus
from apps.api.domains.fgp.schemas import (
    FgpCatalogOut,
    FgpCorrectionIn,
    FgpCorrectionOut,
    FgpEventIn,
    FgpEventOut,
    FgpHealthOut,
    FgpRelationIn,
    FgpRelationOut,
)


def fgp_catalog() -> FgpCatalogOut:
    return FgpCatalogOut(
        note=(
            "Le FGP est le référentiel central (core_registry). "
            "Aucun NIN n'est inventé ici ; attribution uniquement via service NIN autorisé. "
            "Pas de fusion automatique."
        ),
        endpoints={
            "health": "GET /api/v1/fgp/health",
            "catalog": "GET /api/v1/fgp/catalog",
            "search": "GET /api/v1/fgp/persons",
            "person": "GET /api/v1/fgp/persons/{id}",
            "history": "GET /api/v1/fgp/persons/{id}/history",
            "relations": "GET|POST /api/v1/fgp/persons/{id}/relations",
            "events": "POST /api/v1/fgp/events",
            "corrections": "POST /api/v1/fgp/corrections",
            "verify": "POST /api/v1/identity/verify",
            "registry": "/api/v1/registry/citizens (Module 2)",
        },
    )


async def fgp_health(db: AsyncSession) -> FgpHealthOut:
    total = int(await db.scalar(select(func.count()).select_from(Citizen)) or 0)
    with_nic = int(
        await db.scalar(
            select(func.count()).select_from(Citizen).where(Citizen.nic.is_not(None))
        )
        or 0
    )
    by_rows = (
        await db.execute(select(Citizen.status, func.count()).group_by(Citizen.status))
    ).all()
    by_status = {str(s): int(n) for s, n in by_rows}
    open_dupes = int(
        await db.scalar(
            select(func.count())
            .select_from(DuplicateCandidate)
            .where(DuplicateCandidate.status == DuplicateStatus.OPEN.value)
        )
        or 0
    )
    official = False
    try:
        from apps.api.domains.core_registry.national_identity_number_service import (
            OFFICIAL_NIN_FORMAT_CONFIRMED,
        )

        official = bool(OFFICIAL_NIN_FORMAT_CONFIRMED)
    except Exception:
        official = False

    return FgpHealthOut(
        generated_at=datetime.now(timezone.utc),
        citizens_total=total,
        with_nic=with_nic,
        without_nic=max(0, total - with_nic),
        by_status=by_status,
        open_duplicates=open_dupes,
        provisional_nic_only=not official,
        official_nin_format_confirmed=official,
        offline_nin_forbidden=True,
    )


def _idempotency_key(source: str, source_event_id: str) -> str:
    return f"{source.strip().lower()}:{source_event_id.strip()}"


async def find_existing_event(
    db: AsyncSession, *, source: str, source_event_id: str
) -> CitizenHistory | None:
    key = _idempotency_key(source, source_event_id)
    # Scan récents avec filtre payload (portable)
    rows = list(
        (
            await db.execute(
                select(CitizenHistory)
                .where(CitizenHistory.event_type == CitizenEventType.STATUS_CHANGED.value)
                .order_by(CitizenHistory.created_at.desc())
                .limit(500)
            )
        ).scalars().all()
    )
    # Also look for dedicated FGP_EVENT type if present in payload
    rows2 = list(
        (
            await db.execute(
                select(CitizenHistory)
                .where(CitizenHistory.event_type == "FGP_EVENT")
                .order_by(CitizenHistory.created_at.desc())
                .limit(500)
            )
        ).scalars().all()
    )
    for row in rows + rows2:
        payload = row.payload if isinstance(row.payload, dict) else {}
        if payload.get("idempotency_key") == key:
            return row
    return None


async def ingest_event(
    db: AsyncSession,
    data: FgpEventIn,
    *,
    actor_id: uuid.UUID | None = None,
) -> FgpEventOut:
    """Enregistre un événement sourcé — idempotent ; n'attribue jamais de NIN."""
    citizen = await db.get(Citizen, data.citizen_id)
    if citizen is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    key = _idempotency_key(data.source, data.source_event_id)
    existing = await find_existing_event(
        db, source=data.source, source_event_id=data.source_event_id
    )
    if existing is not None:
        return FgpEventOut(
            id=str(existing.id),
            source=data.source,
            source_event_id=data.source_event_id,
            citizen_id=data.citizen_id,
            event_type=data.event_type,
            already_processed=True,
            created_at=existing.created_at,
            message="Événement déjà traité (idempotence) — aucun doublon créé",
        )

    now = datetime.now(timezone.utc)
    hist = CitizenHistory(
        citizen_id=data.citizen_id,
        event_type="FGP_EVENT",
        payload={
            "idempotency_key": key,
            "source": data.source.strip().lower(),
            "source_event_id": data.source_event_id.strip(),
            "event_type": data.event_type.strip().upper(),
            "payload": data.payload,
            "effective_date": data.effective_date.isoformat() if data.effective_date else None,
            "nin_assigned": False,
        },
        actor_id=actor_id,
        created_at=now,
    )
    db.add(hist)
    try:
        from apps.api.domains.audit.services import write_audit

        await write_audit(
            db,
            action="FGP_EVENT_INGEST",
            actor_id=actor_id,
            resource_type="FgpEvent",
            resource_id=key,
            new_value={
                "citizen_id": str(data.citizen_id),
                "event_type": data.event_type,
                "source": data.source,
            },
            commit=False,
        )
    except Exception:
        pass
    await db.commit()
    await db.refresh(hist)
    return FgpEventOut(
        id=str(hist.id),
        source=data.source,
        source_event_id=data.source_event_id,
        citizen_id=data.citizen_id,
        event_type=data.event_type,
        already_processed=False,
        created_at=hist.created_at,
        message="Événement FGP enregistré — aucun NIN attribué",
    )


async def request_correction(
    db: AsyncSession,
    data: FgpCorrectionIn,
    *,
    actor_id: uuid.UUID | None = None,
) -> FgpCorrectionOut:
    citizen = await db.get(Citizen, data.citizen_id)
    if citizen is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    # Ne pas appliquer silencieusement — demande historisée (cahier §9.2)
    now = datetime.now(timezone.utc)
    current = data.current_value
    if current is None and hasattr(citizen, data.field_name):
        raw = getattr(citizen, data.field_name)
        current = str(raw) if raw is not None else None

    hist = CitizenHistory(
        citizen_id=data.citizen_id,
        event_type="CORRECTION_REQUESTED",
        payload={
            "field_name": data.field_name,
            "current_value": current,
            "proposed_value": data.proposed_value,
            "reason": data.reason.strip(),
            "status": "REQUESTED",
            "applied": False,
        },
        actor_id=actor_id,
        created_at=now,
    )
    db.add(hist)
    await db.commit()
    await db.refresh(hist)
    return FgpCorrectionOut(
        citizen_id=data.citizen_id,
        status="REQUESTED",
        field_name=data.field_name,
        history_id=hist.id,
        message="Demande de rectification enregistrée — application après décision autorisée",
    )


async def list_relations(db: AsyncSession, citizen_id: uuid.UUID) -> list[FgpRelationOut]:
    if await db.get(Citizen, citizen_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")
    rows = list(
        (
            await db.execute(
                select(FamilyRelation).where(
                    (FamilyRelation.citizen_id == citizen_id)
                    | (FamilyRelation.related_citizen_id == citizen_id)
                )
            )
        ).scalars().all()
    )
    return [FgpRelationOut.model_validate(r) for r in rows]


async def add_relation(
    db: AsyncSession,
    citizen_id: uuid.UUID,
    data: FgpRelationIn,
    *,
    actor_id: uuid.UUID | None = None,
) -> FgpRelationOut:
    if citizen_id == data.related_citizen_id:
        raise HTTPException(status_code=400, detail="citizen and related must differ")
    if await db.get(Citizen, citizen_id) is None:
        raise HTTPException(status_code=404, detail="Citizen not found")
    if await db.get(Citizen, data.related_citizen_id) is None:
        raise HTTPException(status_code=404, detail="Related citizen not found")

    rel_type = data.relation_type.strip().upper()
    # Accepter valeurs enum ou libre contrôlé
    allowed = {e.value for e in RelationType}
    if rel_type not in allowed:
        # fallback OTHER if unknown
        if len(rel_type) < 2:
            raise HTTPException(status_code=400, detail="Invalid relation_type")
    existing = await db.scalar(
        select(FamilyRelation).where(
            and_(
                FamilyRelation.citizen_id == citizen_id,
                FamilyRelation.related_citizen_id == data.related_citizen_id,
                FamilyRelation.relation_type == rel_type,
            )
        )
    )
    if existing is not None:
        return FgpRelationOut.model_validate(existing)

    row = FamilyRelation(
        citizen_id=citizen_id,
        related_citizen_id=data.related_citizen_id,
        relation_type=rel_type,
        legal_basis=data.legal_basis,
    )
    db.add(row)
    now = datetime.now(timezone.utc)
    db.add(
        CitizenHistory(
            citizen_id=citizen_id,
            event_type=CitizenEventType.UPDATED.value,
            payload={
                "relation_added": {
                    "related_citizen_id": str(data.related_citizen_id),
                    "relation_type": rel_type,
                }
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(row)
    return FgpRelationOut.model_validate(row)


async def audit_fgp_read(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    resource_id: str,
    detail: dict | None = None,
) -> None:
    try:
        from apps.api.domains.audit.services import write_audit

        await write_audit(
            db,
            action=action,
            actor_id=actor_id,
            resource_type="FgpPerson",
            resource_id=resource_id,
            new_value=detail,
            commit=True,
        )
    except Exception:
        pass
