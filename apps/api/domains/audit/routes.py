"""Audit HTTP routes — admin read only."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.security import require_permissions
from apps.api.db.session import get_db
from apps.api.domains.audit.schemas import AuditEventList, AuditEventRead
from apps.api.domains.audit.services import list_audit_events

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get(
    "",
    response_model=AuditEventList,
    summary="List audit events (admin)",
    dependencies=[Depends(require_permissions("audit:read"))],
)
async def get_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> AuditEventList:
    items, total = await list_audit_events(db, page=page, page_size=page_size)
    return AuditEventList(
        items=[AuditEventRead.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
    )
