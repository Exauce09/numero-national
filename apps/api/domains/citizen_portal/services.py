"""Citizen portal aggregation services."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.cards.models import DigitalIdentity, NationalCard
from apps.api.domains.cards.services import get_active_card_for_citizen, report_lost
from apps.api.domains.citizen_portal.schemas import (
    AccessLogEntry,
    CorrectionRequestCreate,
    IdentitySummary,
)
from apps.api.domains.documents.models import Document
from apps.api.domains.etat_civil.models import CorrectionRequest

logger = logging.getLogger(__name__)


async def identity_summary(db: AsyncSession, citizen_id: uuid.UUID) -> IdentitySummary:
    nic = given = family = status = None
    try:
        from apps.api.domains.core_registry.models import Citizen

        citizen = await db.get(Citizen, citizen_id)
        if citizen:
            nic = citizen.nic
            given = citizen.given_names
            family = citizen.family_name
            status = citizen.status
    except Exception as exc:  # noqa: BLE001
        logger.debug("core_registry unavailable for identity summary: %s", exc)

    di = (
        await db.execute(
            select(DigitalIdentity).where(DigitalIdentity.citizen_id == citizen_id)
        )
    ).scalar_one_or_none()
    card = await get_active_card_for_citizen(db, citizen_id)

    return IdentitySummary(
        citizen_id=citizen_id,
        nic=nic,
        given_names=given,
        family_name=family,
        status=status,
        digital_identity_status=di.status if di else None,
        card_status=card.status if card else None,
    )


async def citizen_card(db: AsyncSession, citizen_id: uuid.UUID) -> NationalCard | None:
    return await get_active_card_for_citizen(db, citizen_id)


async def citizen_documents(
    db: AsyncSession, citizen_id: uuid.UUID, *, limit: int = 50
) -> list[Document]:
    stmt = (
        select(Document)
        .where(Document.citizen_id == citizen_id)
        .order_by(Document.created_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def access_log(
    db: AsyncSession, citizen_id: uuid.UUID, *, limit: int = 50
) -> list[AccessLogEntry]:
    """
    Data tracker — reads audit events filtered by citizen resource.

    Soft-depends on audit.AuditEvent when Phase 1 IAM is present.
    """
    entries: list[AccessLogEntry] = []
    try:
        from apps.api.domains.audit.models import AuditEvent

        stmt = (
            select(AuditEvent)
            .where(AuditEvent.resource_id == str(citizen_id))
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
        # Also match resource_type containing citizen
        rows = (await db.execute(stmt)).scalars().all()
        for ev in rows:
            entries.append(
                AccessLogEntry(
                    id=getattr(ev, "id", None),
                    action=getattr(ev, "action", None),
                    resource_type=getattr(ev, "resource_type", None),
                    resource_id=getattr(ev, "resource_id", None),
                    actor_id=str(ev.actor_id) if getattr(ev, "actor_id", None) else None,
                    institution_id=str(ev.institution_id)
                    if getattr(ev, "institution_id", None)
                    else None,
                    result=getattr(ev, "result", None),
                    created_at=getattr(ev, "created_at", None),
                    source="audit",
                )
            )
    except Exception as exc:  # noqa: BLE001
        logger.info("audit domain unavailable for access-log: %s", exc)
        # Fallback: card history as access-ish events
        try:
            from apps.api.domains.cards.models import CardHistory

            cards = (
                await db.execute(
                    select(NationalCard.card_id).where(NationalCard.citizen_id == citizen_id)
                )
            ).scalars().all()
            if cards:
                hist = (
                    await db.execute(
                        select(CardHistory)
                        .where(CardHistory.card_id.in_(list(cards)))
                        .order_by(CardHistory.created_at.desc())
                        .limit(limit)
                    )
                ).scalars().all()
                for h in hist:
                    entries.append(
                        AccessLogEntry(
                            id=h.id,
                            action=h.event_type,
                            resource_type="national_card",
                            resource_id=str(h.card_id),
                            actor_id=str(h.actor_id) if h.actor_id else None,
                            result="RECORDED",
                            created_at=h.created_at,
                            source="card_history_fallback",
                        )
                    )
        except Exception as inner:  # noqa: BLE001
            logger.debug("card history fallback failed: %s", inner)
    return entries


async def report_card_lost(
    db: AsyncSession, citizen_id: uuid.UUID, *, reason: str | None = None
) -> NationalCard:
    card = await get_active_card_for_citizen(db, citizen_id)
    if card is None:
        raise ValueError("No active card for citizen")
    return await report_lost(db, card.card_id, reason=reason or "citizen_portal_report")


async def submit_correction(
    db: AsyncSession, citizen_id: uuid.UUID, body: CorrectionRequestCreate
) -> CorrectionRequest:
    req = CorrectionRequest(
        citizen_id=citizen_id,
        field_name=body.field_name,
        current_value=body.current_value,
        requested_value=body.requested_value,
        justification=body.justification,
        status="SUBMITTED",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req
