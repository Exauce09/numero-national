"""Health routes — `/api/v1/health` (domain; distinct from GET /health probe)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.health import service
from apps.api.domains.health.schemas import (
    BirthDeclare,
    BirthNotificationOut,
    DeathDeclare,
    DeathNotificationOut,
    FacilityCreate,
    FacilityOut,
    VerifyIdentityRequest,
    VerifyIdentityResponse,
)

router = APIRouter(prefix="/health", tags=["health-domain"])


@router.post("/facilities", response_model=FacilityOut, status_code=status.HTTP_201_CREATED)
async def create_facility(body: FacilityCreate, db: AsyncSession = Depends(get_db)) -> FacilityOut:
    return await service.create_facility(db, body)  # type: ignore[return-value]


@router.post("/verify-identity", response_model=VerifyIdentityResponse)
async def verify_identity(
    body: VerifyIdentityRequest, db: AsyncSession = Depends(get_db)
) -> VerifyIdentityResponse:
    return await service.verify_identity_stub(db, body)


@router.post(
    "/births/declare",
    response_model=BirthNotificationOut,
    status_code=status.HTTP_201_CREATED,
)
async def declare_birth(
    body: BirthDeclare, db: AsyncSession = Depends(get_db)
) -> BirthNotificationOut:
    return await service.declare_birth(db, body)  # type: ignore[return-value]


@router.post(
    "/deaths/declare",
    response_model=DeathNotificationOut,
    status_code=status.HTTP_201_CREATED,
)
async def declare_death(
    body: DeathDeclare, db: AsyncSession = Depends(get_db)
) -> DeathNotificationOut:
    return await service.declare_death(db, body)  # type: ignore[return-value]


@router.get("/facilities")
async def list_facilities(db: AsyncSession = Depends(get_db)) -> list[FacilityOut]:
    rows = await service.list_facilities(db)
    return [FacilityOut.model_validate(r) for r in rows]


@router.get("/stats/national")
async def national_health_stats(db: AsyncSession = Depends(get_db)) -> dict:
    """Statistiques santé nationales agrégées et anonymisées (Ministère de la Santé)."""
    return await service.health_national_stats(db)
