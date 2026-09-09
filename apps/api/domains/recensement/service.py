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
    CampaignCreate,
    CampaignUpdate,
    DeviceRegister,
    MyAssignmentOut,
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
            if existing and existing.updated_at and item.version < 1:
                conflicts += 1
                details.append({"local_id": item.local_id, "status": "CONFLICT"})
                continue
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
            else:
                existing.address_line = item.data.get("address_line", existing.address_line)
                existing.member_count = int(
                    item.data.get("member_count") or existing.member_count or 0
                )
            accepted += 1
            details.append({"local_id": item.local_id, "status": "ACCEPTED"})

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
                    {"local_id": item.local_id, "status": "CONFLICT", "reason": "missing_household"}
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
                existing_rec.status = CensusRecordStatus.CONFLICT
                conflicts += 1
                details.append({"local_id": item.local_id, "status": "CONFLICT"})
                continue

            if existing_rec is None:
                rec = CensusRecord(
                    household_id=household.id,
                    campaign_id=req.campaign_id,
                    local_id=item.local_id,
                    given_names=item.data.get("given_names"),
                    family_name=item.data.get("family_name"),
                    sex=item.data.get("sex"),
                    date_of_birth=item.data.get("date_of_birth"),
                    payload=item.data.get("payload"),
                    photo_ref=item.data.get("photo_ref"),
                    status=CensusRecordStatus.SYNCED,
                    version=item.version,
                    collected_by=req.agent_user_id,
                    synced_at=datetime.now(timezone.utc),
                )
                db.add(rec)
            else:
                existing_rec.given_names = item.data.get("given_names", existing_rec.given_names)
                existing_rec.family_name = item.data.get("family_name", existing_rec.family_name)
                existing_rec.payload = item.data.get("payload", existing_rec.payload)
                existing_rec.version = item.version
                existing_rec.status = CensusRecordStatus.SYNCED
                existing_rec.synced_at = datetime.now(timezone.utc)
            accepted += 1
            details.append({"local_id": item.local_id, "status": "ACCEPTED"})
        else:
            conflicts += 1
            details.append(
                {"local_id": item.local_id, "status": "REJECTED", "reason": "unknown_entity"}
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
                "household_id": str(r.household_id),
                "given_names": r.given_names,
                "family_name": r.family_name,
                "sex": r.sex,
                "date_of_birth": r.date_of_birth,
                "status": r.status.value,
                "version": r.version,
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
