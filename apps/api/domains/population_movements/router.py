"""HTTP Module 12 — `/api/v1/population-movements`."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_CITIZEN_VALIDATE,
    PERM_ONIP_DASHBOARD,
    Principal,
    require_permissions,
)
from apps.api.db.session import get_db
from apps.api.domains.population_movements import service as mv
from apps.api.domains.population_movements.schemas import (
    MovementApproveIn,
    MovementCorrectIn,
    MovementCreate,
    MovementListOut,
    MovementOut,
    MovementPatch,
    MovementReviewIn,
    MovementStatsOut,
)

router = APIRouter(tags=["population-movements-module-12"])


@router.get("/population-movements/catalog")
async def catalog(
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> dict[str, Any]:
    return mv.movements_catalog()


@router.get("/population-movements/stats", response_model=MovementStatsOut)
async def movement_stats(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> MovementStatsOut:
    return await mv.stats(db)


@router.get("/population-movements", response_model=MovementListOut)
async def list_movements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    movement_type: str | None = Query(default=None),
    citizen_id: UUID | None = Query(default=None),
    province_code: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> MovementListOut:
    return await mv.list_movements(
        db,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
        movement_type=movement_type,
        citizen_id=citizen_id,
        province_code=province_code,
    )


@router.post("/population-movements", response_model=MovementOut, status_code=201)
async def create_movement(
    body: MovementCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> MovementOut:
    try:
        out = await mv.create_movement(db, body, actor_id=principal.actor_id)
    except mv.MovementError as exc:
        raise mv.http_exc(exc) from exc
    await db.commit()
    return out


@router.get("/population-movements/{movement_id}", response_model=MovementOut)
async def get_movement(
    movement_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> MovementOut:
    try:
        return await mv.get_movement(db, movement_id)
    except mv.MovementError as exc:
        raise mv.http_exc(exc) from exc


@router.patch("/population-movements/{movement_id}", response_model=MovementOut)
async def patch_movement(
    movement_id: UUID,
    body: MovementPatch,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> MovementOut:
    try:
        out = await mv.patch_movement(db, movement_id, body, actor_id=principal.actor_id)
    except mv.MovementError as exc:
        raise mv.http_exc(exc) from exc
    await db.commit()
    return out


@router.post("/population-movements/{movement_id}/submit", response_model=MovementOut)
async def submit_movement(
    movement_id: UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> MovementOut:
    try:
        out = await mv.submit_movement(db, movement_id, actor_id=principal.actor_id)
    except mv.MovementError as exc:
        raise mv.http_exc(exc) from exc
    await db.commit()
    return out


@router.post("/population-movements/{movement_id}/review", response_model=MovementOut)
async def review_movement(
    movement_id: UUID,
    body: MovementReviewIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> MovementOut:
    try:
        out = await mv.review_movement(db, movement_id, body, actor_id=principal.actor_id)
    except mv.MovementError as exc:
        raise mv.http_exc(exc) from exc
    await db.commit()
    return out


@router.post("/population-movements/{movement_id}/approve", response_model=MovementOut)
async def approve_movement(
    movement_id: UUID,
    body: MovementApproveIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(
        require_permissions(PERM_ONIP_DASHBOARD, PERM_CITIZEN_VALIDATE)
    ),
) -> MovementOut:
    try:
        out = await mv.approve_movement(db, movement_id, body, actor_id=principal.actor_id)
    except mv.MovementError as exc:
        raise mv.http_exc(exc) from exc
    await db.commit()
    return out


@router.post("/population-movements/{movement_id}/correct", response_model=MovementOut)
async def correct_movement(
    movement_id: UUID,
    body: MovementCorrectIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(
        require_permissions(PERM_ONIP_DASHBOARD, PERM_CITIZEN_VALIDATE)
    ),
) -> MovementOut:
    try:
        out = await mv.correct_movement(db, movement_id, body, actor_id=principal.actor_id)
    except mv.MovementError as exc:
        raise mv.http_exc(exc) from exc
    await db.commit()
    return out
