"""Citizen portal routes — /api/v1/me/*."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.cards.qr import build_qr_payload
from apps.api.domains.cards.schemas import CardRead
from apps.api.domains.citizen_portal.deps import get_current_citizen_id
from apps.api.domains.citizen_portal.schemas import (
    AccessLogEntry,
    CorrectionRequestCreate,
    CorrectionRequestRead,
    IdentitySummary,
)
from apps.api.domains.citizen_portal import services
from apps.api.domains.documents.schemas import DocumentRead

router = APIRouter(prefix="/me", tags=["citizen-portal"])


class ReportLostBody(BaseModel):
    reason: str | None = None


@router.get("/identity", response_model=IdentitySummary)
async def me_identity(
    citizen_id: UUID = Depends(get_current_citizen_id),
    db: AsyncSession = Depends(get_db),
) -> IdentitySummary:
    return await services.identity_summary(db, citizen_id)


@router.get("/card", response_model=CardRead | None)
async def me_card(
    citizen_id: UUID = Depends(get_current_citizen_id),
    db: AsyncSession = Depends(get_db),
) -> CardRead | None:
    card = await services.citizen_card(db, citizen_id)
    if card is None:
        return None
    read = CardRead.model_validate(card)
    read.qr_payload = build_qr_payload(card.card_id, card.version)
    return read


@router.get("/documents", response_model=list[DocumentRead])
async def me_documents(
    limit: int = Query(50, ge=1, le=200),
    citizen_id: UUID = Depends(get_current_citizen_id),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentRead]:
    rows = await services.citizen_documents(db, citizen_id, limit=limit)
    return [DocumentRead.model_validate(r) for r in rows]


@router.get("/access-log", response_model=list[AccessLogEntry])
async def me_access_log(
    limit: int = Query(50, ge=1, le=200),
    citizen_id: UUID = Depends(get_current_citizen_id),
    db: AsyncSession = Depends(get_db),
) -> list[AccessLogEntry]:
    """Data tracker — audit events touching this citizen resource."""
    return await services.access_log(db, citizen_id, limit=limit)


@router.post("/card/report-lost", response_model=CardRead)
async def me_report_lost(
    body: ReportLostBody | None = None,
    citizen_id: UUID = Depends(get_current_citizen_id),
    db: AsyncSession = Depends(get_db),
) -> CardRead:
    try:
        card = await services.report_card_lost(
            db, citizen_id, reason=body.reason if body else None
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    read = CardRead.model_validate(card)
    read.qr_payload = build_qr_payload(card.card_id, card.version)
    return read


@router.post("/correction-request", response_model=CorrectionRequestRead, status_code=201)
async def me_correction_request(
    body: CorrectionRequestCreate,
    citizen_id: UUID = Depends(get_current_citizen_id),
    db: AsyncSession = Depends(get_db),
) -> CorrectionRequestRead:
    req = await services.submit_correction(db, citizen_id, body)
    return CorrectionRequestRead.model_validate(req)
