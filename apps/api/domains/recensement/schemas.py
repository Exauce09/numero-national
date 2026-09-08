"""Pydantic schemas for census API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from apps.api.domains.recensement.models import CampaignStatus, CensusRecordStatus


class CampaignCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: CampaignStatus | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class CampaignOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    status: CampaignStatus
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceRegister(BaseModel):
    device_uid: str = Field(min_length=4, max_length=128)
    platform: str | None = None
    app_version: str | None = None
    agent_user_id: uuid.UUID | None = None


class DeviceOut(BaseModel):
    id: uuid.UUID
    device_uid: str
    platform: str | None
    app_version: str | None
    is_active: bool
    registered_at: datetime

    model_config = {"from_attributes": True}


class SyncPushItem(BaseModel):
    entity_type: str  # household | census_record
    local_id: str
    version: int = 1
    data: dict[str, Any]


class SyncPushRequest(BaseModel):
    device_uid: str
    agent_user_id: uuid.UUID | None = None
    campaign_id: uuid.UUID
    items: list[SyncPushItem]


class SyncPushResult(BaseModel):
    batch_id: uuid.UUID
    accepted: int
    conflicts: int
    details: list[dict[str, Any]] = Field(default_factory=list)


class SyncPullRequest(BaseModel):
    device_uid: str
    campaign_id: uuid.UUID
    since: datetime | None = None


class SyncPullResponse(BaseModel):
    batch_id: uuid.UUID
    campaigns: list[CampaignOut]
    households: list[dict[str, Any]]
    records: list[dict[str, Any]]
    server_time: datetime


class AgentStatsOut(BaseModel):
    agent_user_id: uuid.UUID
    households_collected: int
    records_collected: int
    synced_records: int
    conflict_records: int
    last_sync_at: datetime | None


class CensusRecordOut(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    campaign_id: uuid.UUID
    local_id: str | None
    given_names: str | None
    family_name: str | None
    status: CensusRecordStatus
    version: int

    model_config = {"from_attributes": True}
