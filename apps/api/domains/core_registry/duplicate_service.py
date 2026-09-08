"""Basic demographic duplicate detection for Core Registry."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.core_registry.enums import DuplicateStatus
from apps.api.domains.core_registry.models import Citizen, DuplicateCandidate

# Exact demographic match score for Phase 2 basic check.
EXACT_DEMOGRAPHIC_SCORE = 1.0


def _ordered_pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (a, b) if a.bytes < b.bytes else (b, a)


async def find_demographic_matches(
    session: AsyncSession,
    *,
    family_name: str,
    given_names: str,
    date_of_birth: date,
    exclude_citizen_id: uuid.UUID | None = None,
) -> list[Citizen]:
    """Find citizens with the same family_name + given_names + date_of_birth (case-insensitive)."""
    stmt = select(Citizen).where(
        and_(
            func.lower(Citizen.family_name) == family_name.strip().lower(),
            func.lower(Citizen.given_names) == given_names.strip().lower(),
            Citizen.date_of_birth == date_of_birth,
        )
    )
    if exclude_citizen_id is not None:
        stmt = stmt.where(Citizen.id != exclude_citizen_id)
    result = await session.scalars(stmt)
    return list(result.all())


async def record_duplicate_candidates(
    session: AsyncSession,
    *,
    citizen_id: uuid.UUID,
    matches: list[Citizen],
    score: float = EXACT_DEMOGRAPHIC_SCORE,
) -> list[DuplicateCandidate]:
    """Create OPEN DuplicateCandidate rows for each match (idempotent on pair)."""
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
        )
        session.add(row)
        created.append(row)
    return created


async def check_and_record_duplicates(
    session: AsyncSession,
    citizen: Citizen,
) -> list[DuplicateCandidate]:
    """Run demographic check for a citizen and persist candidates."""
    matches = await find_demographic_matches(
        session,
        family_name=citizen.family_name,
        given_names=citizen.given_names,
        date_of_birth=citizen.date_of_birth,
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
    """Mark any OPEN duplicate involving the merge pair as MERGED."""
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
