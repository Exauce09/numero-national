"""Health API schemas — minimal identity surface."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from apps.api.domains.health.models import FacilityType, NotificationStatus


class FacilityCreate(BaseModel):
    code: str
    name: str
    facility_type: FacilityType = FacilityType.HOSPITAL
    commune_code: str | None = None


class FacilityOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    facility_type: FacilityType
    commune_code: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VerifyIdentityRequest(BaseModel):
    citizen_reference: uuid.UUID | None = None
    sectoral_token: str | None = None


class VerifyIdentityResponse(BaseModel):
    verified: bool
    citizen_reference: uuid.UUID | None = None
    status: str
    message: str


class BirthDeclare(BaseModel):
    facility_id: uuid.UUID
    mother_citizen_reference: uuid.UUID | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class DeathDeclare(BaseModel):
    facility_id: uuid.UUID
    citizen_reference: uuid.UUID
    payload: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


class BirthNotificationOut(BaseModel):
    id: uuid.UUID
    facility_id: uuid.UUID
    mother_citizen_reference: uuid.UUID | None
    status: NotificationStatus
    civil_declaration_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeathNotificationOut(BaseModel):
    id: uuid.UUID
    facility_id: uuid.UUID
    citizen_reference: uuid.UUID
    status: NotificationStatus
    civil_declaration_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
