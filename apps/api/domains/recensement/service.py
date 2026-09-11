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
    FormDraft,
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
    FormDraftCreate,
    FormDraftUpdate,
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


def _kinshasa_fallback_coords() -> tuple[float, float]:
    """Approximate Kinshasa centre — keeps manual addresses visible on the map."""
    return (-4.3276, 15.3136)


def _ensure_geo_fields(data: dict[str, Any]) -> tuple[float | None, float | None, str | None]:
    """Resolve lat/lng + address_source; never leave manual households without coords."""
    src = _resolve_address_source(data)
    lat = data.get("latitude")
    lng = data.get("longitude")
    try:
        lat_f = float(lat) if lat is not None and lat != "" else None
    except (TypeError, ValueError):
        lat_f = None
    try:
        lng_f = float(lng) if lng is not None and lng != "" else None
    except (TypeError, ValueError):
        lng_f = None
    if (lat_f is None or lng_f is None) and (
        src == "manual" or data.get("address_line") or data.get("geo_label")
    ):
        lat_f, lng_f = _kinshasa_fallback_coords()
        if src is None:
            src = "manual"
    if src is None and lat_f is not None and lng_f is not None:
        src = "gps"
    return lat_f, lng_f, src


def _resolve_address_source(data: dict[str, Any]) -> str | None:
    """Normalize address origin for cartography filters."""
    raw = (
        data.get("address_source")
        or data.get("gps_source")
        or data.get("geo_source")
    )
    if raw is None:
        if data.get("latitude") is not None and data.get("longitude") is not None:
            # gps_source absent → treat as gps only if coords look precise; else manual
            return "gps"
        if data.get("address_line") or data.get("geo_label"):
            return "manual"
        return None
    s = str(raw).strip().lower()
    if s in {"manual", "manual_offline", "cascade", "offline_manual", "offline"}:
        # "offline" without real GPS device fix → manual cartography bucket
        if s == "offline" and data.get("latitude") is not None:
            return "gps"
        return "manual"
    if s in {"online", "nominatim"}:
        return "online"
    if s in {"gps", "offline_kinshasa"}:
        return "gps"
    return s[:32] or None


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
            lat, lng, src = _ensure_geo_fields(item.data)
            if existing is None:
                hh = Household(
                    campaign_id=req.campaign_id,
                    local_id=item.local_id,
                    address_line=item.data.get("address_line"),
                    latitude=lat,
                    longitude=lng,
                    address_source=src,
                    member_count=int(item.data.get("member_count") or 0),
                    collected_by=req.agent_user_id,
                    device_id=device.id,
                    zone_id=_parse_uuid(item.data.get("zone_id")),
                )
                db.add(hh)
                await db.flush()
            else:
                existing.address_line = item.data.get("address_line", existing.address_line)
                if lat is not None:
                    existing.latitude = lat
                elif existing.latitude is None and (src == "manual" or existing.address_line):
                    existing.latitude, existing.longitude = _kinshasa_fallback_coords()
                if lng is not None:
                    existing.longitude = lng
                if src:
                    existing.address_source = src
                elif existing.address_source is None and existing.latitude is None:
                    existing.address_source = "manual"
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
                client_status = str(item.data.get("status") or "SYNCED").upper()
                if client_status == "DRAFT":
                    rec_status = CensusRecordStatus.DRAFT
                elif client_status == "QUEUED":
                    rec_status = CensusRecordStatus.SYNCED
                else:
                    rec_status = CensusRecordStatus.SYNCED
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
                    status=rec_status,
                    version=max(item.version, 1),
                    collected_by=req.agent_user_id,
                    synced_at=datetime.now(timezone.utc),
                )
                db.add(rec)
            else:
                # Ne pas écraser une fiche déjà validée / promue avec un brouillon.
                if existing_rec.status in {
                    CensusRecordStatus.APPROVED,
                    CensusRecordStatus.PROMOTED,
                }:
                    conflicts += 1
                    details.append(
                        {
                            "local_id": item.local_id,
                            "entity_type": "census_record",
                            "status": "CONFLICT",
                            "reason": "already_finalized",
                            "server_status": existing_rec.status.value,
                        }
                    )
                    continue
                existing_rec.given_names = item.data.get("given_names", existing_rec.given_names)
                existing_rec.family_name = item.data.get("family_name", existing_rec.family_name)
                existing_rec.sex = item.data.get("sex", existing_rec.sex)
                existing_rec.date_of_birth = item.data.get(
                    "date_of_birth", existing_rec.date_of_birth
                )
                existing_rec.payload = item.data.get("payload", existing_rec.payload)
                existing_rec.version = max(item.version, existing_rec.version)
                client_status = str(item.data.get("status") or "SYNCED").upper()
                if client_status == "DRAFT":
                    existing_rec.status = CensusRecordStatus.DRAFT
                else:
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
        elif item.entity_type == "coupon":
            from apps.api.domains.recensement.models import FieldCoupon

            existing_c = (
                await db.execute(
                    select(FieldCoupon).where(
                        FieldCoupon.campaign_id == req.campaign_id,
                        FieldCoupon.local_id == item.local_id,
                    )
                )
            ).scalar_one_or_none()
            payload = {
                "type": "nn_census_coupon",
                "v": 1,
                "local_id": item.local_id,
                "family_name": item.data.get("family_name"),
                "given_names": item.data.get("given_names"),
                "sex": item.data.get("sex"),
                "dob": item.data.get("date_of_birth") or item.data.get("dob"),
                "campaign_id": str(req.campaign_id),
                "household_id": item.data.get("household_local_id"),
                "ts": datetime.now(timezone.utc).isoformat(),
            }
            if existing_c is None:
                db.add(
                    FieldCoupon(
                        campaign_id=req.campaign_id,
                        local_id=item.local_id,
                        household_local_id=item.data.get("household_local_id"),
                        family_name=item.data.get("family_name"),
                        given_names=item.data.get("given_names"),
                        sex=item.data.get("sex"),
                        date_of_birth=item.data.get("date_of_birth") or item.data.get("dob"),
                        qr_payload=item.data.get("qr_payload") or payload,
                        agent_user_id=req.agent_user_id,
                        device_uid=req.device_uid,
                    )
                )
            else:
                existing_c.family_name = item.data.get("family_name", existing_c.family_name)
                existing_c.given_names = item.data.get("given_names", existing_c.given_names)
                existing_c.sex = item.data.get("sex", existing_c.sex)
                existing_c.date_of_birth = (
                    item.data.get("date_of_birth")
                    or item.data.get("dob")
                    or existing_c.date_of_birth
                )
                existing_c.qr_payload = item.data.get("qr_payload") or payload
            accepted += 1
            details.append(
                {
                    "local_id": item.local_id,
                    "entity_type": "coupon",
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
                "payload": r.payload,
                "photo_ref": r.photo_ref,
                "review_note": r.review_note,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "citizen_id": str(r.citizen_id) if r.citizen_id else None,
                "collected_by": str(r.collected_by) if r.collected_by else None,
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
    from apps.api.domains.geography.models import Commune, Province, Ville

    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise ValueError("campaign_not_found")

    province_code = (data.province_code or "").strip().upper() or None
    commune_code = (data.commune_code or "").strip() or None
    if not province_code:
        raise ValueError("province_code_required")
    prov = await db.scalar(select(Province).where(Province.code == province_code))
    if prov is None:
        raise ValueError("province_not_found")
    geo_level = data.geo_level or "COMMUNE"
    geo_ref_id = data.geo_ref_id
    if commune_code:
        commune = await db.scalar(select(Commune).where(Commune.code == commune_code))
        if commune is None:
            raise ValueError("commune_not_found")
        ville = await db.get(Ville, commune.ville_id)
        if ville is None or ville.province_id != prov.id:
            raise ValueError("commune_not_in_province")
        geo_level = "COMMUNE"
        geo_ref_id = commune.id
    else:
        geo_level = geo_level or "PROVINCE"
        geo_ref_id = geo_ref_id or prov.id

    zone = Zone(
        campaign_id=campaign_id,
        code=data.code,
        name=data.name,
        province_code=province_code,
        commune_code=commune_code,
        geo_level=geo_level,
        geo_ref_id=geo_ref_id,
        geo_bounds=data.geo_bounds,
    )
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
async def upsert_form_draft(
    db: AsyncSession,
    body: FormDraftCreate,
    *,
    owner_user_id: uuid.UUID,
) -> FormDraft:
    existing: FormDraft | None = None
    system = body.system.strip().lower()
    form_type = body.form_type.strip().lower()
    if body.local_id:
        existing = (
            await db.execute(
                select(FormDraft).where(
                    FormDraft.local_id == body.local_id,
                    FormDraft.system == system,
                    FormDraft.form_type == form_type,
                )
            )
        ).scalar_one_or_none()
    if existing is None:
        draft = FormDraft(
            system=system,
            form_type=form_type,
            title=body.title or "",
            payload=body.payload,
            status="DRAFT",
            version=max(body.version, 1),
            local_id=body.local_id,
            campaign_id=body.campaign_id,
            province_id=body.province_id,
            ville_id=body.ville_id,
            owner_user_id=owner_user_id,
        )
        db.add(draft)
    else:
        if existing.status == "FINALIZED":
            raise ValueError("draft_finalized")
        existing.title = body.title or existing.title
        existing.payload = body.payload
        existing.version = max(body.version, existing.version + 1)
        existing.campaign_id = body.campaign_id or existing.campaign_id
        existing.province_id = body.province_id or existing.province_id
        existing.ville_id = body.ville_id or existing.ville_id
        existing.status = "DRAFT"
        existing.updated_at = datetime.now(timezone.utc)
        draft = existing
    await db.commit()
    await db.refresh(draft)
    return draft


async def list_form_drafts(
    db: AsyncSession,
    *,
    system: str | None = None,
    form_type: str | None = None,
    status: str | None = "DRAFT",
    province_id: uuid.UUID | None = None,
    ville_id: uuid.UUID | None = None,
    campaign_id: uuid.UUID | None = None,
    q: str | None = None,
    limit: int = 50,
) -> list[FormDraft]:
    from sqlalchemy import or_, cast, String

    stmt = select(FormDraft).order_by(FormDraft.updated_at.desc()).limit(limit)
    if system:
        stmt = stmt.where(FormDraft.system == system.strip().lower())
    if form_type:
        stmt = stmt.where(FormDraft.form_type == form_type.strip().lower())
    if status:
        stmt = stmt.where(FormDraft.status == status)
    if province_id:
        stmt = stmt.where(FormDraft.province_id == province_id)
    if ville_id:
        stmt = stmt.where(FormDraft.ville_id == ville_id)
    if campaign_id:
        stmt = stmt.where(FormDraft.campaign_id == campaign_id)
    needle = (q or "").strip()
    if needle:
        like = f"%{needle}%"
        stmt = stmt.where(
            or_(
                FormDraft.title.ilike(like),
                FormDraft.local_id.ilike(like),
                FormDraft.system.ilike(like),
                FormDraft.form_type.ilike(like),
                cast(FormDraft.payload, String).ilike(like),
            )
        )
    return list((await db.execute(stmt)).scalars().all())


async def get_form_draft(db: AsyncSession, draft_id: uuid.UUID) -> FormDraft | None:
    return await db.get(FormDraft, draft_id)


async def update_form_draft(
    db: AsyncSession,
    draft: FormDraft,
    body: FormDraftUpdate,
    *,
    actor_id: uuid.UUID,
) -> FormDraft:
    if draft.status == "FINALIZED" and body.status != "FINALIZED":
        raise ValueError("draft_finalized")
    if body.title is not None:
        draft.title = body.title
    if body.payload is not None:
        draft.payload = body.payload
    if body.status is not None:
        draft.status = body.status
    if body.claimed_by is not None:
        draft.claimed_by = body.claimed_by
    elif body.status == "IN_PROGRESS":
        draft.claimed_by = actor_id
    if body.version is not None:
        draft.version = max(body.version, draft.version)
    if body.province_id is not None:
        draft.province_id = body.province_id
    if body.ville_id is not None:
        draft.ville_id = body.ville_id
    draft.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(draft)
    return draft


async def resolve_field_coupon(db: AsyncSession, raw: str) -> dict[str, Any]:
    """Resolve an APK census coupon QR (`nn_census_coupon`) for commune officers."""
    import json

    from apps.api.domains.recensement.models import CensusRecord, FieldCoupon

    text = (raw or "").strip()
    if not text:
        return {
            "found": False,
            "source": "not_found",
            "message": "QR vide",
        }

    payload: dict[str, Any] | None = None
    local_id: str | None = None
    campaign_id: uuid.UUID | None = None

    if text.startswith("{"):
        try:
            decoded = json.loads(text)
        except json.JSONDecodeError:
            return {
                "found": False,
                "source": "not_found",
                "message": "QR JSON invalide",
            }
        if not isinstance(decoded, dict):
            return {
                "found": False,
                "source": "not_found",
                "message": "QR non reconnu",
            }
        payload = decoded
        qtype = str(decoded.get("type") or "")
        if qtype and qtype != "nn_census_coupon":
            return {
                "found": False,
                "source": "not_found",
                "message": f"Type QR non supporté ({qtype})",
            }
        local_id = str(decoded.get("local_id") or "").strip() or None
        campaign_id = _parse_uuid(decoded.get("campaign_id"))
    else:
        local_id = text

    coupon: FieldCoupon | None = None
    if local_id and campaign_id:
        coupon = (
            await db.execute(
                select(FieldCoupon).where(
                    FieldCoupon.campaign_id == campaign_id,
                    FieldCoupon.local_id == local_id,
                )
            )
        ).scalar_one_or_none()
    if coupon is None and local_id:
        coupon = (
            await db.execute(
                select(FieldCoupon)
                .where(FieldCoupon.local_id == local_id)
                .order_by(FieldCoupon.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    record: CensusRecord | None = None
    if local_id:
        rec_q = select(CensusRecord).where(CensusRecord.local_id == local_id)
        if campaign_id:
            rec_q = rec_q.where(CensusRecord.campaign_id == campaign_id)
        record = (
            await db.execute(rec_q.order_by(CensusRecord.updated_at.desc()).limit(1))
        ).scalar_one_or_none()

    if coupon is not None:
        return {
            "found": True,
            "source": "db",
            "local_id": coupon.local_id,
            "campaign_id": coupon.campaign_id,
            "household_local_id": coupon.household_local_id,
            "family_name": coupon.family_name,
            "given_names": coupon.given_names,
            "sex": coupon.sex,
            "date_of_birth": coupon.date_of_birth,
            "coupon_id": coupon.id,
            "census_record_id": record.id if record else None,
            "qr_payload": coupon.qr_payload,
            "message": "Coupon synchronisé depuis l’APK",
        }

    if payload and local_id:
        return {
            "found": True,
            "source": "qr_only",
            "local_id": local_id,
            "campaign_id": campaign_id,
            "household_local_id": payload.get("household_local_id") or payload.get("household_id"),
            "family_name": payload.get("family_name"),
            "given_names": payload.get("given_names"),
            "sex": payload.get("sex"),
            "date_of_birth": payload.get("date_of_birth") or payload.get("dob"),
            "coupon_id": None,
            "census_record_id": record.id if record else None,
            "qr_payload": payload,
            "message": "Lu depuis le QR (pas encore synchronisé sur le serveur)",
        }

    if record is not None:
        return {
            "found": True,
            "source": "db",
            "local_id": record.local_id,
            "campaign_id": record.campaign_id,
            "household_local_id": None,
            "family_name": record.family_name,
            "given_names": record.given_names,
            "sex": record.sex,
            "date_of_birth": record.date_of_birth,
            "coupon_id": None,
            "census_record_id": record.id,
            "qr_payload": None,
            "message": "Fiche terrain trouvée (sans coupon)",
        }

    return {
        "found": False,
        "source": "not_found",
        "local_id": local_id,
        "campaign_id": campaign_id,
        "message": "Aucun coupon trouvé — synchronisez l’APK puis réessayez",
    }
