"""HTTP routes — /api/v1/geo cascading selects."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.geography import models as m
from apps.api.domains.geography.seed import ensure_geography_seeded

router = APIRouter(prefix="/geo", tags=["geography"])


class GeoItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str


class ProvinceOut(GeoItem):
    chef_lieu: str


class VilleOut(GeoItem):
    is_chef_lieu: bool = False


class VoieOut(GeoItem):
    voie_type: str


@router.post("/seed", summary="Idempotent seed of RDC geography")
async def seed_geo(db: AsyncSession = Depends(get_db)) -> dict:
    counts = await ensure_geography_seeded(db)
    return {"status": "ok", "counts": counts}


@router.get("/provinces", response_model=list[ProvinceOut])
async def list_provinces(db: AsyncSession = Depends(get_db)) -> list[ProvinceOut]:
    await ensure_geography_seeded(db)
    rows = (await db.execute(select(m.Province).order_by(m.Province.name))).scalars().all()
    return [ProvinceOut.model_validate(r) for r in rows]


@router.get("/districts", response_model=list[GeoItem])
async def list_districts(
    province_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[GeoItem]:
    await ensure_geography_seeded(db)
    rows = (
        await db.execute(
            select(m.District).where(m.District.province_id == province_id).order_by(m.District.name)
        )
    ).scalars().all()
    return [GeoItem.model_validate(r) for r in rows]


@router.get("/villes", response_model=list[VilleOut])
async def list_villes(
    province_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[VilleOut]:
    await ensure_geography_seeded(db)
    rows = (
        await db.execute(
            select(m.Ville).where(m.Ville.province_id == province_id).order_by(m.Ville.name)
        )
    ).scalars().all()
    return [VilleOut.model_validate(r) for r in rows]


@router.get("/communes", response_model=list[GeoItem])
async def list_communes(
    ville_id: UUID | None = None,
    district_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[GeoItem]:
    await ensure_geography_seeded(db)
    stmt = select(m.Commune)
    if ville_id:
        stmt = stmt.where(m.Commune.ville_id == ville_id)
    if district_id:
        stmt = stmt.where(m.Commune.district_id == district_id)
    stmt = stmt.order_by(m.Commune.name)
    rows = (await db.execute(stmt)).scalars().all()
    return [GeoItem.model_validate(r) for r in rows]


@router.get("/quartiers", response_model=list[GeoItem])
async def list_quartiers(
    commune_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[GeoItem]:
    await ensure_geography_seeded(db)
    rows = (
        await db.execute(
            select(m.Quartier).where(m.Quartier.commune_id == commune_id).order_by(m.Quartier.name)
        )
    ).scalars().all()
    return [GeoItem.model_validate(r) for r in rows]


@router.get("/localites", response_model=list[GeoItem])
async def list_localites(
    district_id: UUID | None = None,
    commune_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[GeoItem]:
    await ensure_geography_seeded(db)
    stmt = select(m.Localite)
    if district_id:
        stmt = stmt.where(m.Localite.district_id == district_id)
    if commune_id:
        stmt = stmt.where(m.Localite.commune_id == commune_id)
    stmt = stmt.order_by(m.Localite.name)
    rows = (await db.execute(stmt)).scalars().all()
    return [GeoItem.model_validate(r) for r in rows]


@router.get("/voies", response_model=list[VoieOut])
async def list_voies(
    quartier_id: UUID = Query(...),
    voie_type: str | None = Query(None, description="AVENUE or RUE"),
    db: AsyncSession = Depends(get_db),
) -> list[VoieOut]:
    await ensure_geography_seeded(db)
    stmt = select(m.Voie).where(m.Voie.quartier_id == quartier_id)
    if voie_type:
        stmt = stmt.where(m.Voie.voie_type == voie_type.upper())
    stmt = stmt.order_by(m.Voie.voie_type, m.Voie.name)
    rows = (await db.execute(stmt)).scalars().all()
    return [VoieOut.model_validate(r) for r in rows]
