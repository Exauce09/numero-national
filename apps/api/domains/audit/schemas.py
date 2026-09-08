"""Pydantic schemas for audit events."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_id: UUID | None
    institution_id: UUID | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip: str | None
    device: str | None
    result: str
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    justification: str | None
    created_at: datetime


class AuditEventList(BaseModel):
    items: list[AuditEventRead]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)
