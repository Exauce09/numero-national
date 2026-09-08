"""Create endpoints for geography entities with orthography-insensitive dedupe."""

from __future__ import annotations

import uuid
from uuid import UUID

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.geography import models as m
from apps.api.domains.geography.normalize import display_name, normalize_geo_name
from apps.api.domains.geography.seed import ensure_geography_seeded


class CreateDistrictIn(BaseModel):
    province_id: UUID
    name: str = Field(min_length=2, max_length=128)


class CreateCommuneIn(BaseModel):
    ville_id: UUID
    name: str = Field(min_length=2, max_length=128)
    district_id: UUID | None = None


class CreateLocaliteIn(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    district_id: UUID | None = None
    commune_id: UUID | None = None


class CreateQuartierIn(BaseModel):
    commune_id: UUID
    name: str = Field(min_length=2, max_length=128)


class CreateVoieIn(BaseModel):
    quartier_id: UUID
    name: str = Field(min_length=2, max_length=128)
    voie_type: str = Field(description="AVENUE or RUE")


def _slug(name: str) -> str:
    key = normalize_geo_name(name) or "x"
    return key.upper()[:20]


def _code(prefix: str, name: str) -> str:
    return f"{prefix}-{_slug(name)}-{uuid.uuid4().hex[:6]}".upper()[:64]


def _dup_detail(existing_name: str) -> str:
    return (
        f"Entrée déjà existante : « {existing_name} ». "
        "Impossible d'ajouter un doublon (même orthographe ou variante)."
    )


def register_create_routes(router, GeoItem, VoieOut) -> None:
    @router.post("/districts", response_model=GeoItem, status_code=201)
    async def create_district(body: CreateDistrictIn, db: AsyncSession = Depends(get_db)) -> GeoItem:
        await ensure_geography_seeded(db)
        if await db.get(m.Province, body.province_id) is None:
            raise HTTPException(404, "Province introuvable")
        name = display_name(body.name)
        key = normalize_geo_name(name)
        if not key:
            raise HTTPException(400, "Nom invalide")
        rows = (
            await db.execute(select(m.District).where(m.District.province_id == body.province_id))
        ).scalars().all()
        for row in rows:
            if normalize_geo_name(row.name) == key:
                raise HTTPException(409, _dup_detail(row.name))
        row = m.District(province_id=body.province_id, code=_code("D", name), name=name)
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return GeoItem.model_validate(row)

    @router.post("/communes", response_model=GeoItem, status_code=201)
    async def create_commune(body: CreateCommuneIn, db: AsyncSession = Depends(get_db)) -> GeoItem:
        await ensure_geography_seeded(db)
        ville = await db.get(m.Ville, body.ville_id)
        if ville is None:
            raise HTTPException(404, "Ville introuvable")
        name = display_name(body.name)
        key = normalize_geo_name(name)
        if not key:
            raise HTTPException(400, "Nom invalide")
        sibling_villes = (
            await db.execute(select(m.Ville.id).where(m.Ville.province_id == ville.province_id))
        ).scalars().all()
        peers = (
            await db.execute(select(m.Commune).where(m.Commune.ville_id.in_(list(sibling_villes))))
        ).scalars().all()
        for row in peers:
            if normalize_geo_name(row.name) == key:
                raise HTTPException(409, _dup_detail(row.name))
        row = m.Commune(
            ville_id=body.ville_id,
            district_id=body.district_id,
            code=_code("C", name),
            name=name,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return GeoItem.model_validate(row)

    @router.post("/localites", response_model=GeoItem, status_code=201)
    async def create_localite(body: CreateLocaliteIn, db: AsyncSession = Depends(get_db)) -> GeoItem:
        await ensure_geography_seeded(db)
        if not body.district_id and not body.commune_id:
            raise HTTPException(400, "district_id ou commune_id requis")
        name = display_name(body.name)
        key = normalize_geo_name(name)
        if not key:
            raise HTTPException(400, "Nom invalide")
        stmt = select(m.Localite)
        if body.commune_id:
            stmt = stmt.where(m.Localite.commune_id == body.commune_id)
        elif body.district_id:
            stmt = stmt.where(m.Localite.district_id == body.district_id)
        for row in (await db.execute(stmt)).scalars().all():
            if normalize_geo_name(row.name) == key:
                raise HTTPException(409, _dup_detail(row.name))
        row = m.Localite(
            district_id=body.district_id,
            commune_id=body.commune_id,
            code=_code("L", name),
            name=name,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return GeoItem.model_validate(row)

    @router.post("/quartiers", response_model=GeoItem, status_code=201)
    async def create_quartier(body: CreateQuartierIn, db: AsyncSession = Depends(get_db)) -> GeoItem:
        await ensure_geography_seeded(db)
        if await db.get(m.Commune, body.commune_id) is None:
            raise HTTPException(404, "Commune introuvable")
        name = display_name(body.name)
        key = normalize_geo_name(name)
        if not key:
            raise HTTPException(400, "Nom invalide")
        rows = (
            await db.execute(select(m.Quartier).where(m.Quartier.commune_id == body.commune_id))
        ).scalars().all()
        for row in rows:
            if normalize_geo_name(row.name) == key:
                raise HTTPException(409, _dup_detail(row.name))
        row = m.Quartier(commune_id=body.commune_id, code=_code("Q", name), name=name)
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return GeoItem.model_validate(row)

    @router.post("/voies", response_model=VoieOut, status_code=201)
    async def create_voie(body: CreateVoieIn, db: AsyncSession = Depends(get_db)) -> VoieOut:
        await ensure_geography_seeded(db)
        vt = body.voie_type.upper().strip()
        if vt not in {"AVENUE", "RUE"}:
            raise HTTPException(400, "voie_type doit être AVENUE ou RUE")
        if await db.get(m.Quartier, body.quartier_id) is None:
            raise HTTPException(404, "Quartier introuvable")
        name = display_name(body.name)
        key = normalize_geo_name(name)
        if not key:
            raise HTTPException(400, "Nom invalide")
        rows = (
            await db.execute(select(m.Voie).where(m.Voie.quartier_id == body.quartier_id))
        ).scalars().all()
        for row in rows:
            if normalize_geo_name(row.name) == key:
                raise HTTPException(409, _dup_detail(f"{row.voie_type} {row.name}"))
        row = m.Voie(
            quartier_id=body.quartier_id,
            code=_code(vt[:3], name),
            name=name,
            voie_type=vt,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return VoieOut.model_validate(row)
