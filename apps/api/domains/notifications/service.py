"""Notification service stub — providers (email/SMS/push) wired later."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)

logger = logging.getLogger(__name__)


async def enqueue(
    db: AsyncSession,
    *,
    channel: NotificationChannel,
    recipient: str,
    body: str,
    subject: str | None = None,
    meta: dict | None = None,
) -> Notification:
    row = Notification(
        channel=channel,
        recipient=recipient,
        subject=subject,
        body=body,
        meta=meta,
        status=NotificationStatus.PENDING,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    logger.info("notification_enqueued id=%s channel=%s", row.id, channel.value)
    return row


async def send_stub(db: AsyncSession, notification_id: uuid.UUID) -> Notification | None:
    row = await db.get(Notification, notification_id)
    if not row:
        return None
    # Future: SES / SMS gateway / FCM. Mark as SENT for MVP observability.
    row.status = NotificationStatus.SENT
    row.sent_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    logger.info("notification_sent_stub id=%s", row.id)
    return row


async def list_pending(db: AsyncSession, limit: int = 50) -> list[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.status == NotificationStatus.PENDING)
        .order_by(Notification.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())
