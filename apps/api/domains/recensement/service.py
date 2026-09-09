"""Census domain services — campaigns, devices, offline sync."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.recensement.models import (
    AgentAssignment,
    Campaign,
    CampaignStatus,
    CensusRecord,
    CensusRecordStatus,
    Device,
    Household,
    SyncBatch,
    SyncBatchStatus,
    Team,
    Zone,
)
from apps.api.domains.recensement.schemas import (
    AgentStatsOut,
    AssignmentCreate,
    BatchPromoteRequest,
    BatchPromoteResult,
    CampaignCreate,
    CampaignStatsOut,
    CampaignUpdate,
    DeviceRegister,
    MyAssignmentOut,
    PromoteRequest,
    PromoteResult,
    RecordRejectRequest,
    RecordReviewRequest,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResult,
    TeamCreate,
    ZoneCreate,
)


async def create_campaign(db: AsyncSession, data: CampaignCreate) -> Campaign:
    campaign = Campaign(**data.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def list_campaigns(db: AsyncSession, status: CampaignStatus | None = None) -> list[Campaign]:
    stmt = select(Campaign).order_by(Campaign.created_at.desc())
    if status is not None:
        stmt = stmt.where(Campaign.status == status)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_campaign(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign | None:
    return await db.get(Campaign, campaign_id)


async def update_campaign(
    db: AsyncSession, campaign: Campaign, data: CampaignUpdate
) -> Campaign:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def delete_campaign(db: AsyncSession, campaign: Campaign) -> None:
    await db.delete(campaign)
    await db.commit()


async def register_device(db: AsyncSession, data: DeviceRegister) -> Device:
    result = await db.execute(select(Device).where(Device.device_uid == data.device_uid))
    device = result.scalar_one_or_none()
    if device:
        device.platform = data.platform or device.platform
        device.app_version = data.app_version or device.app_version
        device.agent_user_id = data.agent_user_id or device.agent_user_id
        device.last_seen_at = datetime.now(timezone.utc)
        device.is_active = True
    else:
        device = Device(
            device_uid=data.device_uid,
            platform=data.platform,
            app_version=data.app_version,
            agent_user_id=data.agent_user_id,
            last_seen_at=datetime.now(timezone.utc),
        )
        db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


async def sync_push(db: AsyncSession, req: SyncPushRequest) -> SyncPushResult:
    device = (
        await db.execute(select(Device).where(Device.device_uid == req.device_uid))
    ).scalar_one_or_none()
    if device is None:
        device = Device(device_uid=req.device_uid, agent_user_id=req.agent_user_id)
        db.add(device)
        await db.flush()

    batch = SyncBatch(
        device_id=device.id,
        agent_user_id=req.agent_user_id,
        direction="PUSH",
        status=SyncBatchStatus.PROCESSING,
        item_count=len(req.items),
    )
    db.add(batch)
    await db.flush()

    accepted = 0
    conflicts = 0
    details: list[dict[str, Any]] = []

    for item in req.items:
        if item.entity_type == "household":
            existing = (
                await db.execute(
                    select(Household).where(
                        Household.campaign_id == req.campaign_id,
                        Household.local_id == item.local_id,
                    )
                )
            ).scalar_one_or_none()
            # Idempotent upsert by (campaign, local_id). Last push wins for household fields.
            if existing is None:
                hh = Household(
                    campaign_id=req.campaign_id,
                    local_id=item.local_id,
                    address_line=item.data.get("address_line"),
                    latitude=item.data.get("latitude"),
                    longitude=item.data.get("longitude"),
                    member_count=int(item.data.get("member_count") or 0),
                    collected_by=req.agent_user_id,
                    device_id=device.id,
                    zone_id=_parse_uuid(item.data.get("zone_id")),
                )
                db.add(hh)
                await db.flush()
            else:
                existing.address_line = item.data.get("address_line", existing.address_line)
                if "latitude" in item.data:
                    existing.latitude = item.data.get("latitude")
                if "longitude" in item.data:
                    existing.longitude = item.data.get("longitude")
                existing.member_count = int(
                    item.data.get("member_count") or existing.member_count or 0
                )
                if item.data.get("zone_id"):
                    existing.zone_id = _parse_uuid(item.data.get("zone_id"))
            accepted += 1
            details.append(
                {"local_id": item.local_id, "entity_type": "household", "status": "ACCEPTED"}
            )

        elif item.entity_type == "census_record":
            hh_local = item.data.get("household_local_id")
            household = None
            if hh_local:
                household = (
                    await db.execute(
                        select(Household).where(
                            Household.campaign_id == req.campaign_id,
                            Household.local_id == hh_local,
                        )
                    )
                ).scalar_one_or_none()
            if household is None and item.data.get("household_id"):
                household = await db.get(Household, _parse_uuid(item.data["household_id"]))
            if household is None:
                conflicts += 1
                details.append(
                    {
                        "local_id": item.local_id,
                        "entity_type": "census_record",
                        "status": "CONFLICT",
                        "reason": "missing_household",
                    }
                )
                continue

            existing_rec = (
                await db.execute(
                    select(CensusRecord).where(
                        CensusRecord.campaign_id == req.campaign_id,
                        CensusRecord.local_id == item.local_id,
                    )
                )
            ).scalar_one_or_none()
            if existing_rec and existing_rec.version > item.version:
                conflicts += 1
                details.append(
                    {
                        "local_id": item.local_id,
                        "entity_type": "census_record",
                        "status": "CONFLICT",
                        "reason": "stale_version",
                        "server_version": existing_rec.version,
                        "client_version": item.version,
                        "server": {
                            "given_names": existing_rec.given_names,
                            "family_name": existing_rec.family_name,
                            "sex": existing_rec.sex,
                            "date_of_birth": existing_rec.date_of_birth,
                            "version": existing_rec.version,
                            "status": existing_rec.status.value,
                        },
                    }
                )
                continue

            if existing_rec is None:
                raw_payload = item.data.get("payload")
                if isinstance(raw_payload, dict):
                    payload = raw_payload
                else:
                    payload = {
                        k: item.data.get(k)
                        for k in ("relationship_to_head",)
                        if item.data.get(k) is not None
                    } or None
                rec = CensusRecord(
                    household_id=household.id,
                    campaign_id=req.campaign_id,
                    local_id=item.local_id,
                    given_names=item.data.get("given_names"),
                    family_name=item.data.get("family_name"),
                    sex=item.data.get("sex"),
                    date_of_birth=item.data.get("date_of_birth"),
                    payload=payload,
                    photo_ref=item.data.get("photo_ref"),
                    status=CensusRecordStatus.SYNCED,
                    version=max(item.version, 1),
                    collected_by=req.agent_user_id,
                    synced_at=datetime.now(timezone.utc),
                )
                db.add(rec)
            else:
                existing_rec.given_names = item.data.get("given_names", existing_rec.given_names)
                existing_rec.family_name = item.data.get("family_name", existing_rec.family_name)
                existing_rec.sex = item.data.get("sex", existing_rec.sex)
                existing_rec.date_of_birth = item.data.get(
                    "date_of_birth", existing_rec.date_of_birth
                )
                existing_rec.payload = item.data.get("payload", existing_rec.payload)
                existing_rec.version = max(item.version, existing_rec.version)
                existing_rec.status = CensusRecordStatus.SYNCED
                existing_rec.synced_at = datetime.now(timezone.utc)
            accepted += 1
            details.append(
                {
                    "local_id": item.local_id,
                    "entity_type": "census_record",
                    "status": "ACCEPTED",
                    "version": max(item.version, 1),
                }
            )
        else:
            conflicts += 1
            details.append(
                {
                    "local_id": item.local_id,
                    "entity_type": item.entity_type,
                    "status": "REJECTED",
                    "reason": "unknown_entity",
                }
            )

    batch.accepted_count = accepted
    batch.conflict_count = conflicts
    batch.status = (
        SyncBatchStatus.ACCEPTED
        if conflicts == 0
        else SyncBatchStatus.PARTIAL if accepted else SyncBatchStatus.REJECTED
    )
    batch.completed_at = datetime.now(timezone.utc)
    batch.payload_summary = {"accepted": accepted, "conflicts": conflicts}
    device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(batch)
    return SyncPushResult(
        batch_id=batch.id, accepted=accepted, conflicts=conflicts, details=details
    )


async def sync_pull(db: AsyncSession, req: SyncPullRequest) -> SyncPullResponse:
    device = (
        await db.execute(select(Device).where(Device.device_uid == req.device_uid))
    ).scalar_one_or_none()
    batch = SyncBatch(
        device_id=device.id if device else None,
        direction="PULL",
        status=SyncBatchStatus.ACCEPTED,
        item_count=0,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(batch)

    campaign = await db.get(Campaign, req.campaign_id)
    campaigns = [campaign] if campaign else []

    hh_stmt = select(Household).where(Household.campaign_id == req.campaign_id)
    rec_stmt = select(CensusRecord).where(CensusRecord.campaign_id == req.campaign_id)
    if req.since:
        hh_stmt = hh_stmt.where(Household.updated_at >= req.since)
        rec_stmt = rec_stmt.where(CensusRecord.updated_at >= req.since)

    households = list((await db.execute(hh_stmt)).scalars().all())
    records = list((await db.execute(rec_stmt)).scalars().all())
    batch.item_count = len(households) + len(records)
    await db.commit()
    await db.refresh(batch)

    from apps.api.domains.recensement.schemas import CampaignOut

    return SyncPullResponse(
        batch_id=batch.id,
        campaigns=[CampaignOut.model_validate(c) for c in campaigns if c],
        households=[
            {
                "id": str(h.id),
                "local_id": h.local_id,
                "campaign_id": str(h.campaign_id),
                "address_line": h.address_line,
                "member_count": h.member_count,
                "latitude": h.latitude,
                "longitude": h.longitude,
                "updated_at": h.updated_at.isoformat() if h.updated_at else None,
            }
            for h in households
        ],
        records=[
            {
                "id": str(r.id),
                "local_id": r.local_id,
                "campaign_id": str(r.campaign_id),
                "household_id": str(r.household_id),
                "household_local_id": (
                    next((h.local_id for h in households if h.id == r.household_id), None)
                ),
                "given_names": r.given_names,
                "family_name": r.family_name,
                "sex": r.sex,
                "date_of_birth": r.date_of_birth,
                "status": r.status.value,
                "version": r.version,
                "review_note": r.review_note,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "citizen_id": str(r.citizen_id) if r.citizen_id else None,
            }
            for r in records
        ],
        server_time=datetime.now(timezone.utc),
    )


async def agent_stats(db: AsyncSession, agent_user_id: uuid.UUID) -> AgentStatsOut:
    hh_count = (
        await db.execute(
            select(func.count()).select_from(Household).where(Household.collected_by == agent_user_id)
        )
    ).scalar_one()
    rec_total = (
        await db.execute(
            select(func.count())
            .select_from(CensusRecord)
            .where(CensusRecord.collected_by == agent_user_id)
        )
    ).scalar_one()
    synced = (
        await db.execute(
            select(func.count())
            .select_from(CensusRecord)
            .where(
                CensusRecord.collected_by == agent_user_id,
                CensusRecord.status == CensusRecordStatus.SYNCED,
            )
        )
    ).scalar_one()
    conflicts = (
        await db.execute(
            select(func.count())
            .select_from(CensusRecord)
            .where(
                CensusRecord.collected_by == agent_user_id,
                CensusRecord.status == CensusRecordStatus.CONFLICT,
            )
        )
    ).scalar_one()
    last_sync = (
        await db.execute(
            select(func.max(SyncBatch.completed_at)).where(SyncBatch.agent_user_id == agent_user_id)
        )
    ).scalar_one()
    return AgentStatsOut(
        agent_user_id=agent_user_id,
        households_collected=int(hh_count or 0),
        records_collected=int(rec_total or 0),
        synced_records=int(synced or 0),
        conflict_records=int(conflicts or 0),
        last_sync_at=last_sync,
    )


def _parse_uuid(value: Any) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


# --- Zones / teams / assignments (Phase 1 ops) ---


async def create_zone(db: AsyncSession, campaign_id: uuid.UUID, data: ZoneCreate) -> Zone:
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise ValueError("campaign_not_found")
    zone = Zone(campaign_id=campaign_id, **data.model_dump())
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone


async def list_zones(db: AsyncSession, campaign_id: uuid.UUID) -> list[Zone]:
    result = await db.execute(
        select(Zone).where(Zone.campaign_id == campaign_id).order_by(Zone.code.asc())
    )
    return list(result.scalars().all())


async def get_zone(db: AsyncSession, zone_id: uuid.UUID) -> Zone | None:
    return await db.get(Zone, zone_id)


async def create_team(db: AsyncSession, campaign_id: uuid.UUID, data: TeamCreate) -> Team:
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise ValueError("campaign_not_found")
    if data.zone_id:
        zone = await get_zone(db, data.zone_id)
        if not zone or zone.campaign_id != campaign_id:
            raise ValueError("zone_not_found")
    team = Team(campaign_id=campaign_id, **data.model_dump())
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return team


async def list_teams(db: AsyncSession, campaign_id: uuid.UUID) -> list[Team]:
    result = await db.execute(
        select(Team).where(Team.campaign_id == campaign_id).order_by(Team.code.asc())
    )
    return list(result.scalars().all())


async def get_team(db: AsyncSession, team_id: uuid.UUID) -> Team | None:
    return await db.get(Team, team_id)


async def assign_agent(
    db: AsyncSession, team_id: uuid.UUID, data: AssignmentCreate
) -> AgentAssignment:
    team = await get_team(db, team_id)
    if not team:
        raise ValueError("team_not_found")
    existing = await db.execute(
        select(AgentAssignment).where(
            AgentAssignment.team_id == team_id,
            AgentAssignment.agent_user_id == data.agent_user_id,
            AgentAssignment.active.is_(True),
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        row.role_label = data.role_label
        row.active = data.active
        await db.commit()
        await db.refresh(row)
        return row
    assignment = AgentAssignment(
        team_id=team_id,
        agent_user_id=data.agent_user_id,
        role_label=data.role_label,
        active=data.active,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def list_team_assignments(db: AsyncSession, team_id: uuid.UUID) -> list[AgentAssignment]:
    result = await db.execute(
        select(AgentAssignment)
        .where(AgentAssignment.team_id == team_id)
        .order_by(AgentAssignment.assigned_at.desc())
    )
    return list(result.scalars().all())


async def list_my_assignments(db: AsyncSession, agent_user_id: uuid.UUID) -> list[MyAssignmentOut]:
    from sqlalchemy.orm import selectinload

    from apps.api.domains.recensement.schemas import CampaignOut, TeamOut, ZoneOut

    result = await db.execute(
        select(AgentAssignment)
        .where(
            AgentAssignment.agent_user_id == agent_user_id,
            AgentAssignment.active.is_(True),
        )
        .options(
            selectinload(AgentAssignment.team).selectinload(Team.zone),
            selectinload(AgentAssignment.team).selectinload(Team.campaign),
        )
        .order_by(AgentAssignment.assigned_at.desc())
    )
    rows = list(result.scalars().all())
    out: list[MyAssignmentOut] = []
    for a in rows:
        team = a.team
        zone = team.zone if team else None
        campaign = team.campaign if team else None
        if not team or not campaign:
            continue
        out.append(
            MyAssignmentOut(
                assignment_id=a.id,
                role_label=a.role_label,
                active=a.active,
                assigned_at=a.assigned_at,
                team=TeamOut.model_validate(team),
                zone=ZoneOut.model_validate(zone) if zone else None,
                campaign=CampaignOut.model_validate(campaign),
            )
        )
    return out


async def list_campaign_records(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    status_filter: CensusRecordStatus | None = None,
    zone_id: uuid.UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[CensusRecord]:
    stmt = select(CensusRecord).where(CensusRecord.campaign_id == campaign_id)
    if status_filter is not None:
        stmt = stmt.where(CensusRecord.status == status_filter)
    if zone_id is not None:
        stmt = stmt.join(Household, CensusRecord.household_id == Household.id).where(
            Household.zone_id == zone_id
        )
    stmt = stmt.order_by(CensusRecord.updated_at.desc()).offset(offset).limit(min(limit, 500))
    return list((await db.execute(stmt)).scalars().all())


async def campaign_stats(db: AsyncSession, campaign_id: uuid.UUID) -> CampaignStatsOut:
    hh = (
        await db.execute(
            select(func.count()).select_from(Household).where(Household.campaign_id == campaign_id)
        )
    ).scalar_one()
    rec_total = (
        await db.execute(
            select(func.count())
            .select_from(CensusRecord)
            .where(CensusRecord.campaign_id == campaign_id)
        )
    ).scalar_one()
    by_status_rows = (
        await db.execute(
            select(CensusRecord.status, func.count())
            .where(CensusRecord.campaign_id == campaign_id)
            .group_by(CensusRecord.status)
        )
    ).all()
    by_status = {str(status.value if hasattr(status, "value") else status): int(n) for status, n in by_status_rows}

    def _n(key: str) -> int:
        return int(by_status.get(key, 0))

    return CampaignStatsOut(
        campaign_id=campaign_id,
        households=int(hh or 0),
        records=int(rec_total or 0),
        by_status=by_status,
        synced=_n("SYNCED"),
        approved=_n("APPROVED"),
        rejected=_n("REJECTED"),
        promoted=_n("PROMOTED"),
        conflicts=_n("CONFLICT"),
        pending_review=_n("SYNCED"),
    )


async def export_campaign_records_csv(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    status_filter: CensusRecordStatus | None = None,
) -> str:
    import csv
    import io

    rows = await list_campaign_records(
        db, campaign_id, status_filter=status_filter, limit=500, offset=0
    )
    # Paginate remaining if needed
    offset = 500
    while True:
        more = await list_campaign_records(
            db, campaign_id, status_filter=status_filter, limit=500, offset=offset
        )
        if not more:
            break
        rows.extend(more)
        offset += 500
        if offset > 20000:
            break

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "record_id",
            "local_id",
            "household_id",
            "given_names",
            "family_name",
            "sex",
            "date_of_birth",
            "status",
            "version",
            "citizen_id",
            "review_note",
            "reviewed_at",
            "promoted_at",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                str(r.id),
                r.local_id or "",
                str(r.household_id),
                r.given_names or "",
                r.family_name or "",
                r.sex or "",
                r.date_of_birth or "",
                r.status.value,
                r.version,
                str(r.citizen_id) if r.citizen_id else "",
                (r.review_note or "").replace("\n", " "),
                r.reviewed_at.isoformat() if r.reviewed_at else "",
                r.promoted_at.isoformat() if r.promoted_at else "",
            ]
        )
    return buf.getvalue()


async def get_record(db: AsyncSession, record_id: uuid.UUID) -> CensusRecord | None:
    return await db.get(CensusRecord, record_id)


def _assert_reviewable(rec: CensusRecord) -> None:
    if rec.status not in {CensusRecordStatus.SYNCED, CensusRecordStatus.REJECTED}:
        raise ValueError("not_reviewable")


async def approve_record(
    db: AsyncSession,
    rec: CensusRecord,
    reviewer_id: uuid.UUID,
    body: RecordReviewRequest,
) -> CensusRecord:
    _assert_reviewable(rec)
    rec.status = CensusRecordStatus.APPROVED
    rec.reviewed_by = reviewer_id
    rec.reviewed_at = datetime.now(timezone.utc)
    rec.review_note = body.note
    await db.commit()
    await db.refresh(rec)
    return rec


async def reject_record(
    db: AsyncSession,
    rec: CensusRecord,
    reviewer_id: uuid.UUID,
    body: RecordRejectRequest,
) -> CensusRecord:
    if rec.status not in {CensusRecordStatus.SYNCED, CensusRecordStatus.APPROVED}:
        raise ValueError("not_reviewable")
    rec.status = CensusRecordStatus.REJECTED
    rec.reviewed_by = reviewer_id
    rec.reviewed_at = datetime.now(timezone.utc)
    rec.review_note = body.note
    await db.commit()
    await db.refresh(rec)
    return rec


def _map_sex(raw: str | None):
    from apps.api.domains.core_registry.enums import Sex

    if not raw:
        return Sex.UNKNOWN
    key = raw.strip().upper()
    if key in {"M", "MALE", "H", "HOMME"}:
        return Sex.MALE
    if key in {"F", "FEMALE", "FEMME"}:
        return Sex.FEMALE
    if key in {"OTHER", "AUTRE"}:
        return Sex.OTHER
    return Sex.UNKNOWN


def _parse_dob(raw: str | None):
    from datetime import date as date_cls

    if not raw or not str(raw).strip():
        raise ValueError("missing_date_of_birth")
    text = str(raw).strip()[:10]
    try:
        return date_cls.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("invalid_date_of_birth") from exc


async def promote_record(
    db: AsyncSession,
    rec: CensusRecord,
    promoter_id: uuid.UUID,
    body: PromoteRequest,
) -> PromoteResult:
    """Create core_registry citizen from APPROVED census record (idempotent)."""
    from fastapi import HTTPException

    from apps.api.domains.core_registry.enums import AddressType, CitizenEventType
    from apps.api.domains.core_registry.models import Citizen, CitizenHistory
    from apps.api.domains.core_registry.schemas import CitizenAddressIn, CitizenCreate
    from apps.api.domains.core_registry import service as registry_service

    if rec.citizen_id is not None:
        citizen = await db.get(Citizen, rec.citizen_id)
        if citizen is None:
            raise ValueError("orphan_citizen_link")
        return PromoteResult(
            census_record_id=rec.id,
            citizen_id=citizen.id,
            nic=citizen.nic,
            citizen_status=citizen.status,
            already_promoted=True,
            nic_assigned=citizen.nic is not None,
        )

    if rec.status != CensusRecordStatus.APPROVED:
        raise ValueError("not_promotable")

    if not (rec.given_names and rec.given_names.strip()):
        raise ValueError("missing_given_names")
    if not (rec.family_name and rec.family_name.strip()):
        raise ValueError("missing_family_name")

    dob = _parse_dob(rec.date_of_birth)

    hh = await db.get(Household, rec.household_id)
    zone = None
    if hh and hh.zone_id:
        zone = await db.get(Zone, hh.zone_id)

    addresses: list[CitizenAddressIn] = []
    if hh and hh.address_line and hh.address_line.strip():
        city = (zone.name if zone else None) or (zone.commune_code if zone else None) or "Kinshasa"
        addresses.append(
            CitizenAddressIn(
                address_type=AddressType.RESIDENTIAL,
                line1=hh.address_line.strip()[:255],
                city=str(city)[:128],
                commune_code=zone.commune_code if zone else None,
                province_code=zone.province_code if zone else None,
                is_primary=True,
            )
        )

    create_data = CitizenCreate(
        given_names=rec.given_names.strip(),
        family_name=rec.family_name.strip(),
        date_of_birth=dob,
        sex=_map_sex(rec.sex),
        nationality="COD",
        addresses=addresses,
    )
    citizen, _dupes = await registry_service.create_draft_citizen(
        db, create_data, actor_id=promoter_id
    )

    db.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.STATUS_CHANGED.value,
            payload={
                "source": "census_promote",
                "census_record_id": str(rec.id),
                "campaign_id": str(rec.campaign_id),
                "local_id": rec.local_id,
            },
            actor_id=promoter_id,
        )
    )
    await db.commit()

    nic_assigned = False
    nic_error: str | None = None
    if body.assign_nic:
        try:
            citizen, _ = await registry_service.validate_and_assign_nic(
                db,
                citizen.id,
                actor_id=promoter_id,
                force_despite_duplicates=body.force_despite_duplicates,
                override_justification=body.override_justification,
            )
            nic_assigned = citizen.nic is not None
        except HTTPException as exc:
            nic_error = str(exc.detail)
            citizen = await db.get(Citizen, citizen.id)
            assert citizen is not None
        except Exception as exc:  # noqa: BLE001
            nic_error = str(exc)
            citizen = await db.get(Citizen, citizen.id)
            assert citizen is not None

    rec = await db.get(CensusRecord, rec.id)
    assert rec is not None
    rec.citizen_id = citizen.id
    rec.status = CensusRecordStatus.PROMOTED
    rec.promoted_by = promoter_id
    rec.promoted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(rec)
    await db.refresh(citizen)

    return PromoteResult(
        census_record_id=rec.id,
        citizen_id=citizen.id,
        nic=citizen.nic,
        citizen_status=citizen.status,
        already_promoted=False,
        nic_assigned=nic_assigned,
        nic_error=nic_error,
    )


async def promote_campaign_batch(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    promoter_id: uuid.UUID,
    body: BatchPromoteRequest,
) -> BatchPromoteResult:
    rows = await list_campaign_records(
        db,
        campaign_id,
        status_filter=CensusRecordStatus.APPROVED,
        limit=body.limit,
        offset=0,
    )
    results: list[PromoteResult] = []
    errors: list[dict[str, Any]] = []
    promoted = 0
    skipped = 0
    failed = 0
    req = PromoteRequest(assign_nic=body.assign_nic)
    for rec in rows:
        try:
            fresh = await get_record(db, rec.id)
            if fresh is None:
                failed += 1
                errors.append({"record_id": str(rec.id), "error": "not_found"})
                continue
            out = await promote_record(db, fresh, promoter_id, req)
            results.append(out)
            if out.already_promoted:
                skipped += 1
            else:
                promoted += 1
        except ValueError as exc:
            failed += 1
            errors.append({"record_id": str(rec.id), "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            failed += 1
            errors.append({"record_id": str(rec.id), "error": str(exc)})
    return BatchPromoteResult(
        promoted=promoted, skipped=skipped, failed=failed, results=results, errors=errors
    )