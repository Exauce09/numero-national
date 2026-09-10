"""Card lifecycle, QR verification, digital identity services."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    CardHolderSnapshot,
    CardIssueRequest,
    OfflineVerifyRequest,
    OnlineVerifyRequest,
    ReplaceCardRequest,
)
from apps.api.domains.core_registry.models import Citizen

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

COMMUNE_INBOX_STATUSES = frozenset(
    {
        CardStatus.SENT_TO_COMMUNE.value,
        CardStatus.PENDING.value,
    }
)


def _serial() -> str:
    return f"CD-{secrets.token_hex(4).upper()}-{secrets.token_hex(3).upper()}"


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


def _primary_address(citizen: Citizen):
    primary = next((a for a in (citizen.addresses or []) if a.is_primary), None)
    if primary is None and citizen.addresses:
        primary = citizen.addresses[0]
    return primary


def resolve_commune_routing(citizen: Citizen) -> dict[str, str | None]:
    """Détermine la commune de livraison à partir de l'adresse principale."""
    addr = _primary_address(citizen)
    if addr is None:
        return {
            "commune_code": "KIN-GOMBE",
            "commune_name": "Gombe",
            "delivery_address": None,
            "city": None,
            "province_code": "KIN",
        }
    commune_code = (addr.commune_code or "").strip() or None
    city = (addr.city or "").strip() or None
    if not commune_code and city:
        commune_code = f"AUTO-{city.upper().replace(' ', '-')[:24]}"
    if not commune_code:
        commune_code = "KIN-GOMBE"
    lines = [addr.line1]
    if addr.line2:
        lines.append(addr.line2)
    lines.append(addr.city)
    if addr.province_code:
        lines.append(addr.province_code)
    lines.append("RDC")
    return {
        "commune_code": commune_code,
        "commune_name": commune_code.split("-")[-1].title() if commune_code else city,
        "delivery_address": ", ".join(p for p in lines if p),
        "city": city,
        "province_code": addr.province_code,
    }


def holder_snapshot(citizen: Citizen) -> CardHolderSnapshot:
    routing = resolve_commune_routing(citizen)
    addr = _primary_address(citizen)
    return CardHolderSnapshot(
        nic=citizen.nic,
        family_name=citizen.family_name,
        given_names=citizen.given_names,
        sex=citizen.sex,
        date_of_birth=citizen.date_of_birth.isoformat() if citizen.date_of_birth else None,
        place_of_birth=citizen.place_of_birth,
        nationality=citizen.nationality or "COD",
        address_line=routing.get("delivery_address"),
        city=routing.get("city") or (addr.city if addr else None),
        commune_code=routing.get("commune_code"),
        province_code=routing.get("province_code") or (addr.province_code if addr else None),
    )


def routing_message(card: NationalCard) -> str:
    if card.status == CardStatus.SENT_TO_COMMUNE.value:
        where = card.commune_name or card.commune_code or "la commune"
        return (
            f"Carte et NIC générés — retournés à la commune de {where} "
            f"pour livraison au titulaire."
        )
    if card.status == CardStatus.DELIVERED.value:
        return "Carte remise au titulaire par la commune."
    if card.status == CardStatus.ACTIVE.value:
        return "Carte active."
    return f"Statut : {card.status}"


