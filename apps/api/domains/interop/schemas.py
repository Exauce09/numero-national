"""Schemas for interop client-credentials flow."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ClientCredentialsRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=128)
    client_secret: str = Field(min_length=1, max_length=256)
    scope: str | None = Field(
        default=None,
        description="Space-separated scopes; defaults to all scopes granted to the client",
    )


class ServiceTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    scope: str
