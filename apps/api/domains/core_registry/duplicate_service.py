"""Demographic duplicate detection for Core Registry.

Doublon = même nom + prénom + province + territoire + sexe + année de naissance.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.domains.core_registry.enums import DuplicateMatchMethod, DuplicateStatus
from apps.api.domains.core_registry.models import Citizen, DuplicateCandidate

EXACT_DEMOGRAPHIC_SCORE = 1.0


def _ordered_pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (a, b) if a.bytes < b.bytes else (b, a)


def _primary_geo(citizen: Citizen) -> tuple[str | None, str | None]:
    """(province_code, territory_key) depuis l'adresse principale."""
    primary = None
    for addr in citizen.addresses or []:
        if addr.is_primary:
            primary = addr
            break
    if primary is None and citizen.addresses:
        primary = citizen.addresses[0]
    if primary is None:
        return None, None
    territory = (primary.commune_code or primary.city or "").strip().upper() or None
    province = (primary.province_code or "").strip().upper() or None
    return province, territory


def _geo_equal(
    a_prov: str | None,
    a_terr: str | None,
    b_prov: str | None,
    b_terr: str | None,
) -> bool:
    return (a_prov or "") == (b_prov or "") and (a_terr or "") == (b_terr or "")


async def find_demographic_matches(
    session: AsyncSession,
    *,
    family_name: str,
    given_names: str,
    sex: str,
    date_of_birth: date,
    province_code: str | None,
    territory_key: str | None,
    exclude_citizen_id: uuid.UUID | None = None,
) -> list[Citizen]:
    """Match : nom, prénom, sexe, année naissance, province, territoire."""
    birth_year = date_of_birth.year
    sex_key = (sex or "").strip().upper()
    stmt = (
        select(Citizen)
        .options(selectinload(Citizen.addresses))
        .where(
            and_(
                func.lower(Citizen.family_name) == family_name.strip().lower(),
                func.lower(Citizen.given_names) == given_names.strip().lower(),
                func.upper(Citizen.sex) == sex_key,
                extract("year", Citizen.date_of_birth) == birth_year,
            )
        )
    )
    if exclude_citizen_id is not None:
        stmt = stmt.where(Citizen.id != exclude_citizen_id)
    result = await session.scalars(stmt)
    candidates = list(result.all())
    return [
        c
        for c in candidates
        if _geo_equal(province_code, territory_key, *_primary_geo(c))
    ]


async def record_duplicate_candidates(
    session: AsyncSession,
    *,
    citizen_id: uuid.UUID,
    matches: list[Citizen],
    score: float = EXACT_DEMOGRAPHIC_SCORE,
) -> list[DuplicateCandidate]:
    created: list[DuplicateCandidate] = []
    for other in matches:
        a_id, b_id = _ordered_pair(citizen_id, other.id)
        existing = await session.scalar(
            select(DuplicateCandidate).where(
                DuplicateCandidate.citizen_a_id == a_id,
                DuplicateCandidate.citizen_b_id == b_id,
            )
        )
        if existing is not None:
            continue
        row = DuplicateCandidate(
            citizen_a_id=a_id,
            citizen_b_id=b_id,
            score=score,
            status=DuplicateStatus.OPEN.value,
            match_method=DuplicateMatchMethod.DEMOGRAPHIC.value,
        )
        session.add(row)
        created.append(row)
    return created


async def check_and_record_duplicates(
    session: AsyncSession,
    citizen: Citizen,
) -> list[DuplicateCandidate]:
    # Assure addresses chargées
    if not getattr(citizen, "addresses", None):
        loaded = await session.scalar(
            select(Citizen)
            .options(selectinload(Citizen.addresses))
            .where(Citizen.id == citizen.id)
        )
        if loaded is not None:
            citizen = loaded
    province, territory = _primary_geo(citizen)
    matches = await find_demographic_matches(
        session,
        family_name=citizen.family_name,
        given_names=citizen.given_names,
        sex=citizen.sex,
        date_of_birth=citizen.date_of_birth,
        province_code=province,
        territory_key=territory,
        exclude_citizen_id=citizen.id,
    )
    return await record_duplicate_candidates(
        session,
        citizen_id=citizen.id,
        matches=matches,
    )


async def mark_pair_merged(
    session: AsyncSession,
    *,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
) -> None:
    a_id, b_id = _ordered_pair(source_id, target_id)
    rows = await session.scalars(
        select(DuplicateCandidate).where(
            or_(
                and_(
                    DuplicateCandidate.citizen_a_id == a_id,
                    DuplicateCandidate.citizen_b_id == b_id,
                ),
                DuplicateCandidate.citizen_a_id.in_([source_id, target_id]),
                DuplicateCandidate.citizen_b_id.in_([source_id, target_id]),
            ),
            DuplicateCandidate.status == DuplicateStatus.OPEN.value,
        )
    )
    for row in rows.all():
        if {row.citizen_a_id, row.citizen_b_id} == {source_id, target_id}:
            row.status = DuplicateStatus.MERGED.value
