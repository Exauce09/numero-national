"""ONIP routes — `/api/v1/onip/dashboard`."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.onip import service

router = APIRouter(prefix="/onip", tags=["onip"])


@router.get("/dashboard")
async def onip_dashboard(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """National operations aggregates for ONIP operators."""
    return await service.build_dashboard(db)


@router.get("/map-points")
async def onip_map_points(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GPS points of registered households for cartography."""
    return await service.list_map_points(db)
