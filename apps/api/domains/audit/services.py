"""Append-only audit writer — no update/delete APIs by design."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.audit.models import AuditEvent


async def write_audit(
    db: AsyncSession,
    *,
    action: str,
    result: str = "success",
    actor_id: UUID | None = None,
    institution_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip: str | None = None,
    device: str | None = None,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
    justification: str | None = None,
    commit: bool = True,
) -> AuditEvent:
    """Persist a new audit event. Never mutate or delete existing rows."""
    event = AuditEvent(
        actor_id=actor_id,
        institution_id=institution_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip=ip,
        device=device,
        result=result,
        old_value=old_value,
        new_value=new_value,
        justification=justification,
    )
    db.add(event)
    if commit:
        await db.commit()
        await db.refresh(event)
    else:
        await db.flush()
    return event


async def list_audit_events(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[AuditEvent], int]:
    """Paginated read of audit events (newest first)."""
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    total = await db.scalar(select(func.count()).select_from(AuditEvent)) or 0
    result = await db.execute(
        select(AuditEvent)
        .order_by(AuditEvent.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), int(total)
