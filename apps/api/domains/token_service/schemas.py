"""Pydantic schemas for sectoral identity tokens."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from apps.api.domains.token_service.enums import TokenSector, TokenStatus


class TokenGenerateRequest(BaseModel):
    citizen_id: UUID
    sector: TokenSector
    institution_id: UUID | None = None


class TokenGenerateResponse(BaseModel):
    """Plaintext `token` is returned ONCE — store client-side; server keeps hash only."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    citizen_id: UUID
    sector: TokenSector
    token: str = Field(description="Opaque secret — shown once")
    token_prefix: str
    status: TokenStatus
    institution_id: UUID | None
    created_at: datetime


class TokenLookupRequest(BaseModel):
    """POST body for resolve/revoke — never put secrets in URL paths."""

    token: str = Field(min_length=16, max_length=256)


class TokenResolveResponse(BaseModel):
    token_id: UUID
    citizen_id: UUID
    sector: TokenSector
    status: TokenStatus
    institution_id: UUID | None


class TokenRevokeResponse(BaseModel):
    token_id: UUID
    token_prefix: str
    status: TokenStatus
    revoked_at: datetime
