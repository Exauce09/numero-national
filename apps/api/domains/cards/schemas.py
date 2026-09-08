"""Pydantic schemas for cards / verification API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.domains.cards.enums import CardStatus, DigitalIdentityStatus


class CardIssueRequest(BaseModel):
    citizen_id: UUID
    expires_at: datetime | None = None
    version: int = 1


class CardRead(BaseModel):
    card_id: UUID
    citizen_id: UUID
    serial_number: str
    issued_at: datetime | None
    expires_at: datetime | None
    status: str
    version: int
    replaced_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
    qr_payload: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class CardActionRequest(BaseModel):
    reason: str | None = None


class ReplaceCardRequest(BaseModel):
    reason: str | None = "replacement"
    expires_at: datetime | None = None


class OfflineVerifyRequest(BaseModel):
    """Minimal QR fields + signature."""

    card_id: UUID
    version: int
    nonce: str
    sig: str


class OfflineVerifyResponse(BaseModel):
    valid_signature: bool
    level: str
    message: str


class OnlineVerifyRequest(BaseModel):
    card_id: UUID | None = None
    serial_number: str | None = None
    qr: OfflineVerifyRequest | None = None
    requested_claims: list[str] = Field(default_factory=lambda: ["status", "expires_at"])


class OnlineVerifyResponse(BaseModel):
    valid: bool
    level: str
    status: str | None
    claims: dict[str, Any]
    message: str


class DigitalIdentityCreate(BaseModel):
    citizen_id: UUID
    status: DigitalIdentityStatus = DigitalIdentityStatus.PENDING
    notes: str | None = None


class DigitalIdentityRead(BaseModel):
    id: UUID
    citizen_id: UUID
    status: str
    created_at: datetime
    notes: str | None = None

    model_config = {"from_attributes": True}
