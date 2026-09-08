"""Pydantic schemas for documents API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.domains.documents.enums import DocumentStatus


class DocumentCreate(BaseModel):
    type: str
    version: int = 1
    institution_id: UUID | None = None
    citizen_id: UUID | None = None
    content_base64: str = Field(..., description="Document bytes as base64")
    storage_uri: str | None = None
    meta: dict[str, Any] | None = None
    status: DocumentStatus = DocumentStatus.ISSUED


class DocumentUpdate(BaseModel):
    status: DocumentStatus | None = None
    storage_uri: str | None = None
    meta: dict[str, Any] | None = None


class DocumentRead(BaseModel):
    document_id: UUID
    type: str
    version: int
    institution_id: UUID | None
    citizen_id: UUID | None
    status: str
    content_hash: str
    signature: str
    qr_payload: dict[str, Any] | None
    storage_uri: str | None
    meta: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HashVerifyRequest(BaseModel):
    content_base64: str
    expected_hash: str | None = None
    document_id: UUID | None = None


class HashVerifyResponse(BaseModel):
    match: bool
    computed_hash: str
    expected_hash: str | None
    document_id: UUID | None = None
