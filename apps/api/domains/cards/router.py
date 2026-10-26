"""HTTP routes for national cards — /api/v1/cards."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import Principal, require_permissions
from apps.api.db.session import get_db
from apps.api.domains.cards.enums import (
    PERM_CARD_ISSUE,
    PERM_CARD_MANAGE,
    PERM_CARD_VERIFY,
    VERIFICATION_LEVELS,
)
from apps.api.domains.cards.qr import build_qr_payload
from apps.api.domains.cards.schemas import (
    CardActionRequest,
    CardIssueRequest,
    CardRead,
    OfflineVerifyRequest,
    OfflineVerifyResponse,
    OnlineVerifyRequest,
    OnlineVerifyResponse,
    ReplaceCardRequest,
)
from apps.api.domains.cards import request_store, services

router = APIRouter(prefix="/cards", tags=["cards"])


class CardRequestCreate(BaseModel):
    citizen_id: UUID
    request_type: Literal["FIRST_ISSUE", "RENEWAL", "REPLACE", "LOST", "STOLEN"] = "FIRST_ISSUE"
    idempotency_key: str | None = Field(default=None, max_length=128)
    source_card_id: UUID | None = None
    reason: str | None = Field(default=None, max_length=2000)


class ApproveProductionBody(BaseModel):
    motif: str = Field(min_length=8, max_length=2000)


class ProductionBatchCreate(BaseModel):
    request_ids: list[str] = Field(min_length=1)


class LifecycleEventBody(BaseModel):
    event: Literal["LOST", "STOLEN", "REVOKE", "SUSPEND", "INVALIDATE"]
    reason: str = Field(min_length=8, max_length=2000)


async def _to_read(db, card, qr=None) -> CardRead:
    data = CardRead.model_validate(card)
    data.qr_payload = qr or build_qr_payload(card.card_id, card.version)
    data.routing_message = services.routing_message(card)
    citizen = await services.load_citizen_with_addresses(db, card.citizen_id)
    if citizen is not None:
        data.holder = services.holder_snapshot(citizen)
    return data


@router.get("/verification-levels")
async def verification_levels() -> dict:
    return VERIFICATION_LEVELS


@router.get("/catalog")
async def cards_catalog(
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> dict[str, Any]:
    """Module 9 — règles CIN (pas de NIN inventé ; gabarit prototype)."""
    return services.cards_catalog()


@router.get("/eligibility/{citizen_id}")
async def cin_eligibility(
    citizen_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> dict[str, Any]:
    return await services.evaluate_cin_eligibility(db, citizen_id)


@router.post("/card-requests", status_code=status.HTTP_201_CREATED)
async def create_card_request(
    body: CardRequestCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_ISSUE)),
) -> dict[str, Any]:
    try:
        return await services.create_card_request(
            db,
            citizen_id=body.citizen_id,
            request_type=body.request_type,
            idempotency_key=body.idempotency_key,
            source_card_id=body.source_card_id,
            reason=body.reason,
            actor_id=principal.actor_id,
        )
    except services.CardEligibilityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(exc), "code": exc.code},
        ) from exc


@router.get("/card-requests")
async def list_card_requests(
    limit: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> dict[str, Any]:
    items = request_store.list_requests(limit=limit, status=status_filter)
    return {"count": len(items), "items": items, "template_approved": request_store.TEMPLATE_APPROVED}


@router.get("/card-requests/{request_id}")
async def get_card_request(
    request_id: str,
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> dict[str, Any]:
    row = request_store.get_request(request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return row


@router.post("/card-requests/{request_id}/approve-production")
async def approve_production(
    request_id: str,
    body: ApproveProductionBody,
    principal: Principal = Depends(require_permissions(PERM_CARD_ISSUE)),
) -> dict[str, Any]:
    try:
        return await services.approve_request_for_production(
            request_id, motif=body.motif, actor_id=principal.actor_id
        )
    except services.CardEligibilityError as exc:
        code = (
            status.HTTP_423_LOCKED
            if exc.code == "template_not_approved"
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(
            status_code=code,
            detail={"message": str(exc), "code": exc.code},
        ) from exc


@router.post("/production-batches", status_code=status.HTTP_201_CREATED)
async def create_production_batch(
    body: ProductionBatchCreate,
    principal: Principal = Depends(require_permissions(PERM_CARD_ISSUE)),
) -> dict[str, Any]:
    try:
        return await services.create_production_batch(
            request_ids=body.request_ids, actor_id=principal.actor_id
        )
    except services.CardEligibilityError as exc:
        code = (
            status.HTTP_423_LOCKED
            if exc.code == "template_not_approved"
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(
            status_code=code,
            detail={"message": str(exc), "code": exc.code},
        ) from exc


@router.get("/production-batches")
async def list_production_batches(
    limit: int = Query(50, ge=1, le=200),
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> dict[str, Any]:
    items = request_store.list_batches(limit=limit)
    return {
        "count": len(items),
        "items": items,
        "template_approved": request_store.TEMPLATE_APPROVED,
        "note": "Lots bloqués tant que gabarit non homologué",
    }


@router.post("/issue", response_model=CardRead, status_code=status.HTTP_201_CREATED)
async def issue_card(
    body: CardIssueRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_ISSUE)),
) -> CardRead:
    try:
        card, qr = await services.issue_card(db, body, actor_id=principal.actor_id)
    except services.CardEligibilityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(exc), "code": exc.code},
        ) from exc
    return await _to_read(db, card, qr)


@router.post("/{card_id}/activate", response_model=CardRead)
async def activate_card(
    card_id: UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    try:
        card = await services.activate_card(db, card_id, actor_id=principal.actor_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _to_read(db, card)


@router.post("/{card_id}/deliver", response_model=CardRead)
async def deliver_card(
    card_id: UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    """Officier d'état civil : remet la carte au citoyen de sa commune."""
    try:
        card = await services.deliver_card_at_commune(
            db, card_id, actor_id=principal.actor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _to_read(db, card)


@router.get("/commune/{commune_code}/inbox")
async def commune_inbox(
    commune_code: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
    limit: int = Query(200, ge=1, le=1000),
) -> dict:
    """Cartes en attente de livraison dans une commune."""
    cards = await services.list_commune_inbox(db, commune_code, limit=limit)
    items = []
    for card in cards:
        read = await _to_read(db, card)
        items.append(read.model_dump(mode="json"))
    return {
        "commune_code": commune_code,
        "count": len(items),
        "items": items,
    }


@router.post("/{card_id}/suspend", response_model=CardRead)
async def suspend_card(
    card_id: UUID,
    body: CardActionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    try:
        card = await services.suspend_card(
            db, card_id, reason=(body.reason if body else None), actor_id=principal.actor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _to_read(db, card)


@router.post("/{card_id}/report-lost", response_model=CardRead)
async def report_lost(
    card_id: UUID,
    body: CardActionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    try:
        card = await services.report_lost(
            db, card_id, reason=(body.reason if body else None), actor_id=principal.actor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _to_read(db, card)


@router.post("/{card_id}/report-stolen", response_model=CardRead)
async def report_stolen(
    card_id: UUID,
    body: CardActionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    try:
        card = await services.report_stolen(
            db, card_id, reason=(body.reason if body else None), actor_id=principal.actor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _to_read(db, card)


@router.post("/{card_id}/lifecycle-events", response_model=CardRead)
async def lifecycle_events(
    card_id: UUID,
    body: LifecycleEventBody,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    try:
        card = await services.record_lifecycle_event(
            db,
            card_id,
            event=body.event,
            reason=body.reason,
            actor_id=principal.actor_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _to_read(db, card)


@router.post("/{card_id}/replace")
async def replace_card(
    card_id: UUID,
    body: ReplaceCardRequest | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_ISSUE)),
) -> dict:
    try:
        old, new, qr = await services.replace_card(
            db, card_id, body or ReplaceCardRequest(), actor_id=principal.actor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "old": (await _to_read(db, old)).model_dump(mode="json"),
        "new": (await _to_read(db, new, qr)).model_dump(mode="json"),
    }


@router.post("/{card_id}/revoke", response_model=CardRead)
async def revoke_card(
    card_id: UUID,
    body: CardActionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    try:
        card = await services.revoke_card(
            db, card_id, reason=(body.reason if body else None), actor_id=principal.actor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _to_read(db, card)


@router.post("/verify-offline", response_model=OfflineVerifyResponse)
async def verify_offline(
    body: OfflineVerifyRequest,
    _: Principal = Depends(require_permissions(PERM_CARD_VERIFY)),
) -> OfflineVerifyResponse:
    return OfflineVerifyResponse(**services.verify_offline(body))


@router.post("/verify-online", response_model=OnlineVerifyResponse)
@router.get("/verify-online", response_model=OnlineVerifyResponse)
async def verify_online(
    body: OnlineVerifyRequest | None = None,
    card_id: UUID | None = None,
    serial_number: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CARD_VERIFY)),
) -> OnlineVerifyResponse:
    req = body or OnlineVerifyRequest(card_id=card_id, serial_number=serial_number)
    if body is None and card_id is None and serial_number is None:
        raise HTTPException(status_code=400, detail="card_id or serial_number required")
    result = await services.verify_online(db, req)
    return OnlineVerifyResponse(**result)


@router.get("/citizen/{citizen_id}", response_model=CardRead | None)
async def get_card_for_citizen(
    citizen_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead | None:
    card = await services.get_active_card_for_citizen(db, citizen_id)
    if card is None:
        return None
    return await _to_read(db, card)


@router.post("/issue-and-activate", response_model=CardRead, status_code=status.HTTP_201_CREATED)
async def issue_and_dispatch_card(
    body: CardIssueRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_ISSUE, PERM_CARD_MANAGE)),
) -> CardRead:
    """ONIP : génère la carte + NIC déjà attribué, puis retourne à la commune pour livraison."""
    existing = await services.get_active_card_for_citizen(db, body.citizen_id)
    if existing is not None:
        return await _to_read(db, existing)
    try:
        card, qr = await services.issue_card(
            db, body, actor_id=principal.actor_id, dispatch_to_commune=True
        )
    except services.CardEligibilityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(exc), "code": exc.code},
        ) from exc
    return await _to_read(db, card, qr)


@router.get("/{card_id}", response_model=CardRead)
async def get_card(
    card_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CARD_MANAGE)),
) -> CardRead:
    card = await services.get_card(db, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return await _to_read(db, card)
