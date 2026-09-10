"""HTTP routes for national cards — /api/v1/cards."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from apps.api.domains.cards import services

router = APIRouter(prefix="/cards", tags=["cards"])


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


@router.post("/issue", response_model=CardRead, status_code=status.HTTP_201_CREATED)
async def issue_card(
    body: CardIssueRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CARD_ISSUE)),
) -> CardRead:
    card, qr = await services.issue_card(db, body, actor_id=principal.actor_id)
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
    card, qr = await services.issue_card(
        db, body, actor_id=principal.actor_id, dispatch_to_commune=True
    )
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
