"""Service Module 12 — mouvements population liés au FGP, sans mutation NIN (RG-09)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.domains.core_registry.enums import AddressType, CitizenEventType
from apps.api.domains.core_registry.models import Citizen, CitizenAddress, CitizenHistory
from apps.api.domains.population_movements.models import (
    MOVEMENT_STATUSES,
    MOVEMENT_TYPES,
    SOURCE_TYPES,
    MovementEventHistory,
    PopulationMovement,
)
from apps.api.domains.population_movements.schemas import (
    MovementApproveIn,
    MovementCorrectIn,
    MovementCreate,
    MovementHistoryOut,
    MovementListOut,
    MovementOut,
    MovementPatch,
    MovementReviewIn,
    MovementStatsOut,
)

EDITABLE = {"DRAFT", "COMPLEMENT_REQUIRED"}
TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"SUBMITTED", "CANCELLED"},
    "SUBMITTED": {"IN_REVIEW", "CANCELLED"},
    "IN_REVIEW": {"COMPLEMENT_REQUIRED", "VALIDATED", "REJECTED"},
    "COMPLEMENT_REQUIRED": {"SUBMITTED", "CANCELLED"},
    "VALIDATED": {"CONTESTED"},
    "REJECTED": set(),
    "CANCELLED": set(),
    "CONTESTED": {"IN_REVIEW"},
}

FGP_UPDATE_TYPES = {
    "CHANGE_OF_RESIDENCE",
    "INTERNAL_MIGRATION",
    "RETURN_RESETTLEMENT",
}


class MovementError(Exception):
    def __init__(self, message: str, *, code: str, http_status: int = 400):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


def movements_catalog() -> dict[str, Any]:
    return {
        "module": 12,
        "title": "Gestion des mouvements de la population",
        "invent_nin_forbidden": True,
        "modify_nin_forbidden": True,
        "parallel_identity_forbidden": True,
        "gps_tracking_forbidden": True,
        "auto_pdi_inference_forbidden": True,
        "fgp_residence_only_after_validation": True,
        "movement_types": [
            {"code": c, "label": _type_label(c)} for c in MOVEMENT_TYPES
        ],
        "statuses": [{"code": c, "label": _status_label(c)} for c in MOVEMENT_STATUSES],
        "source_types": list(SOURCE_TYPES),
        "transitions": {k: sorted(v) for k, v in TRANSITIONS.items()},
        "endpoints": {
            "list": "GET /api/v1/population-movements",
            "create": "POST /api/v1/population-movements",
            "get": "GET /api/v1/population-movements/{id}",
            "patch": "PATCH /api/v1/population-movements/{id}",
            "submit": "POST /api/v1/population-movements/{id}/submit",
            "review": "POST /api/v1/population-movements/{id}/review",
            "approve": "POST /api/v1/population-movements/{id}/approve",
            "correct": "POST /api/v1/population-movements/{id}/correct",
            "stats": "GET /api/v1/population-movements/stats",
        },
        "note": (
            "Événements de mobilité liés au citoyen FGP existant. "
            "Aucun NIN généré/modifié. Résidence FGP mise à jour uniquement après validation autorisée."
        ),
    }


def _type_label(code: str) -> str:
    return {
        "CHANGE_OF_RESIDENCE": "Changement de résidence",
        "INTERNAL_MIGRATION": "Migration interne",
        "TEMPORARY_MOBILITY": "Mobilité temporaire",
        "FORCED_DISPLACEMENT": "Déplacement forcé / PDI",
        "RETURN_RESETTLEMENT": "Retour / réinstallation",
        "INTERNATIONAL": "Mouvement international",
        "COLLECTIVE": "Mouvement collectif",
    }.get(code, code)


def _status_label(code: str) -> str:
    return {
        "DRAFT": "Brouillon",
        "SUBMITTED": "Soumis",
        "IN_REVIEW": "En vérification",
        "COMPLEMENT_REQUIRED": "Complément requis",
        "VALIDATED": "Validé",
        "REJECTED": "Rejeté",
        "CANCELLED": "Annulé",
        "CONTESTED": "Contesté",
    }.get(code, code)


def _forbid_nin_payload(data: dict[str, Any] | None) -> None:
    if not data:
        return
    for key in ("nin", "nic", "national_id", "numero_national"):
        if key in data and data[key] not in (None, "", []):
            raise MovementError(
                "Le module mouvements ne peut pas recevoir ni modifier un NIN/NIC (RG-09).",
                code="nin_forbidden",
                http_status=400,
            )


def _to_out(row: PopulationMovement, history: list[MovementEventHistory] | None = None) -> MovementOut:
    hist = history
    if hist is None:
        hist = []
    return MovementOut(
        id=row.id,
        citizen_id=row.citizen_id,
        movement_type=row.movement_type,
        status=row.status,
        declared_at=row.declared_at,
        observed_date=row.observed_date,
        effective_date=row.effective_date,
        verified_at=row.verified_at,
        source_type=row.source_type,
        source_reference=row.source_reference,
        reason_code=row.reason_code,
        notes_minimal=row.notes_minimal,
        origin_province_code=row.origin_province_code,
        origin_commune_code=row.origin_commune_code,
        origin_label=row.origin_label,
        destination_province_code=row.destination_province_code,
        destination_commune_code=row.destination_commune_code,
        destination_city=row.destination_city,
        destination_line1=row.destination_line1,
        destination_label=row.destination_label,
        sensitivity_class=row.sensitivity_class,
        update_fgp_residence=row.update_fgp_residence,
        fgp_residence_applied=row.fgp_residence_applied,
        created_by=row.created_by,
        reviewed_by=row.reviewed_by,
        validated_by=row.validated_by,
        decision_reason=row.decision_reason,
        version=row.version,
        created_at=row.created_at,
        updated_at=row.updated_at,
        history=[MovementHistoryOut.model_validate(h) for h in hist],
    )


async def _append_history(
    db: AsyncSession,
    movement: PopulationMovement,
    *,
    event_type: str,
    old_status: str | None,
    new_status: str | None,
    actor_id: uuid.UUID | None,
    note: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    db.add(
        MovementEventHistory(
            movement_id=movement.id,
            event_type=event_type,
            old_status=old_status,
            new_status=new_status,
            actor_id=actor_id,
            note=note,
            payload=payload,
            occurred_at=datetime.now(UTC),
        )
    )


async def _get_movement(db: AsyncSession, movement_id: uuid.UUID) -> PopulationMovement:
    row = await db.get(PopulationMovement, movement_id)
    if row is None:
        raise MovementError("Mouvement introuvable", code="not_found", http_status=404)
    return row


async def _history_for(db: AsyncSession, movement_id: uuid.UUID) -> list[MovementEventHistory]:
    rows = (
        await db.scalars(
            select(MovementEventHistory)
            .where(MovementEventHistory.movement_id == movement_id)
            .order_by(MovementEventHistory.occurred_at.asc())
        )
    ).all()
    return list(rows)


async def create_movement(
    db: AsyncSession,
    data: MovementCreate,
    *,
    actor_id: uuid.UUID | None,
) -> MovementOut:
    _forbid_nin_payload(data.model_dump())
    if data.movement_type not in MOVEMENT_TYPES:
        raise MovementError("Type de mouvement invalide", code="invalid_type")
    if data.source_type not in SOURCE_TYPES:
        raise MovementError("Source invalide", code="invalid_source")

    citizen = await db.get(Citizen, data.citizen_id)
    if citizen is None:
        raise MovementError("Citoyen FGP introuvable", code="citizen_not_found", http_status=404)
    if citizen.status in {"MERGED", "DECEASED"}:
        raise MovementError(
            "Citoyen non éligible (décédé ou fusionné)",
            code="citizen_ineligible",
            http_status=409,
        )

    source_ref = data.source_reference or data.idempotency_key
    if source_ref:
        existing = await db.scalar(
            select(PopulationMovement).where(
                PopulationMovement.source_type == data.source_type,
                PopulationMovement.source_reference == source_ref,
            )
        )
        if existing is not None:
            hist = await _history_for(db, existing.id)
            return _to_out(existing, hist)

    sensitivity = "RESTRICTED" if data.movement_type == "FORCED_DISPLACEMENT" else "STANDARD"
    want_fgp = bool(data.update_fgp_residence) and data.movement_type in FGP_UPDATE_TYPES
    if data.movement_type == "TEMPORARY_MOBILITY":
        want_fgp = False
    if data.movement_type == "FORCED_DISPLACEMENT":
        # Pas de MAJ automatique de résidence de référence pour PDI sans règle explicitée.
        want_fgp = False

    initial = "SUBMITTED" if data.submit else "DRAFT"
    now = datetime.now(UTC)
    row = PopulationMovement(
        citizen_id=data.citizen_id,
        movement_type=data.movement_type,
        status=initial,
        declared_at=now,
        observed_date=data.observed_date,
        effective_date=data.effective_date,
        source_type=data.source_type,
        source_reference=source_ref,
        reason_code=data.reason_code,
        notes_minimal=data.notes_minimal,
        origin_province_code=data.origin_province_code,
        origin_commune_code=data.origin_commune_code,
        origin_label=data.origin_label,
        destination_province_code=data.destination_province_code,
        destination_commune_code=data.destination_commune_code,
        destination_city=data.destination_city,
        destination_line1=data.destination_line1,
        destination_label=data.destination_label,
        sensitivity_class=sensitivity,
        update_fgp_residence=want_fgp,
        fgp_residence_applied=False,
        version=1,
        created_by=actor_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    await _append_history(
        db,
        row,
        event_type="CREATED",
        old_status=None,
        new_status=initial,
        actor_id=actor_id,
        payload={"movement_type": data.movement_type, "source_type": data.source_type},
    )
    if initial == "SUBMITTED":
        await _append_history(
            db,
            row,
            event_type="SUBMITTED",
            old_status="DRAFT",
            new_status="SUBMITTED",
            actor_id=actor_id,
        )
    hist = await _history_for(db, row.id)
    return _to_out(row, hist)


async def list_movements(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 50,
    status_filter: str | None = None,
    movement_type: str | None = None,
    citizen_id: uuid.UUID | None = None,
    province_code: str | None = None,
) -> MovementListOut:
    stmt = select(PopulationMovement)
    count_stmt = select(func.count()).select_from(PopulationMovement)
    if status_filter:
        stmt = stmt.where(PopulationMovement.status == status_filter.upper())
        count_stmt = count_stmt.where(PopulationMovement.status == status_filter.upper())
    if movement_type:
        stmt = stmt.where(PopulationMovement.movement_type == movement_type.upper())
        count_stmt = count_stmt.where(PopulationMovement.movement_type == movement_type.upper())
    if citizen_id:
        stmt = stmt.where(PopulationMovement.citizen_id == citizen_id)
        count_stmt = count_stmt.where(PopulationMovement.citizen_id == citizen_id)
    if province_code:
        code = province_code.strip().upper()
        stmt = stmt.where(
            (PopulationMovement.destination_province_code == code)
            | (PopulationMovement.origin_province_code == code)
        )
        count_stmt = count_stmt.where(
            (PopulationMovement.destination_province_code == code)
            | (PopulationMovement.origin_province_code == code)
        )
    total = int(await db.scalar(count_stmt) or 0)
    rows = (
        await db.scalars(
            stmt.order_by(PopulationMovement.declared_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return MovementListOut(
        items=[_to_out(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_movement(db: AsyncSession, movement_id: uuid.UUID) -> MovementOut:
    row = await _get_movement(db, movement_id)
    hist = await _history_for(db, row.id)
    return _to_out(row, hist)


async def patch_movement(
    db: AsyncSession,
    movement_id: uuid.UUID,
    data: MovementPatch,
    *,
    actor_id: uuid.UUID | None,
) -> MovementOut:
    row = await _get_movement(db, movement_id)
    if row.status not in EDITABLE:
        raise MovementError(
            "Modification autorisée seulement en brouillon ou complément requis",
            code="not_editable",
            http_status=409,
        )
    changes: dict[str, Any] = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        old = getattr(row, field)
        if old != value:
            changes[field] = {"from": str(old), "to": str(value)}
            setattr(row, field, value)
    if not changes:
        return await get_movement(db, movement_id)
    row.updated_at = datetime.now(UTC)
    row.version += 1
    await _append_history(
        db,
        row,
        event_type="UPDATED",
        old_status=row.status,
        new_status=row.status,
        actor_id=actor_id,
        payload={"changes": changes},
    )
    return await get_movement(db, movement_id)


async def _transition(
    db: AsyncSession,
    row: PopulationMovement,
    target: str,
    *,
    actor_id: uuid.UUID | None,
    event_type: str,
    note: str | None = None,
) -> None:
    if target not in TRANSITIONS.get(row.status, set()):
        raise MovementError(
            f"Transition interdite : {row.status} → {target}",
            code="invalid_transition",
            http_status=409,
        )
    old = row.status
    row.status = target
    row.updated_at = datetime.now(UTC)
    row.version += 1
    await _append_history(
        db,
        row,
        event_type=event_type,
        old_status=old,
        new_status=target,
        actor_id=actor_id,
        note=note,
    )


async def submit_movement(
    db: AsyncSession,
    movement_id: uuid.UUID,
    *,
    actor_id: uuid.UUID | None,
) -> MovementOut:
    row = await _get_movement(db, movement_id)
    if row.status == "COMPLEMENT_REQUIRED":
        await _transition(db, row, "SUBMITTED", actor_id=actor_id, event_type="RESUBMITTED")
    else:
        await _transition(db, row, "SUBMITTED", actor_id=actor_id, event_type="SUBMITTED")
    return await get_movement(db, movement_id)


async def review_movement(
    db: AsyncSession,
    movement_id: uuid.UUID,
    data: MovementReviewIn,
    *,
    actor_id: uuid.UUID | None,
) -> MovementOut:
    row = await _get_movement(db, movement_id)
    if row.status == "SUBMITTED" and data.decision == "IN_REVIEW":
        await _transition(db, row, "IN_REVIEW", actor_id=actor_id, event_type="REVIEW_STARTED", note=data.reason)
        row.reviewed_by = actor_id
    elif row.status == "IN_REVIEW" and data.decision == "COMPLEMENT_REQUIRED":
        await _transition(
            db, row, "COMPLEMENT_REQUIRED", actor_id=actor_id, event_type="COMPLEMENT_REQUIRED", note=data.reason
        )
        row.decision_reason = data.reason
        row.reviewed_by = actor_id
    elif row.status == "IN_REVIEW" and data.decision == "REJECTED":
        await _transition(db, row, "REJECTED", actor_id=actor_id, event_type="REJECTED", note=data.reason)
        row.decision_reason = data.reason
        row.reviewed_by = actor_id
        row.verified_at = datetime.now(UTC)
    else:
        raise MovementError(
            f"Décision {data.decision} incompatible avec le statut {row.status}",
            code="invalid_review",
            http_status=409,
        )
    return await get_movement(db, movement_id)


async def _apply_fgp_residence(
    db: AsyncSession,
    row: PopulationMovement,
    *,
    actor_id: uuid.UUID | None,
) -> None:
    if not (row.destination_line1 and row.destination_city):
        raise MovementError(
            "Destination incomplete (avenue + ville) pour mise à jour FGP",
            code="destination_incomplete",
            http_status=409,
        )
    citizen = await db.scalar(
        select(Citizen)
        .where(Citizen.id == row.citizen_id)
        .options(selectinload(Citizen.addresses))
    )
    if citizen is None:
        raise MovementError("Citoyen FGP introuvable", code="citizen_not_found", http_status=404)

    now = datetime.now(UTC)
    previous = []
    for existing in list(citizen.addresses or []):
        if existing.is_primary:
            previous.append(
                {
                    "line1": existing.line1,
                    "city": existing.city,
                    "province_code": existing.province_code,
                    "commune_code": existing.commune_code,
                }
            )
            existing.is_primary = False
            existing.valid_to = now.date()

    citizen.addresses.append(
        CitizenAddress(
            address_type=AddressType.RESIDENTIAL.value,
            line1=row.destination_line1,
            line2=row.destination_label,
            city=row.destination_city,
            commune_code=row.destination_commune_code,
            province_code=row.destination_province_code,
            country_code="COD",
            is_primary=True,
            valid_from=row.effective_date or now.date(),
        )
    )
    citizen.updated_at = now
    db.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.UPDATED.value,
            payload={
                "source": "population_movements",
                "movement_id": str(row.id),
                "residence_updated": True,
                "previous_primary": previous,
                "new_primary": {
                    "line1": row.destination_line1,
                    "city": row.destination_city,
                    "province_code": row.destination_province_code,
                    "commune_code": row.destination_commune_code,
                },
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    row.fgp_residence_applied = True


async def approve_movement(
    db: AsyncSession,
    movement_id: uuid.UUID,
    data: MovementApproveIn,
    *,
    actor_id: uuid.UUID | None,
) -> MovementOut:
    row = await _get_movement(db, movement_id)
    if row.status == "SUBMITTED":
        await _transition(db, row, "IN_REVIEW", actor_id=actor_id, event_type="REVIEW_STARTED")
    if row.status != "IN_REVIEW":
        raise MovementError(
            "Approbation possible seulement depuis En vérification",
            code="invalid_transition",
            http_status=409,
        )
    if actor_id and row.created_by and actor_id == row.created_by and row.sensitivity_class == "RESTRICTED":
        raise MovementError(
            "Séparation des tâches : le déclarant ne peut pas approuver un dossier sensible",
            code="sod_violation",
            http_status=403,
        )

    apply_fgp = row.update_fgp_residence if data.apply_fgp_residence is None else data.apply_fgp_residence
    if apply_fgp and row.movement_type in FGP_UPDATE_TYPES:
        await _apply_fgp_residence(db, row, actor_id=actor_id)
    elif apply_fgp and row.movement_type == "FORCED_DISPLACEMENT":
        raise MovementError(
            "Mise à jour FGP automatique interdite pour déplacement forcé (politique séparée)",
            code="fgp_update_forbidden_for_type",
            http_status=409,
        )

    await _transition(
        db,
        row,
        "VALIDATED",
        actor_id=actor_id,
        event_type="VALIDATED",
        note=data.reason,
    )
    row.validated_by = actor_id
    row.verified_at = datetime.now(UTC)
    row.decision_reason = data.reason
    return await get_movement(db, movement_id)


async def correct_movement(
    db: AsyncSession,
    movement_id: uuid.UUID,
    data: MovementCorrectIn,
    *,
    actor_id: uuid.UUID | None,
) -> MovementOut:
    row = await _get_movement(db, movement_id)
    if row.status != "VALIDATED":
        raise MovementError(
            "Correction (contestation) réservée aux mouvements validés",
            code="invalid_transition",
            http_status=409,
        )
    await _transition(
        db,
        row,
        "CONTESTED",
        actor_id=actor_id,
        event_type="CONTESTED",
        note=data.reason,
    )
    if data.notes_minimal:
        row.notes_minimal = data.notes_minimal
    row.decision_reason = data.reason
    return await get_movement(db, movement_id)


async def stats(db: AsyncSession) -> MovementStatsOut:
    rows = (await db.scalars(select(PopulationMovement))).all()
    by_status: dict[str, int] = {}
    by_type: dict[str, int] = {}
    pending = 0
    validated = 0
    fgp_upd = 0
    for r in rows:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        by_type[r.movement_type] = by_type.get(r.movement_type, 0) + 1
        if r.status in {"SUBMITTED", "IN_REVIEW", "COMPLEMENT_REQUIRED"}:
            pending += 1
        if r.status == "VALIDATED":
            validated += 1
        if r.fgp_residence_applied:
            fgp_upd += 1
    return MovementStatsOut(
        generated_at=datetime.now(UTC),
        total=len(rows),
        by_status=by_status,
        by_type=by_type,
        pending_review=pending,
        validated=validated,
        fgp_residence_updates=fgp_upd,
        note="Agrégats Module 12 — pas de NIN, pas de points individuels.",
    )


def http_exc(exc: MovementError) -> HTTPException:
    return HTTPException(
        status_code=exc.http_status,
        detail={"message": str(exc), "code": exc.code},
    )
