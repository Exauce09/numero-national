"""Analytics schemas + relying-party verify response."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AggregateMetricOut(BaseModel):
    id: uuid.UUID
    metric_key: str
    dimension: dict[str, Any] | None
    value: float
    period: str
    computed_at: datetime

    model_config = {"from_attributes": True}


class RefreshResult(BaseModel):
    refreshed: int
    period: str
    computed_at: datetime


class IdentityVerifyRequest(BaseModel):
    """Relying party verification — opaque token or NIC hash reference."""

    token: str | None = None
    nic: str | None = None
    requested_claims: list[str] = Field(
        default_factory=lambda: ["status", "alive"],
        description="Allowed claim keys only — never full dossier",
    )


class IdentityVerifyResponse(BaseModel):
    verified: bool
    status: str
    claims: dict[str, Any]
