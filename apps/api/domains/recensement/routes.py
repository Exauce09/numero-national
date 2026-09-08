"""Census HTTP routes — `/api/v1/census`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.recensement import service
from apps.api.domains.recensement.models import CampaignStatus
from apps.api.domains.recensement.schemas import (
    AgentStatsOut,
    CampaignCreate,
    CampaignOut,
    CampaignUpdate,
    DeviceOut,
    DeviceRegister,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResult,
)

router = APIRouter(prefix="/census", tags=["census"])


@router.post("/campaigns", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
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


@router.patch("/campaigns/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: uuid.UUID, body: CampaignUpdate, db: AsyncSession = Depends(get_db)
) -> CampaignOut:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return await service.update_campaign(db, campaign, body)  # type: ignore[return-value]


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await service.delete_campaign(db, campaign)


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
