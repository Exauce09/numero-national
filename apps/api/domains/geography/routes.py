"""HTTP routes — /api/v1/geo cascading selects."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.db.session import get_db
from apps.api.domains.geography import models as m
from apps.api.domains.geography.create_routes import register_create_routes
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


@router.post("/seed", summary="Seed / refresh RDC geography (force=true pour recharger)")
async def seed_geo(
    force: bool = Query(False, description="Supprime et recharge tout le référentiel"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    counts = await ensure_geography_seeded(db, force=force)
    return {"status": "ok", "counts": counts}


@router.get("/tribus", summary="Liste de référence des tribus / ethnies RDC")
async def list_tribus(q: str | None = Query(None, description="Filtre optionnel")) -> dict:
    """~300+ entrées de référence. Total réel RDC ≈ 250–450 selon critères."""
    from apps.api.domains.geography.tribus_data import RDC_TRIBUS

    rows = RDC_TRIBUS
    if q and q.strip():
        needle = q.strip().casefold()
        rows = [t for t in rows if needle in t.casefold()]
    return {
        "count": len(rows),
        "total_reference": len(RDC_TRIBUS),
        "note": (
            "La RDC compte environ 250 à 450 ethnies/tribus selon les critères. "
            "Cette liste est une référence opérationnelle ; utilisez « Autre » si besoin."
        ),
        "items": rows,
    }


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
    province_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[GeoItem]:
    await ensure_geography_seeded(db)
    stmt = select(m.Commune)
    if ville_id:
        stmt = stmt.where(m.Commune.ville_id == ville_id)
    if district_id:
        stmt = stmt.where(m.Commune.district_id == district_id)
    if province_id:
        stmt = stmt.join(m.Ville, m.Commune.ville_id == m.Ville.id).where(
            m.Ville.province_id == province_id
        )
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


class TreeVoie(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    voie_type: str


class TreeQuartier(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    voies: list[TreeVoie] = []


class TreeLocalite(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str


class TreeCommune(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    quartiers: list[TreeQuartier] = []
    localites: list[TreeLocalite] = []


class TreeDistrict(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    communes: list[TreeCommune] = []
    localites: list[TreeLocalite] = []


class TreeVille(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    is_chef_lieu: bool
    communes: list[TreeCommune] = []


class ProvinceTree(BaseModel):
    id: UUID
    code: str
    name: str
    chef_lieu: str
    districts: list[TreeDistrict]
    villes: list[TreeVille]
    counts: dict[str, int]


@router.get("/provinces/{province_id}/tree", response_model=ProvinceTree)
async def province_tree(province_id: UUID, db: AsyncSession = Depends(get_db)) -> ProvinceTree:
    """Toutes les infos liées à une province (villes, districts, communes, quartiers, voies…)."""
    await ensure_geography_seeded(db)

    stmt = (
        select(m.Province)
        .where(m.Province.id == province_id)
        .options(
            selectinload(m.Province.districts)
            .selectinload(m.District.communes)
            .selectinload(m.Commune.quartiers)
            .selectinload(m.Quartier.voies),
            selectinload(m.Province.districts).selectinload(m.District.localites),
            selectinload(m.Province.districts)
            .selectinload(m.District.communes)
            .selectinload(m.Commune.localites),
            selectinload(m.Province.villes)
            .selectinload(m.Ville.communes)
            .selectinload(m.Commune.quartiers)
            .selectinload(m.Quartier.voies),
            selectinload(m.Province.villes)
            .selectinload(m.Ville.communes)
            .selectinload(m.Commune.localites),
        )
    )
    prov = (await db.execute(stmt)).scalar_one_or_none()
    if prov is None:
        raise HTTPException(status_code=404, detail="Province introuvable")

    districts = [TreeDistrict.model_validate(d) for d in prov.districts]
    villes = [TreeVille.model_validate(v) for v in prov.villes]
    n_communes = sum(len(v.communes) for v in villes)
    n_quartiers = sum(len(c.quartiers) for v in villes for c in v.communes)
    n_voies = sum(len(q.voies) for v in villes for c in v.communes for q in c.quartiers)
    n_localites = sum(len(d.localites) for d in districts) + sum(
        len(c.localites) for v in villes for c in v.communes
    )
    return ProvinceTree(
        id=prov.id,
        code=prov.code,
        name=prov.name,
        chef_lieu=prov.chef_lieu,
        districts=districts,
        villes=villes,
        counts={
            "districts": len(districts),
            "villes": len(villes),
            "communes": n_communes,
            "quartiers": n_quartiers,
            "localites": n_localites,
            "voies": n_voies,
        },
    )


register_create_routes(router, GeoItem, VoieOut)
