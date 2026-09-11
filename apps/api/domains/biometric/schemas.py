"""Biometric API schemas — never expose template bytes in responses."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from apps.api.domains.biometric.models import (
    BiometricModality,
    DedupDecision,
    EnrollmentStatus,
    MatchDecision,
)


class TemplateEnroll(BaseModel):
    citizen_id: uuid.UUID
    modality: BiometricModality = BiometricModality.FINGERPRINT
    template_b64: str = Field(min_length=8, description="Base64-encoded template bytes")
    quality_score: float | None = Field(default=None, ge=0, le=100)
    algorithm_version: str = "mvp-hash-v1"
    finger_position: str | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    citizen_id: uuid.UUID
    modality: BiometricModality
    quality_score: float | None
    algorithm_version: str
    finger_position: str | None = None
    status: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VerifyRequest(BaseModel):
    citizen_id: uuid.UUID
    modality: BiometricModality = BiometricModality.FINGERPRINT
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
    modality: BiometricModality = BiometricModality.FINGERPRINT
    template_b64: str
    max_candidates: int = Field(default=5, ge=1, le=50)


class IdentifyCandidate(BaseModel):
    citizen_id: uuid.UUID
    template_id: uuid.UUID
    score: float
    finger_position: str | None = None
    finger_label: str | None = None


class IdentifyResponse(BaseModel):
    candidates: list[IdentifyCandidate]
    decision: DedupDecision
    session_id: uuid.UUID
    thresholds: dict[str, float] | None = None
    note: str = (
        "MVP 1:N via LocalHashProvider stub. Real ABIS must replace this service. "
        "A biometric match is not automatic legal proof."
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


class EnrollmentCreate(BaseModel):
    citizen_id: uuid.UUID
    device_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None


class EnrollmentOut(BaseModel):
    id: uuid.UUID
    citizen_id: uuid.UUID
    status: EnrollmentStatus
    required_fingers: int
    fingerprints_count: int = 0
    enrolled_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class CaptureFingerRequest(BaseModel):
    finger_position: str
    template_b64: str = Field(min_length=8)
    quality_score: float | None = Field(default=None, ge=0, le=100)
    capture_device: str | None = None


class MatchOut(BaseModel):
    id: uuid.UUID
    matched_citizen_id: uuid.UUID
    match_score: float
    threshold_used: float
    decision: MatchDecision
    finger_position: str | None = None
    matched_finger_label: str | None = None
    review_status: str
    created_at: datetime


class CaptureFingerResponse(BaseModel):
    accepted: bool
    blocked: bool
    decision: DedupDecision
    finger_position: str
    fingerprint_id: uuid.UUID | None = None
    quality_score: float | None = None
    match: MatchOut | None = None
    candidates: list[IdentifyCandidate] = Field(default_factory=list)
    message: str
    enrollment_id: uuid.UUID
    fingerprints_count: int
    required_fingers: int


class FingerprintListItem(BaseModel):
    id: uuid.UUID
    finger_position: str
    finger_label: str
    hand: str | None
    quality_score: float | None
    status: str
    created_at: datetime


class MatchReviewRequest(BaseModel):
    approve_exception: bool = False
    reason: str | None = None


class RevokeRequest(BaseModel):
    reason: str = Field(min_length=5)


class StatsOut(BaseModel):
    enrollments: int
    fingerprints_active: int
    matches_total: int
    strong_matches: int
    pending_reviews: int
    blocked_enrollments: int
    average_quality: float | None
    note: str


class ThresholdOut(BaseModel):
    id: uuid.UUID
    name: str
    value: float
    biometric_type: str
    environment: str
    active: bool

    model_config = {"from_attributes": True}
