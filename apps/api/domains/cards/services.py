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


class CardEligibilityError(ValueError):
    """CIN refusée — dossier non validé ou NIC absent."""

    def __init__(self, message: str, *, code: str):
        super().__init__(message)
        self.code = code


async def assert_cin_eligibility(citizen: Citizen | None) -> Citizen:
    """Gate Lot 3 : dossier ACTIVE + NIC présent (provisoire ou futur officiel)."""
    if citizen is None:
        raise CardEligibilityError("Citizen not found", code="citizen_not_found")
    if not citizen.nic:
        raise CardEligibilityError(
            "CIN refusée : NIC/NIN absent — attribuer un numéro avant production",
            code="nic_required",
        )
    if citizen.status not in {"ACTIVE"}:
        raise CardEligibilityError(
            f"CIN refusée : dossier statut {citizen.status} (ACTIVE requis)",
            code="dossier_not_validated",
        )
    return citizen


def cards_catalog() -> dict[str, Any]:
    """Catalogue Module 9 — gabarit prototype ; pas de NIN inventé."""
    from apps.api.domains.cards import request_store as rs
    from apps.api.domains.core_registry.national_identity_number_service import (
        OFFICIAL_NIN_FORMAT_CONFIRMED,
    )

    return {
        "module": 9,
        "title": "Carte d'Identité Nationale (CIN)",
        "official_nin_format_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
        "invent_nin_forbidden": True,
        "cin_generates_nin_forbidden": True,
        "prototype_template_only": True,
        "template_approved": rs.TEMPLATE_APPROVED,
        "template_version": rs.TEMPLATE_VERSION,
        "official_mrz_forbidden": True,
        "official_serial_format_confirmed": False,
        "hardcoded_validity_days_note": (
            f"Durée indicative {rs.PROTOTYPE_VALIDITY_DAYS} j — non juridique"
        ),
        "request_types": list(rs.REQUEST_TYPES),
        "request_statuses": list(rs.REQUEST_STATUSES),
        "card_statuses": [s.value for s in CardStatus],
        "endpoints": {
            "catalog": "GET /api/v1/cards/catalog",
            "eligibility": "GET /api/v1/cards/eligibility/{citizen_id}",
            "card_requests": "POST|GET /api/v1/cards/card-requests",
            "approve_production": "POST /api/v1/cards/card-requests/{id}/approve-production",
            "batches": "POST|GET /api/v1/cards/production-batches",
            "issue": "POST /api/v1/cards/issue",
            "issue_and_activate": "POST /api/v1/cards/issue-and-activate",
            "deliver": "POST /api/v1/cards/{id}/deliver",
            "report_lost": "POST /api/v1/cards/{id}/report-lost",
            "report_stolen": "POST /api/v1/cards/{id}/report-stolen",
            "replace": "POST /api/v1/cards/{id}/replace",
            "revoke": "POST /api/v1/cards/{id}/revoke",
            "lifecycle": "POST /api/v1/cards/{id}/lifecycle-events",
        },
        "note": (
            "Module CIN : n'attribue jamais de NIN. Gabarit HTML = prototype non homologué. "
            "Lots de production bloqués tant que template_approved=false. "
            "QR interne sans PII ; MRZ UI non officielle."
        ),
        "audit_doc": "docs/legal/onip/MODULE_9_AUDIT.md",
    }


