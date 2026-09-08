"""Biometric API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from apps.api.domains.biometric.models import BiometricModality, DedupDecision


class TemplateEnroll(BaseModel):
    citizen_id: uuid.UUID
    modality: BiometricModality
    # Client sends base64 or raw hex; service encrypts/stores bytes.
    template_b64: str = Field(min_length=8, description="Base64-encoded template bytes")
    quality_score: float | None = Field(default=None, ge=0, le=100)
    algorithm_version: str = "mvp-hash-v1"


class TemplateOut(BaseModel):
    id: uuid.UUID
    citizen_id: uuid.UUID
    modality: BiometricModality
    quality_score: float | None
    algorithm_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VerifyRequest(BaseModel):
    """1:1 verification against a known citizen."""

    citizen_id: uuid.UUID
    modality: BiometricModality
    template_b64: str


class VerifyResponse(BaseModel):
    matched: bool
    score: float
    algorithm_version: str
    note: str = (
        "MVP simulates matching via template hash comparison. "
        "Replace with certified ABIS for production."
    )


class IdentifyRequest(BaseModel):
    """1:N identification — probe against gallery."""

    modality: BiometricModality
    template_b64: str
    max_candidates: int = Field(default=5, ge=1, le=50)


class IdentifyCandidate(BaseModel):
    citizen_id: uuid.UUID
    template_id: uuid.UUID
    score: float


class IdentifyResponse(BaseModel):
    candidates: list[IdentifyCandidate]
    decision: DedupDecision
    session_id: uuid.UUID
    note: str = (
        "MVP simulates 1:N via hash equality / Hamming-like stub. "
        "Real ABIS (AFIS) must replace this service."
    )


class MediaRefCreate(BaseModel):
    citizen_id: uuid.UUID
    media_type: str = "OFFICIAL_PHOTO"
    storage_uri: str
    content_hash: str | None = None


class MediaRefOut(BaseModel):
    id: uuid.UUID
    citizen_id: uuid.UUID
    media_type: str
    storage_uri: str
    content_hash: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DedupSessionOut(BaseModel):
    id: uuid.UUID
    probe_citizen_id: uuid.UUID | None
    modality: BiometricModality
    candidates: list[Any] | None
    scores: list[Any] | None
    decision: DedupDecision | None
    created_at: datetime

    model_config = {"from_attributes": True}