async def load_citizen_with_addresses(db: AsyncSession, citizen_id: uuid.UUID) -> Citizen | None:
    stmt = (
        select(Citizen)
        .options(selectinload(Citizen.addresses))
        .where(Citizen.id == citizen_id)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def issue_card(
    db: AsyncSession,
    data: CardIssueRequest,
    *,
    actor_id: uuid.UUID | None = None,
    dispatch_to_commune: bool = True,
) -> tuple[NationalCard, dict[str, Any]]:
    now = datetime.now(UTC)
    expires = data.expires_at or (now + timedelta(days=365 * 10))
    citizen = await load_citizen_with_addresses(db, data.citizen_id)
    routing = (
        resolve_commune_routing(citizen)
        if citizen
        else {
            "commune_code": "KIN-GOMBE",
            "commune_name": "Gombe",
            "delivery_address": None,
        }
    )

    status = (
        CardStatus.SENT_TO_COMMUNE.value if dispatch_to_commune else CardStatus.PENDING.value
    )
    card = NationalCard(
        citizen_id=data.citizen_id,
        serial_number=_serial(),
        issued_at=now,
        expires_at=expires,
        status=status,
        version=data.version,
        commune_code=routing.get("commune_code"),
        commune_name=routing.get("commune_name"),
        delivery_address=routing.get("delivery_address"),
        dispatched_at=now if dispatch_to_commune else None,
    )
    db.add(card)
    await db.flush()
    await _append_history(
        db, card.card_id, CardHistoryEvent.ISSUED.value, actor_id=actor_id
    )
    if dispatch_to_commune:
        await _append_history(
            db,
            card.card_id,
            CardHistoryEvent.DISPATCHED_TO_COMMUNE.value,
            actor_id=actor_id,
            payload={
                "commune_code": card.commune_code,
                "commune_name": card.commune_name,
                "delivery_address": card.delivery_address,
            },
        )

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
        .where(
            NationalCard.status.in_(
                [
                    CardStatus.ACTIVE.value,
                    CardStatus.PENDING.value,
                    CardStatus.SENT_TO_COMMUNE.value,
                    CardStatus.DELIVERED.value,
                ]
            )
        )
        .order_by(NationalCard.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_commune_inbox(
    db: AsyncSession,
    commune_code: str,
    *,
    limit: int = 200,
) -> list[NationalCard]:
    code = commune_code.strip().upper()
    stmt = (
        select(NationalCard)
        .where(NationalCard.status.in_(list(COMMUNE_INBOX_STATUSES)))
        .where(NationalCard.commune_code.is_not(None))
        .order_by(NationalCard.dispatched_at.desc().nullslast(), NationalCard.created_at.desc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    out: list[NationalCard] = []
    for c in rows:
        cc = (c.commune_code or "").upper()
        cn = (c.commune_name or "").upper()
        if cc == code or code in cc or cn == code or (len(code) > 3 and code in cn):
            out.append(c)
        elif "-" in code and code.split("-")[-1] in (cc, cn):
            out.append(c)
    return out


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


async def deliver_card_at_commune(
    db: AsyncSession,
    card_id: uuid.UUID,
    *,
    actor_id: uuid.UUID | None = None,
) -> NationalCard:
    """Commune remet la carte au citoyen → DELIVERED puis ACTIVE."""
    card = await get_card(db, card_id)
    if card is None:
        raise ValueError("Card not found")
    if card.status not in {
        CardStatus.SENT_TO_COMMUNE.value,
        CardStatus.PENDING.value,
        CardStatus.DELIVERED.value,
    }:
        raise ValueError(f"Cannot deliver from status {card.status}")

    now = datetime.now(UTC)
    card.delivered_at = now
    card.status = CardStatus.DELIVERED.value
    await _append_history(
        db,
        card.card_id,
        CardHistoryEvent.DELIVERED_TO_HOLDER.value,
        actor_id=actor_id,
        payload={"commune_code": card.commune_code},
    )
    await db.flush()

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


async def activate_card(
    db: AsyncSession, card_id: uuid.UUID, *, actor_id: uuid.UUID | None = None
) -> NationalCard:
    card = await get_card(db, card_id)
    if card is None:
        raise ValueError("Card not found")
    if card.status not in {
        CardStatus.PENDING.value,
        CardStatus.SUSPENDED.value,
        CardStatus.SENT_TO_COMMUNE.value,
        CardStatus.DELIVERED.value,
    }:
        raise ValueError(f"Cannot activate from status {card.status}")
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
        dispatch_to_commune=True,
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
