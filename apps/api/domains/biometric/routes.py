"""Biometric routes — `/api/v1/biometric`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.biometric import service
from apps.api.domains.biometric.schemas import (
    DedupSessionOut,
    IdentifyRequest,
    IdentifyResponse,
    MediaRefCreate,
    MediaRefOut,
    TemplateEnroll,
    TemplateOut,
    VerifyRequest,
    VerifyResponse,
)

router = APIRouter(prefix="/biometric", tags=["biometric"])


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def enroll_template(body: TemplateEnroll, db: AsyncSession = Depends(get_db)) -> TemplateOut:
    return await service.enroll_template(db, body)  # type: ignore[return-value]


@router.post("/verify", response_model=VerifyResponse)
async def verify_1to1(body: VerifyRequest, db: AsyncSession = Depends(get_db)) -> VerifyResponse:
    """1:1 verify — MVP hash stub; production uses ABIS."""
    return await service.verify_1to1(db, body)


@router.post("/identify", response_model=IdentifyResponse)
async def identify_1to_n(
    body: IdentifyRequest, db: AsyncSession = Depends(get_db)
) -> IdentifyResponse:
    """1:N identify — MVP hash stub; production uses ABIS."""
    return await service.identify_1to_n(db, body)


@router.post("/media", response_model=MediaRefOut, status_code=status.HTTP_201_CREATED)
async def register_media(body: MediaRefCreate, db: AsyncSession = Depends(get_db)) -> MediaRefOut:
    return await service.register_media(db, body)  # type: ignore[return-value]


@router.get("/dedup/{session_id}", response_model=DedupSessionOut)
async def get_dedup_session(
    session_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> DedupSessionOut:
    row = await service.get_dedup_session(db, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Dedup session not found")
    return row  # type: ignore[return-value]