async def evaluate_cin_eligibility(
    db: AsyncSession, citizen_id: uuid.UUID
) -> dict[str, Any]:
    """Admissibilité structurée (cahier §4) — sans générer de NIN."""
    from apps.api.domains.core_registry.national_identity_number_service import (
        OFFICIAL_NIN_FORMAT_CONFIRMED,
        NationalIdentityNumberService,
    )

    citizen = await load_citizen_with_addresses(db, citizen_id)
    codes: list[str] = []
    if citizen is None:
        return {
            "citizen_id": str(citizen_id),
            "admissible": False,
            "codes": ["citizen_not_found"],
            "has_nic": False,
            "nin_status": None,
            "official_nin_confirmed": False,
            "dossier_status": None,
            "active_card": False,
            "template_approved": False,
            "production_allowed": False,
        }
    if not citizen.nic:
        codes.append("NIN_NON_CONFIRME")
        codes.append("nic_required")
    if citizen.status != "ACTIVE":
        codes.append("DOSSIER_NON_VALIDE")
        codes.append("dossier_not_validated")

    active = await get_active_card_for_citizen(db, citizen_id)
    if active is not None:
        codes.append("CARTE_ACTIVE_EXISTANTE")

    nin_status = NationalIdentityNumberService.nin_status_for(citizen)
    admissible = not any(
        c in codes
        for c in ("citizen_not_found", "nic_required", "dossier_not_validated", "NIN_NON_CONFIRME", "DOSSIER_NON_VALIDE")
    )
    from apps.api.domains.cards import request_store as rs

    return {
        "citizen_id": str(citizen_id),
        "admissible": admissible,
        "codes": codes,
        "has_nic": bool(citizen.nic),
        "nin_status": nin_status,
        "official_nin_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
        "dossier_status": citizen.status,
        "active_card": active is not None,
        "active_card_id": str(active.card_id) if active else None,
        "template_approved": rs.TEMPLATE_APPROVED,
        "production_allowed": admissible and rs.TEMPLATE_APPROVED,
        "note": (
            "NIC provisoire accepté pour parcours prototype ; "
            "production officielle bloquée (gabarit non homologué)."
        ),
    }


