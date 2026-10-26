"""Citizen lifecycle operations for Core Registry."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.domains.core_registry.duplicate_service import (
    check_and_record_duplicates,
    find_demographic_matches,
    mark_pair_merged,
    _primary_geo,
)
from apps.api.domains.core_registry.enums import (
    CitizenEventType,
    CitizenStatus,
    DuplicateStatus,
)
from apps.api.domains.core_registry.models import (
    Citizen,
    CitizenAddress,
    CitizenHistory,
    DuplicateCandidate,
)
from apps.api.domains.core_registry.national_identity_number_service import (
    assign_provisional_nic,
)
from apps.api.domains.core_registry.schemas import (
    CitizenAddressIn,
    CitizenCreate,
    CitizenMergeRequest,
    CitizenUpdate,
)

EDITABLE_STATUSES = {
    CitizenStatus.DRAFT.value,
    CitizenStatus.PENDING_VALIDATION.value,
}

# Transitions manuelles Module 2 (hors validate/merge spécialisés)
ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    CitizenStatus.DRAFT.value: {
        CitizenStatus.PENDING_VALIDATION.value,
        CitizenStatus.SUSPENDED.value,
    },
    CitizenStatus.PENDING_VALIDATION.value: {
        CitizenStatus.DRAFT.value,  # à compléter
        CitizenStatus.SUSPENDED.value,  # rejet
    },
    CitizenStatus.ACTIVE.value: {
        CitizenStatus.SUSPENDED.value,
        CitizenStatus.DECEASED.value,
    },
    CitizenStatus.SUSPENDED.value: {
        CitizenStatus.DRAFT.value,
        CitizenStatus.PENDING_VALIDATION.value,
    },
}


async def create_draft_citizen(
    session: AsyncSession,
    data: CitizenCreate,
    *,
    actor_id: uuid.UUID | None = None,
) -> tuple[Citizen, int]:
    """Create a DRAFT citizen without NIC; run demographic duplicate check.

    Hard rule: refuse exact identity matches (same names + date of birth).
    Soft / probabilistic duplicates are recorded but do not create a second file
    with the same identity key.
    """
    existing = await session.scalar(
        select(Citizen)
        .where(
            func.lower(Citizen.family_name) == data.family_name.strip().lower(),
            func.lower(Citizen.given_names) == data.given_names.strip().lower(),
            Citizen.date_of_birth == data.date_of_birth,
            Citizen.status != CitizenStatus.MERGED.value,
        )
        .limit(1)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Doublon refusé: un citoyen existe déjà avec la même identité",
                "existing_citizen_id": str(existing.id),
                "existing_nic": existing.nic,
                "existing_status": existing.status,
            },
        )

    now = datetime.now(timezone.utc)
    def _up3(v: str | None) -> str | None:
        return v.strip().upper() if v and v.strip() else None

    citizen = Citizen(
        status=CitizenStatus.DRAFT.value,
        nic=None,
        sex=data.sex.value,
        date_of_birth=data.date_of_birth,
        place_of_birth=data.place_of_birth,
        nationality=data.nationality.upper(),
        given_names=data.given_names,
        family_name=data.family_name,
        post_name=(data.post_name.strip() if data.post_name else None),
        other_names=(data.other_names.strip() if data.other_names else None),
        birth_certificate_number=data.birth_certificate_number,
        height_cm=data.height_cm,
        eye_color=data.eye_color,
        occupation=data.occupation,
        marital_status=(data.marital_status.strip().upper() if data.marital_status else None),
        phone=data.phone,
        email=data.email,
        origin_province=data.origin_province,
        origin_territory=data.origin_territory,
        origin_secteur=data.origin_secteur,
        origin_groupement=data.origin_groupement,
        origin_localite=data.origin_localite,
        father_full_name=data.father_full_name,
        father_occupation=data.father_occupation,
        father_nationality=_up3(data.father_nationality),
        mother_full_name=data.mother_full_name,
        mother_occupation=data.mother_occupation,
        mother_nationality=_up3(data.mother_nationality),
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
    q: str | None = None,
    family_name: str | None = None,
    given_names: str | None = None,
    nic: str | None = None,
    date_of_birth: date | None = None,
    status_filter: str | None = None,
    sex: str | None = None,
    place_of_birth: str | None = None,
    province_code: str | None = None,
    commune_code: str | None = None,
    include_closed: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Citizen], int]:
    """Recherche Module 2 : texte libre + filtres structurés + périmètre territorial."""
    filters = []
    if nic:
        filters.append(Citizen.nic == nic.strip())
    if family_name:
        filters.append(func.lower(Citizen.family_name).like(f"%{family_name.strip().lower()}%"))
    if given_names:
        filters.append(func.lower(Citizen.given_names).like(f"%{given_names.strip().lower()}%"))
    if date_of_birth is not None:
        filters.append(Citizen.date_of_birth == date_of_birth)
    if status_filter:
        filters.append(Citizen.status == status_filter.strip().upper())
    if sex:
        filters.append(func.upper(Citizen.sex) == sex.strip().upper())
    if place_of_birth and place_of_birth.strip():
        filters.append(
            func.coalesce(Citizen.place_of_birth, "").ilike(f"%{place_of_birth.strip()}%")
        )
    if q and q.strip():
        tokens = [t for t in q.strip().lower().split() if t]
        for token in tokens:
            like = f"%{token}%"
            filters.append(
                (
                    func.lower(Citizen.family_name).like(like)
                    | func.lower(Citizen.given_names).like(like)
                    | func.coalesce(Citizen.nic, "").ilike(like)
                    | func.coalesce(Citizen.place_of_birth, "").ilike(like)
                )
            )

    if not include_closed and not status_filter:
        filters.append(
            Citizen.status.notin_([CitizenStatus.DECEASED.value, CitizenStatus.MERGED.value])
        )

    need_addr = bool(province_code or commune_code)
    where_clause = and_(*filters) if filters else True

    if need_addr:
        addr_filters = [CitizenAddress.citizen_id == Citizen.id]
        if province_code:
            addr_filters.append(
                func.upper(func.coalesce(CitizenAddress.province_code, ""))
                == province_code.strip().upper()
            )
        if commune_code:
            addr_filters.append(
                func.upper(func.coalesce(CitizenAddress.commune_code, ""))
                == commune_code.strip().upper()
            )
        addr_exists = (
            select(CitizenAddress.id).where(and_(*addr_filters)).exists()
        )
        where_clause = and_(where_clause, addr_exists)

    total = await session.scalar(select(func.count()).select_from(Citizen).where(where_clause))
    stmt = (
        select(Citizen)
        .where(where_clause)
        .options(selectinload(Citizen.addresses))
        .order_by(Citizen.family_name, Citizen.given_names, Citizen.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = list((await session.scalars(stmt)).all())
    return rows, int(total or 0)


def assert_citizen_in_scope(
    citizen: Citizen,
    *,
    province_code: str | None,
    commune_code: str | None,
    forced: bool,
) -> None:
    """Refuse l'accès hors périmètre (404 pour ne pas révéler l'existence)."""
    if not forced or not province_code:
        return
    prov, terr = _primary_geo(citizen)
    if (prov or "").upper() != province_code.strip().upper():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")
    if commune_code and (terr or "").upper() != commune_code.strip().upper():
        # terr peut être commune_code ou city — accepter si commune_code match adresse
        primary = next((a for a in (citizen.addresses or []) if a.is_primary), None)
        if primary is None and citizen.addresses:
            primary = citizen.addresses[0]
        code = (primary.commune_code if primary else None) or ""
        if code.strip().upper() != commune_code.strip().upper():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")


def citizen_to_list_item(citizen: Citizen) -> dict:
    """Map ORM citizen (+ primary address) to list/autofill fields."""
    primary = next((a for a in (citizen.addresses or []) if a.is_primary), None)
    if primary is None and citizen.addresses:
        primary = citizen.addresses[0]
    return {
        "id": citizen.id,
        "nic": citizen.nic,
        "status": citizen.status,
        "family_name": citizen.family_name,
        "given_names": citizen.given_names,
        "post_name": getattr(citizen, "post_name", None),
        "date_of_birth": citizen.date_of_birth,
        "sex": citizen.sex,
        "place_of_birth": citizen.place_of_birth,
        "province_code": primary.province_code if primary else None,
        "ville": primary.city if primary else None,
        "commune_code": primary.commune_code if primary else None,
    }


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
    reason = payload.pop("reason", None)
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
    hist_payload: dict[str, object] = {"changes": changes}
    if reason and str(reason).strip():
        hist_payload["reason"] = str(reason).strip()
    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.UPDATED.value,
            payload=hist_payload,
            actor_id=actor_id,
            created_at=now,
        )
    )
    # Re-check duplicates if identity fields changed.
    if {"family_name", "given_names", "date_of_birth", "sex"} & set(changes):
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

    # Prérequis déjà appliqués ici (doublons / override) — ne pas re-bloquer.
    result = await assign_provisional_nic(
        session, citizen=citizen, actor_id=actor_id, skip_prerequisites=True
    )
    if result.already_assigned:
        # Ne jamais réattribuer — idempotence
        pass

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


async def list_citizen_history(
    session: AsyncSession,
    citizen_id: uuid.UUID,
    *,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[CitizenHistory], int]:
    await get_citizen(session, citizen_id)
    where = CitizenHistory.citizen_id == citizen_id
    total = await session.scalar(
        select(func.count()).select_from(CitizenHistory).where(where)
    )
    stmt = (
        select(CitizenHistory)
        .where(where)
        .order_by(CitizenHistory.created_at.desc(), CitizenHistory.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = list((await session.scalars(stmt)).all())
    return rows, int(total or 0)


async def submit_citizen(
    session: AsyncSession,
    citizen_id: uuid.UUID,
    *,
    actor_id: uuid.UUID | None = None,
    note: str | None = None,
) -> Citizen:
    """DRAFT → PENDING_VALIDATION (soumission contrôle) — aucun NIN."""
    citizen = await get_citizen(session, citizen_id)
    if citizen.status != CitizenStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Submit only from DRAFT (current={citizen.status})",
        )
    now = datetime.now(timezone.utc)
    previous = citizen.status
    citizen.status = CitizenStatus.PENDING_VALIDATION.value
    citizen.updated_at = now
    payload: dict[str, object] = {
        "from": previous,
        "to": CitizenStatus.PENDING_VALIDATION.value,
    }
    if note and note.strip():
        payload["note"] = note.strip()
    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.STATUS_CHANGED.value,
            payload=payload,
            actor_id=actor_id,
            created_at=now,
        )
    )
    await check_and_record_duplicates(session, citizen)
    await session.commit()
    await session.refresh(citizen, attribute_names=["addresses"])
    return citizen


async def change_citizen_status(
    session: AsyncSession,
    citizen_id: uuid.UUID,
    *,
    new_status: CitizenStatus,
    reason: str,
    actor_id: uuid.UUID | None = None,
) -> Citizen:
    """Transition manuelle contrôlée — refuse ACTIVE/MERGED/NIC via ce chemin."""
    if new_status in {CitizenStatus.ACTIVE, CitizenStatus.MERGED}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use validate or merge endpoints for ACTIVE/MERGED; NIN not assigned here",
        )
    citizen = await get_citizen(session, citizen_id)
    allowed = ALLOWED_STATUS_TRANSITIONS.get(citizen.status, set())
    if new_status.value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Transition de statut interdite",
                "from": citizen.status,
                "to": new_status.value,
                "allowed": sorted(allowed),
            },
        )
    now = datetime.now(timezone.utc)
    previous = citizen.status
    citizen.status = new_status.value
    citizen.updated_at = now
    if new_status == CitizenStatus.DECEASED:
        citizen.deceased_at = now
    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.STATUS_CHANGED.value,
            payload={
                "from": previous,
                "to": new_status.value,
                "reason": reason.strip(),
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    await session.commit()
    await session.refresh(citizen, attribute_names=["addresses"])
    return citizen


async def list_duplicates_for_citizen(
    session: AsyncSession,
    citizen_id: uuid.UUID,
    *,
    open_only: bool = True,
) -> list[tuple[DuplicateCandidate, Citizen | None]]:
    await get_citizen(session, citizen_id)
    filters = [
        (DuplicateCandidate.citizen_a_id == citizen_id)
        | (DuplicateCandidate.citizen_b_id == citizen_id)
    ]
    if open_only:
        filters.append(DuplicateCandidate.status == DuplicateStatus.OPEN.value)
    stmt = (
        select(DuplicateCandidate)
        .where(and_(*filters))
        .order_by(DuplicateCandidate.created_at.desc())
    )
    rows = list((await session.scalars(stmt)).all())
    result: list[tuple[DuplicateCandidate, Citizen | None]] = []
    for row in rows:
        other_id = row.citizen_b_id if row.citizen_a_id == citizen_id else row.citizen_a_id
        other = await session.scalar(
            select(Citizen)
            .where(Citizen.id == other_id)
            .options(selectinload(Citizen.addresses))
        )
        result.append((row, other))
    return result


async def resolve_duplicate_candidate(
    session: AsyncSession,
    candidate_id: uuid.UUID,
    *,
    decision: str,
    justification: str,
    actor_id: uuid.UUID | None = None,
) -> DuplicateCandidate:
    """FALSE_POSITIVE ou CONFIRMED_DUPLICATE — jamais de fusion ici."""
    decision_key = decision.strip().upper()
    if decision_key not in {
        DuplicateStatus.FALSE_POSITIVE.value,
        DuplicateStatus.CONFIRMED_DUPLICATE.value,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="decision must be FALSE_POSITIVE or CONFIRMED_DUPLICATE (merge separately)",
        )
    row = await session.scalar(
        select(DuplicateCandidate).where(DuplicateCandidate.id == candidate_id)
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Duplicate not found")
    if row.status != DuplicateStatus.OPEN.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate already resolved ({row.status})",
        )
    row.status = decision_key
    now = datetime.now(timezone.utc)
    for cid in (row.citizen_a_id, row.citizen_b_id):
        session.add(
            CitizenHistory(
                citizen_id=cid,
                event_type=CitizenEventType.STATUS_CHANGED.value,
                payload={
                    "duplicate_resolve": decision_key,
                    "duplicate_id": str(row.id),
                    "other_citizen_id": str(
                        row.citizen_b_id if cid == row.citizen_a_id else row.citizen_a_id
                    ),
                    "justification": justification.strip(),
                },
                actor_id=actor_id,
                created_at=now,
            )
        )
    await session.commit()
    await session.refresh(row)
    return row


async def find_similar_citizens(
    session: AsyncSession,
    *,
    family_name: str,
    given_names: str,
    sex: str,
    date_of_birth: date,
    province_code: str | None = None,
    territory_key: str | None = None,
    limit: int = 20,
) -> list[Citizen]:
    """Recherche pré-création (RB-04) — candidats, pas fusion."""
    matches = await find_demographic_matches(
        session,
        family_name=family_name,
        given_names=given_names,
        sex=sex,
        date_of_birth=date_of_birth,
        province_code=province_code,
        territory_key=territory_key,
        exclude_citizen_id=None,
    )
    if matches:
        return matches[:limit]
    # Fallback souple : même nom + année de naissance (revue humaine)
    birth_year = date_of_birth.year
    stmt = (
        select(Citizen)
        .options(selectinload(Citizen.addresses))
        .where(
            and_(
                func.lower(Citizen.family_name) == family_name.strip().lower(),
                extract("year", Citizen.date_of_birth) == birth_year,
                Citizen.status.notin_(
                    [CitizenStatus.MERGED.value, CitizenStatus.DECEASED.value]
                ),
            )
        )
        .limit(limit)
    )
    soft = list((await session.scalars(stmt)).all())
    # Prioriser also given_names overlap
    soft.sort(
        key=lambda c: (
            0 if c.given_names.strip().lower() == given_names.strip().lower() else 1,
            c.family_name,
        )
    )
    return soft


async def add_citizen_address(
    session: AsyncSession,
    citizen_id: uuid.UUID,
    data: CitizenAddressIn,
    *,
    actor_id: uuid.UUID | None = None,
) -> Citizen:
    citizen = await get_citizen(session, citizen_id)
    if citizen.status == CitizenStatus.MERGED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update merged citizen",
        )
    now = datetime.now(timezone.utc)
    if data.is_primary:
        for existing in citizen.addresses or []:
            existing.is_primary = False
    addr = CitizenAddress(
        address_type=data.address_type.value,
        line1=data.line1,
        line2=data.line2,
        city=data.city,
        commune_code=data.commune_code,
        province_code=data.province_code,
        country_code=data.country_code.upper(),
        is_primary=data.is_primary,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
    )
    citizen.addresses.append(addr)
    citizen.updated_at = now
    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.UPDATED.value,
            payload={
                "address_added": {
                    "line1": data.line1,
                    "city": data.city,
                    "province_code": data.province_code,
                    "commune_code": data.commune_code,
                    "is_primary": data.is_primary,
                }
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    await session.commit()
    await session.refresh(citizen, attribute_names=["addresses"])
    return citizen
