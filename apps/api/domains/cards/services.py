"""Card lifecycle, QR verification, digital identity services."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.cards.enums import (
    LEVEL_2,
    LEVEL_3,
    CardHistoryEvent,
    CardStatus,
    DigitalIdentityStatus,
)
from apps.api.domains.cards.models import CardHistory, DigitalIdentity, NationalCard
from apps.api.domains.cards.qr import build_qr_payload, verify_qr_signature
from apps.api.domains.cards.schemas import (
    CardIssueRequest,
    OfflineVerifyRequest,
    OnlineVerifyRequest,
    ReplaceCardRequest,
)

# Claims allowed in online verification responses (never full identity dump).
ALLOWED_CLAIMS = frozenset(
    {
        "status",
        "expires_at",
        "version",
        "serial_number_last4",
        "card_id",
        "issued_at",
    }
)


def _serial() -> str:
    return f"NIC-{secrets.token_hex(4).upper()}-{secrets.token_hex(3).upper()}"


async def _append_history(
    db: AsyncSession,
    card_id: uuid.UUID,
    event_type: str,
    *,
    actor_id: uuid.UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    db.add(
        CardHistory(
            card_id=card_id,
            event_type=event_type,
            actor_id=actor_id,
            payload=payload,
        )
    )


async def issue_card(
    db: AsyncSession,
    data: CardIssueRequest,
    *,
    actor_id: uuid.UUID | None = None,
) -> tuple[NationalCard, dict[str, Any]]:
    now = datetime.now(UTC)
    expires = data.expires_at or (now + timedelta(days=365 * 10))
    card = NationalCard(
        citizen_id=data.citizen_id,
        serial_number=_serial(),
        issued_at=now,
        expires_at=expires,
        status=CardStatus.PENDING.value,
        version=data.version,
    )
    db.add(card)
    await db.flush()
    await _append_history(
        db, card.card_id, CardHistoryEvent.ISSUED.value, actor_id=actor_id
    )

    # Ensure digital identity shell exists
    existing = (
        await db.execute(
            select(DigitalIdentity).where(DigitalIdentity.citizen_id == data.citizen_id)
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            DigitalIdentity(
                citizen_id=data.citizen_id,
                status=DigitalIdentityStatus.PENDING.value,
            )
        )

    await db.commit()
    await db.refresh(card)
    qr = build_qr_payload(card.card_id, card.version)
    return card, qr


async def get_card(db: AsyncSession, card_id: uuid.UUID) -> NationalCard | None:
    return await db.get(NationalCard, card_id)


async def get_active_card_for_citizen(
    db: AsyncSession, citizen_id: uuid.UUID
) -> NationalCard | None:
    stmt = (
        select(NationalCard)
        .where(NationalCard.citizen_id == citizen_id)
        .where(NationalCard.status.in_([CardStatus.ACTIVE.value, CardStatus.PENDING.value]))
        .order_by(NationalCard.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _set_status(
    db: AsyncSession,
    card: NationalCard,
    new_status: CardStatus,
    event: CardHistoryEvent,
    *,
    actor_id: uuid.UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> NationalCard:
    card.status = new_status.value
    await _append_history(db, card.card_id, event.value, actor_id=actor_id, payload=payload)
    await db.commit()
    await db.refresh(card)
    return card


async def activate_card(
    db: AsyncSession, card_id: uuid.UUID, *, actor_id: uuid.UUID | None = None
) -> NationalCard:
    card = await get_card(db, card_id)
    if card is None:
        raise ValueError("Card not found")
    if card.status not in {CardStatus.PENDING.value, CardStatus.SUSPENDED.value}:
        raise ValueError(f"Cannot activate from status {card.status}")
    # Activate digital identity
    di = (
        await db.execute(
            select(DigitalIdentity).where(DigitalIdentity.citizen_id == card.citizen_id)
        )
    ).scalar_one_or_none()
    if di:
        di.status = DigitalIdentityStatus.ACTIVE.value
    return await _set_status(
        db, card, CardStatus.ACTIVE, CardHistoryEvent.ACTIVATED, actor_id=actor_id
    )


async def suspend_card(
    db: AsyncSession,
    card_id: uuid.UUID,
    *,
    reason: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> NationalCard:
    card = await get_card(db, card_id)
    if card is None:
        raise ValueError("Card not found")
    return await _set_status(
        db,
        card,
        CardStatus.SUSPENDED,
        CardHistoryEvent.SUSPENDED,
        actor_id=actor_id,
        payload={"reason": reason},
    )


async def report_lost(
    db: AsyncSession,
    card_id: uuid.UUID,
    *,
    reason: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> NationalCard:
    card = await get_card(db, card_id)
    if card is None:
        raise ValueError("Card not found")
    return await _set_status(
        db,
        card,
        CardStatus.LOST,
        CardHistoryEvent.REPORTED_LOST,
        actor_id=actor_id,
        payload={"reason": reason},
    )


async def revoke_card(
    db: AsyncSession,
    card_id: uuid.UUID,
    *,
    reason: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> NationalCard:
    card = await get_card(db, card_id)
    if card is None:
        raise ValueError("Card not found")
    di = (
        await db.execute(
            select(DigitalIdentity).where(DigitalIdentity.citizen_id == card.citizen_id)
        )
    ).scalar_one_or_none()
    if di:
        di.status = DigitalIdentityStatus.REVOKED.value
    return await _set_status(
        db,
        card,
        CardStatus.REVOKED,
        CardHistoryEvent.REVOKED,
        actor_id=actor_id,
        payload={"reason": reason},
    )


async def replace_card(
    db: AsyncSession,
    card_id: uuid.UUID,
    data: ReplaceCardRequest,
    *,
    actor_id: uuid.UUID | None = None,
) -> tuple[NationalCard, NationalCard, dict[str, Any]]:
    old = await get_card(db, card_id)
    if old is None:
        raise ValueError("Card not found")
    new_card, qr = await issue_card(
        db,
        CardIssueRequest(
            citizen_id=old.citizen_id,
            expires_at=data.expires_at or old.expires_at,
            version=old.version + 1,
        ),
        actor_id=actor_id,
    )
    old.status = CardStatus.REPLACED.value
    old.replaced_by_id = new_card.card_id
    await _append_history(
        db,
        old.card_id,
        CardHistoryEvent.REPLACED.value,
        actor_id=actor_id,
        payload={"replaced_by": str(new_card.card_id), "reason": data.reason},
    )
    await db.commit()
    await db.refresh(old)
    await db.refresh(new_card)
    return old, new_card, qr


def verify_offline(payload: OfflineVerifyRequest) -> dict[str, Any]:
    ok = verify_qr_signature(payload.model_dump())
    return {
        "valid_signature": ok,
        "level": LEVEL_2 if ok else "LEVEL_0",
        "message": "Signature valid" if ok else "Invalid QR signature",
    }


async def verify_online(
    db: AsyncSession, body: OnlineVerifyRequest
) -> dict[str, Any]:
    card: NationalCard | None = None
    if body.qr is not None:
        if not verify_qr_signature(body.qr.model_dump()):
            return {
                "valid": False,
                "level": LEVEL_2,
                "status": None,
                "claims": {},
                "message": "Invalid QR signature",
            }
        card = await get_card(db, body.qr.card_id)
    elif body.card_id is not None:
        card = await get_card(db, body.card_id)
    elif body.serial_number:
        card = (
            await db.execute(
                select(NationalCard).where(NationalCard.serial_number == body.serial_number)
            )
        ).scalar_one_or_none()

    if card is None:
        return {
            "valid": False,
            "level": LEVEL_3,
            "status": None,
            "claims": {},
            "message": "Card not found",
        }

    now = datetime.now(UTC)
    if card.expires_at and card.expires_at < now and card.status == CardStatus.ACTIVE.value:
        card.status = CardStatus.EXPIRED.value
        await _append_history(db, card.card_id, CardHistoryEvent.EXPIRED.value)
        await db.commit()

    valid = card.status == CardStatus.ACTIVE.value
    requested = [c for c in body.requested_claims if c in ALLOWED_CLAIMS]
    if not requested:
        requested = ["status", "expires_at"]

    claims: dict[str, Any] = {}
    for key in requested:
        if key == "status":
            claims["status"] = card.status
        elif key == "expires_at":
            claims["expires_at"] = card.expires_at.isoformat() if card.expires_at else None
        elif key == "version":
            claims["version"] = card.version
        elif key == "serial_number_last4":
            claims["serial_number_last4"] = card.serial_number[-4:]
        elif key == "card_id":
            claims["card_id"] = str(card.card_id)
        elif key == "issued_at":
            claims["issued_at"] = card.issued_at.isoformat() if card.issued_at else None

    await _append_history(
        db,
        card.card_id,
        CardHistoryEvent.VERIFIED_ONLINE.value,
        payload={"valid": valid, "claims_keys": list(claims.keys())},
    )
    await db.commit()

    return {
        "valid": valid,
        "level": LEVEL_3,
        "status": card.status,
        "claims": claims,
        "message": "OK" if valid else f"Card status is {card.status}",
    }