async def create_card_request(
    db: AsyncSession,
    *,
    citizen_id: uuid.UUID,
    request_type: str = "FIRST_ISSUE",
    idempotency_key: str | None = None,
    source_card_id: uuid.UUID | None = None,
    reason: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Crée une demande CIN — n'émet pas la carte, n'invente pas de NIN."""
    from apps.api.domains.cards import request_store as rs

    rt = request_type.strip().upper()
    if rt not in rs.REQUEST_TYPES:
        raise CardEligibilityError(f"request_type invalide: {request_type}", code="invalid_request_type")

    existing = rs.find_by_idempotency(idempotency_key)
    if existing is not None:
        return {**existing, "already_processed": True}

    eligibility = await evaluate_cin_eligibility(db, citizen_id)
    if eligibility.get("dossier_status") is None and "citizen_not_found" in eligibility["codes"]:
        raise CardEligibilityError("Citizen not found", code="citizen_not_found")

    if rt == "FIRST_ISSUE" and eligibility.get("active_card"):
        status = "BLOCKED"
        block = "CARTE_ACTIVE_EXISTANTE"
    elif eligibility["admissible"]:
        status = "ADMISSIBLE"
        block = None
    else:
        status = "BLOCKED"
        block = ",".join(eligibility["codes"]) or "INCOMPLET"

    now = rs._now()
    row = {
        "id": rs.new_id(),
        "citizen_id": str(citizen_id),
        "request_type": rt,
        "status": status,
        "idempotency_key": (idempotency_key or "").strip() or None,
        "source_card_id": str(source_card_id) if source_card_id else None,
        "reason": reason,
        "eligibility": eligibility,
        "block_reason": block,
        "template_version": rs.TEMPLATE_VERSION,
        "preview_valid": False,
        "actor_id": str(actor_id) if actor_id else None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "nin_generated_by_cin": False,
        "already_processed": False,
    }
    return rs.save_request(row)


async def approve_request_for_production(
    request_id: str,
    *,
    motif: str,
    actor_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Approuve pour production — bloquée si gabarit non homologué."""
    from apps.api.domains.cards import request_store as rs

    row = rs.get_request(request_id)
    if row is None:
        raise CardEligibilityError("Demande introuvable", code="request_not_found")
    if row["status"] not in {"ADMISSIBLE", "APPROVED_FOR_PERSONALIZATION"}:
        raise CardEligibilityError(
            f"Statut {row['status']} non approuvable pour production",
            code="invalid_status",
        )
    if not rs.TEMPLATE_APPROVED:
        raise CardEligibilityError(
            "Gabarit prototype non homologué — production officielle refusée",
            code="template_not_approved",
        )
    row["status"] = "APPROVED_FOR_PRODUCTION"
    row["production_motif"] = motif.strip()
    row["updated_at"] = rs._now().isoformat()
    row["actor_id"] = str(actor_id) if actor_id else row.get("actor_id")
    return rs.save_request(row)


async def create_production_batch(
    *,
    request_ids: list[str],
    actor_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Crée un lot — refuse si gabarit non approuvé ou demandes non prêtes."""
    from apps.api.domains.cards import request_store as rs

    if not rs.TEMPLATE_APPROVED:
        raise CardEligibilityError(
            "Création de lot refusée : gabarit non homologué (prototype only)",
            code="template_not_approved",
        )
    if not request_ids:
        raise CardEligibilityError("request_ids requis", code="empty_batch")
    for rid in request_ids:
        req = rs.get_request(rid)
        if req is None:
            raise CardEligibilityError(f"Demande {rid} introuvable", code="request_not_found")
        if req["status"] != "APPROVED_FOR_PRODUCTION":
            raise CardEligibilityError(
                f"Demande {rid} statut {req['status']} — APPROVED_FOR_PRODUCTION requis",
                code="request_not_ready",
            )
    now = rs._now()
    batch = {
        "id": rs.new_id(),
        "status": "CREATED",
        "request_ids": list(request_ids),
        "count": len(request_ids),
        "template_version": rs.TEMPLATE_VERSION,
        "actor_id": str(actor_id) if actor_id else None,
        "created_at": now.isoformat(),
        "released": False,
        "note": "Lot MVP — impression matérielle hors lot",
    }
    for rid in request_ids:
        req = rs.get_request(rid)
        assert req is not None
        req["status"] = "IN_BATCH"
        req["batch_id"] = batch["id"]
        req["updated_at"] = now.isoformat()
        rs.save_request(req)
    return rs.save_batch(batch)


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
    await assert_cin_eligibility(citizen)
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


async def report_stolen(
    db: AsyncSession,
    card_id: uuid.UUID,
    *,
    reason: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> NationalCard:
    """Déclare un vol — historisé ; ne recycle pas le numéro ni le NIN."""
    card = await get_card(db, card_id)
    if card is None:
        raise ValueError("Card not found")
    return await _set_status(
        db,
        card,
        CardStatus.STOLEN,
        CardHistoryEvent.REPORTED_STOLEN,
        actor_id=actor_id,
        payload={"reason": reason, "nin_mutated": False},
    )


async def record_lifecycle_event(
    db: AsyncSession,
    card_id: uuid.UUID,
    *,
    event: str,
    reason: str,
    actor_id: uuid.UUID | None = None,
) -> NationalCard:
    """Événements de cycle de vie (cahier §12) — stubs contrôlés."""
    ev = event.strip().upper()
    if ev in {"LOST", "REPORTED_LOST"}:
        return await report_lost(db, card_id, reason=reason, actor_id=actor_id)
    if ev in {"STOLEN", "REPORTED_STOLEN"}:
        return await report_stolen(db, card_id, reason=reason, actor_id=actor_id)
    if ev in {"REVOKE", "REVOKED", "INVALIDATE"}:
        return await revoke_card(db, card_id, reason=reason, actor_id=actor_id)
    if ev in {"SUSPEND", "SUSPENDED"}:
        return await suspend_card(db, card_id, reason=reason, actor_id=actor_id)
    raise ValueError(f"Événement cycle de vie non supporté: {event}")


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
