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
    sex: str | None = None
    date_of_birth: str | None = None
    status: CensusRecordStatus
    version: int
    collected_by: uuid.UUID | None = None
    reviewed_by: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    review_note: str | None = None
    citizen_id: uuid.UUID | None = None
    promoted_by: uuid.UUID | None = None
    promoted_at: datetime | None = None
    synced_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class RecordReviewRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class RecordRejectRequest(BaseModel):
    note: str = Field(min_length=3, max_length=2000)


class PromoteRequest(BaseModel):
    """Promote an APPROVED census fiche into core_registry."""

    assign_nic: bool = False
    force_despite_duplicates: bool = False
    override_justification: str | None = Field(default=None, max_length=2000)


class PromoteResult(BaseModel):
    census_record_id: uuid.UUID
    citizen_id: uuid.UUID
    nic: str | None = None
    citizen_status: str
    already_promoted: bool = False
    nic_assigned: bool = False
    nic_error: str | None = None


class BatchPromoteRequest(BaseModel):
    assign_nic: bool = False
    limit: int = Field(default=50, ge=1, le=200)


class BatchPromoteResult(BaseModel):
    promoted: int
    skipped: int
    failed: int
    results: list[PromoteResult] = Field(default_factory=list)
    errors: list[dict[str, Any]] = Field(default_factory=list)


class CampaignStatsOut(BaseModel):
    campaign_id: uuid.UUID
    households: int
    records: int
    by_status: dict[str, int]
    synced: int
    approved: int
    rejected: int
    promoted: int
    conflicts: int
    pending_review: int


class ZoneCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    commune_code: str | None = None
    province_code: str | None = None
    geo_level: str | None = Field(default=None, max_length=32)
    geo_ref_id: uuid.UUID | None = None
    geo_bounds: dict[str, Any] | None = None


class ZoneOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    code: str
    name: str
    commune_code: str | None
    province_code: str | None
    geo_level: str | None = None
    geo_ref_id: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class TeamCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    zone_id: uuid.UUID | None = None


class TeamOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    code: str
    name: str
    zone_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class AssignmentCreate(BaseModel):
    agent_user_id: uuid.UUID
    role_label: str = "CENSUS_AGENT"
    active: bool = True


class AssignmentOut(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    agent_user_id: uuid.UUID
    role_label: str
    active: bool
    assigned_at: datetime

    model_config = {"from_attributes": True}


class MyAssignmentOut(BaseModel):
    assignment_id: uuid.UUID
    role_label: str
    active: bool
    assigned_at: datetime
    team: TeamOut
    zone: ZoneOut | None
    campaign: CampaignOut


class FormDraftCreate(BaseModel):
    system: str = Field(min_length=2, max_length=32, description="civil_officer | flutter_census | onip")
    form_type: str = Field(min_length=2, max_length=64, description="ex. census_person")
    title: str = Field(default="", max_length=255)
    payload: dict[str, Any]
    local_id: str | None = Field(default=None, max_length=128)
    campaign_id: uuid.UUID | None = None
    province_id: uuid.UUID | None = None
    ville_id: uuid.UUID | None = None
    version: int = Field(default=1, ge=1)


class FormDraftUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    payload: dict[str, Any] | None = None
    status: str | None = Field(default=None, max_length=32)
    claimed_by: uuid.UUID | None = None
    version: int | None = Field(default=None, ge=1)
    province_id: uuid.UUID | None = None
    ville_id: uuid.UUID | None = None


class FormDraftOut(BaseModel):
    id: uuid.UUID
    system: str
    form_type: str
    title: str
    payload: dict[str, Any]
    status: str
    version: int
    local_id: str | None
    campaign_id: uuid.UUID | None
    province_id: uuid.UUID | None
    ville_id: uuid.UUID | None
    owner_user_id: uuid.UUID
    claimed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

