"""Census HTTP routes — `/api/v1/census`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import PERM_CENSUS_MANAGE, PERM_CENSUS_SYNC
from apps.api.core.security import get_current_user, require_permissions
from apps.api.db.session import get_db
from apps.api.domains.identity.models import User
from apps.api.domains.recensement import service
from apps.api.domains.recensement.models import CampaignStatus
from apps.api.domains.recensement.schemas import (
    AgentStatsOut,
    AssignmentCreate,
    AssignmentOut,
    CampaignCreate,
    CampaignOut,
    CampaignUpdate,
    DeviceOut,
    DeviceRegister,
    MyAssignmentOut,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResult,
    TeamCreate,
    TeamOut,
    ZoneCreate,
    ZoneOut,
)

router = APIRouter(prefix="/census", tags=["census"])


@router.post(
    "/campaigns",
    response_model=CampaignOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def create_campaign(body: CampaignCreate, db: AsyncSession = Depends(get_db)) -> CampaignOut:
    return await service.create_campaign(db, body)  # type: ignore[return-value]


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(
    status_filter: CampaignStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> list[CampaignOut]:
    return await service.list_campaigns(db, status_filter)  # type: ignore[return-value]


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> CampaignOut:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign  # type: ignore[return-value]


@router.patch(
    "/campaigns/{campaign_id}",
    response_model=CampaignOut,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def update_campaign(
    campaign_id: uuid.UUID, body: CampaignUpdate, db: AsyncSession = Depends(get_db)
) -> CampaignOut:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return await service.update_campaign(db, campaign, body)  # type: ignore[return-value]


@router.delete(
    "/campaigns/{campaign_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def delete_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await service.delete_campaign(db, campaign)


@router.post(
    "/campaigns/{campaign_id}/zones",
    response_model=ZoneOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def create_zone(
    campaign_id: uuid.UUID, body: ZoneCreate, db: AsyncSession = Depends(get_db)
) -> ZoneOut:
    try:
        return await service.create_zone(db, campaign_id, body)  # type: ignore[return-value]
    except ValueError as exc:
        if str(exc) == "campaign_not_found":
            raise HTTPException(status_code=404, detail="Campaign not found") from exc
        raise


@router.get("/campaigns/{campaign_id}/zones", response_model=list[ZoneOut])
async def list_zones(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[ZoneOut]:
    return await service.list_zones(db, campaign_id)  # type: ignore[return-value]


@router.post(
    "/campaigns/{campaign_id}/teams",
    response_model=TeamOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def create_team(
    campaign_id: uuid.UUID, body: TeamCreate, db: AsyncSession = Depends(get_db)
) -> TeamOut:
    try:
        return await service.create_team(db, campaign_id, body)  # type: ignore[return-value]
    except ValueError as exc:
        detail = {
            "campaign_not_found": "Campaign not found",
            "zone_not_found": "Zone not found for this campaign",
        }.get(str(exc), str(exc))
        raise HTTPException(status_code=404, detail=detail) from exc


@router.get("/campaigns/{campaign_id}/teams", response_model=list[TeamOut])
async def list_teams(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[TeamOut]:
    return await service.list_teams(db, campaign_id)  # type: ignore[return-value]


@router.post(
    "/teams/{team_id}/assignments",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def assign_agent(
    team_id: uuid.UUID, body: AssignmentCreate, db: AsyncSession = Depends(get_db)
) -> AssignmentOut:
    try:
        return await service.assign_agent(db, team_id, body)  # type: ignore[return-value]
    except ValueError as exc:
        if str(exc) == "team_not_found":
            raise HTTPException(status_code=404, detail="Team not found") from exc
        raise


@router.get(
    "/teams/{team_id}/assignments",
    response_model=list[AssignmentOut],
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def list_assignments(
    team_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[AssignmentOut]:
    return await service.list_team_assignments(db, team_id)  # type: ignore[return-value]


@router.get(
    "/agents/me/assignments",
    response_model=list[MyAssignmentOut],
    dependencies=[Depends(require_permissions(PERM_CENSUS_SYNC))],
)
async def my_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MyAssignmentOut]:
    return await service.list_my_assignments(db, current_user.id)


@router.post("/devices/register", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def register_device(body: DeviceRegister, db: AsyncSession = Depends(get_db)) -> DeviceOut:
    return await service.register_device(db, body)  # type: ignore[return-value]


@router.post("/sync/push", response_model=SyncPushResult)
async def sync_push(body: SyncPushRequest, db: AsyncSession = Depends(get_db)) -> SyncPushResult:
    return await service.sync_push(db, body)


@router.post("/sync/pull", response_model=SyncPullResponse)
async def sync_pull(body: SyncPullRequest, db: AsyncSession = Depends(get_db)) -> SyncPullResponse:
    return await service.sync_pull(db, body)


@router.get("/agents/{agent_user_id}/stats", response_model=AgentStatsOut)
async def get_agent_stats(
    agent_user_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> AgentStatsOut:
    return await service.agent_stats(db, agent_user_id)
