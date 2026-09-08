"""Pydantic schemas for citizen portal /me endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class IdentitySummary(BaseModel):
    citizen_id: UUID
    nic: str | None = None
    given_names: str | None = None
    family_name: str | None = None
    status: str | None = None
    digital_identity_status: str | None = None
    card_status: str | None = None


class CorrectionRequestCreate(BaseModel):
    field_name: str
    current_value: str | None = None
    requested_value: str
    justification: str = Field(min_length=5)


class CorrectionRequestRead(BaseModel):
    id: UUID
    citizen_id: UUID
    field_name: str
    current_value: str | None
    requested_value: str
    justification: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AccessLogEntry(BaseModel):
    id: UUID | str | None = None
    action: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    actor_id: str | None = None
    institution_id: str | None = None
    result: str | None = None
    created_at: datetime | str | None = None
    source: str = "audit"
