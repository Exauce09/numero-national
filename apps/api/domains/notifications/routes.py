"""Internal notification routes — `/api/v1/internal/notifications`."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.notifications import service
from apps.api.domains.notifications.models import NotificationChannel, NotificationStatus

router = APIRouter(prefix="/internal/notifications", tags=["notifications-internal"])


class EnqueueRequest(BaseModel):
    channel: NotificationChannel
    recipient: str
    body: str
    subject: str | None = None
    meta: dict[str, Any] | None = None


class NotificationOut(BaseModel):
    id: uuid.UUID
    channel: NotificationChannel
    recipient: str
    subject: str | None
    status: NotificationStatus
    created_at: datetime
    sent_at: datetime | None

    model_config = {"from_attributes": True}


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def enqueue_notification(
    body: EnqueueRequest, db: AsyncSession = Depends(get_db)
) -> NotificationOut:
    return await service.enqueue(  # type: ignore[return-value]
        db,
        channel=body.channel,
        recipient=body.recipient,
        body=body.body,
        subject=body.subject,
        meta=body.meta,
    )


@router.post("/{notification_id}/send", response_model=NotificationOut)
async def send_notification(
    notification_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> NotificationOut:
    row = await service.send_stub(db, notification_id)
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return row  # type: ignore[return-value]


@router.get("/pending", response_model=list[NotificationOut])
async def list_pending(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationOut]:
    return await service.list_pending(db, limit)  # type: ignore[return-value]
