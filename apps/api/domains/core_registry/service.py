"""Citizen lifecycle operations for Core Registry."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.domains.core_registry.duplicate_service import (
    check_and_record_duplicates,
    mark_pair_merged,
)
from apps.api.domains.core_registry.enums import (
    CitizenEventType,
    CitizenStatus,
)
from apps.api.domains.core_registry.models import (
    Citizen,
    CitizenAddress,
    CitizenHistory,
)
from apps.api.domains.core_registry.nic_service import assign_nic
from apps.api.domains.core_registry.schemas import (
    CitizenCreate,
    CitizenMergeRequest,
    CitizenUpdate,
)

EDITABLE_STATUSES = {
    CitizenStatus.DRAFT.value,
    CitizenStatus.PENDING_VALIDATION.value,
}


async def create_draft_citizen(
    session: AsyncSession,
    data: CitizenCreate,
    *,
    actor_id: uuid.UUID | None = None,
) -> tuple[Citizen, int]:
    """Create a DRAFT citizen without NIC; run demographic duplicate check."""
    now = datetime.now(timezone.utc)
    citizen = Citizen(
        status=CitizenStatus.DRAFT.value,
        nic=None,
        sex=data.sex.value,
        date_of_birth=data.date_of_birth,
        place_of_birth=data.place_of_birth,
        nationality=data.nationality.upper(),
        given_names=data.given_names,
        family_name=data.family_name,
        created_at=now,
        updated_at=now,
    )
    for addr in data.addresses:
        citizen.addresses.append(
            CitizenAddress(
                address_type=addr.address_type.value,
                line1=addr.line1,
                line2=addr.line2,
                city=addr.city,
                commune_code=addr.commune_code,
                province_code=addr.province_code,
                country_code=addr.country_code.upper(),
                is_primary=addr.is_primary,
                valid_from=addr.valid_from,
                valid_to=addr.valid_to,
            )
        )
    session.add(citizen)
    await session.flush()

    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.CREATED.value,
            payload={"status": CitizenStatus.DRAFT.value},
            actor_id=actor_id,
            created_at=now,
        )
    )

    candidates = await check_and_record_duplicates(session, citizen)
    await session.commit()
    await session.refresh(citizen, attribute_names=["addresses"])
    return citizen, len(candidates)


async def get_citizen(session: AsyncSession, citizen_id: uuid.UUID) -> Citizen:
    result = await session.scalar(
        select(Citizen)
        .where(Citizen.id == citizen_id)
        .options(selectinload(Citizen.addresses))
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")
    return result


async def get_citizen_by_nic(session: AsyncSession, nic: str) -> Citizen:
    result = await session.scalar(
        select(Citizen)
        .where(Citizen.nic == nic)
        .options(selectinload(Citizen.addresses))
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")
    return result


async def search_citizens(
    session: AsyncSession,
    *,
    family_name: str | None,
    given_names: str | None,
    date_of_birth: date | None,
    page: int,
    page_size: int,
) -> tuple[list[Citizen], int]:
    filters = []
    if family_name:
        filters.append(func.lower(Citizen.family_name).like(f"%{family_name.strip().lower()}%"))
    if given_names:
        filters.append(func.lower(Citizen.given_names).like(f"%{given_names.strip().lower()}%"))
    if date_of_birth is not None:
        filters.append(Citizen.date_of_birth == date_of_birth)

    where_clause = and_(*filters) if filters else True
    total = await session.scalar(select(func.count()).select_from(Citizen).where(where_clause))
    stmt = (
        select(Citizen)
        .where(where_clause)
        .order_by(Citizen.family_name, Citizen.given_names, Citizen.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = list((await session.scalars(stmt)).all())
    return rows, int(total or 0)


async def update_draft_citizen(
    session: AsyncSession,
    citizen_id: uuid.UUID,
    data: CitizenUpdate,
    *,
    actor_id: uuid.UUID | None = None,
) -> Citizen:
    citizen = await get_citizen(session, citizen_id)
    if citizen.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Citizen can only be updated before validation",
        )

    changes: dict[str, object] = {}
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if value is None:
            continue
        if hasattr(value, "value"):
            value = value.value
        if field == "nationality" and isinstance(value, str):
            value = value.upper()
        old = getattr(citizen, field)
        if old != value:
            changes[field] = {"from": old if not isinstance(old, date) else old.isoformat(), "to": value if not isinstance(value, date) else value.isoformat()}
            setattr(citizen, field, value)

    if not changes:
        return citizen

    now = datetime.now(timezone.utc)
    citizen.updated_at = now
    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.UPDATED.value,
            payload={"changes": changes},
            actor_id=actor_id,
            created_at=now,
        )
    )
    # Re-check duplicates if identity fields changed.
    if {"family_name", "given_names", "date_of_birth"} & set(changes):
        await check_and_record_duplicates(session, citizen)

    await session.commit()
    await session.refresh(citizen, attribute_names=["addresses"])
    return citizen


async def validate_and_assign_nic(
    session: AsyncSession,
    citizen_id: uuid.UUID,
    *,
    actor_id: uuid.UUID | None = None,
    force_despite_duplicates: bool = False,
    override_justification: str | None = None,
) -> tuple[Citizen, int]:
    """
    Validate citizen and assign NIC.

    Blocks automatic NIC attribution when OPEN demographic duplicates exist,
    unless force_despite_duplicates + justification (elevated override).
    """
    from apps.api.domains.core_registry.models import DuplicateCandidate
    from apps.api.domains.core_registry.enums import DuplicateStatus

    citizen = await get_citizen(session, citizen_id)
    if citizen.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot validate citizen in status {citizen.status}",
        )
    if citizen.nic is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Citizen already has a NIC",
        )

    citizen.status = CitizenStatus.PENDING_VALIDATION.value
    await session.flush()

    candidates = await check_and_record_duplicates(session, citizen)

    open_dupes = await session.scalar(
        select(func.count())
        .select_from(DuplicateCandidate)
        .where(
            and_(
                DuplicateCandidate.status == DuplicateStatus.OPEN.value,
                (
                    (DuplicateCandidate.citizen_a_id == citizen.id)
                    | (DuplicateCandidate.citizen_b_id == citizen.id)
                ),
            )
        )
    )
    open_count = int(open_dupes or 0)
    if open_count > 0 and not force_despite_duplicates:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "NIC attribution blocked: open duplicate candidates exist",
                "open_duplicates": open_count,
                "hint": "Resolve duplicates or use override with justification",
            },
        )
    if open_count > 0 and force_despite_duplicates:
        if not override_justification or len(override_justification.strip()) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="override_justification required (min 10 chars) when forcing NIC",
            )

    await assign_nic(session, citizen=citizen, actor_id=actor_id)

    history_payload: dict = {"status": CitizenStatus.ACTIVE.value}
    if open_count > 0 and force_despite_duplicates:
        history_payload["duplicate_override"] = True
        history_payload["justification"] = override_justification

    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.VALIDATED.value,
            payload=history_payload,
            actor_id=actor_id,
        )
    )
    try:
        from apps.api.domains.audit.services import write_audit

        await write_audit(
            session,
            action="CITIZEN_NIC_ASSIGNED",
            actor_id=actor_id,
            resource_type="Citizen",
            resource_id=str(citizen.id),
            new_value={"nic_assigned": True, "open_duplicates": open_count},
            justification=override_justification,
            commit=False,
        )
    except Exception:
        pass

    await session.commit()
    await session.refresh(citizen, attribute_names=["addresses"])
    return citizen, len(candidates)

async def merge_citizens(
    session: AsyncSession,
    data: CitizenMergeRequest,
    *,
    actor_id: uuid.UUID | None = None,
) -> Citizen:
    """Controlled merge: source → MERGED into target (admin/ONIP)."""
    if data.source_citizen_id == data.target_citizen_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source and target must differ",
        )

    source = await get_citizen(session, data.source_citizen_id)
    target = await get_citizen(session, data.target_citizen_id)

    if source.status == CitizenStatus.MERGED.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Source already merged")
    if target.status == CitizenStatus.MERGED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target is merged; choose the surviving record",
        )

    now = datetime.now(timezone.utc)
    previous = source.status
    source.status = CitizenStatus.MERGED.value
    source.merged_into_id = target.id
    source.updated_at = now

    session.add(
        CitizenHistory(
            citizen_id=source.id,
            event_type=CitizenEventType.MERGED.value,
            payload={
                "merged_into_id": str(target.id),
                "justification": data.justification,
                "previous_status": previous,
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    session.add(
        CitizenHistory(
            citizen_id=target.id,
            event_type=CitizenEventType.MERGED.value,
            payload={
                "merged_from_id": str(source.id),
                "justification": data.justification,
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    await mark_pair_merged(session, source_id=source.id, target_id=target.id)
    await session.commit()
    await session.refresh(source)
    return source
