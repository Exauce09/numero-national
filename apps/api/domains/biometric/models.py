"""ORM models for schema `biometric` — isolated vault, no PII columns."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, Float, Integer, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.base import Base

FINGER_POSITIONS = (
    "POUCE_DROIT",
    "INDEX_DROIT",
    "MAJEUR_DROIT",
    "ANNULAIRE_DROIT",
    "AURICULAIRE_DROIT",
    "POUCE_GAUCHE",
    "INDEX_GAUCHE",
    "MAJEUR_GAUCHE",
    "ANNULAIRE_GAUCHE",
    "AURICULAIRE_GAUCHE",
)


class BiometricModality(str, enum.Enum):
    FINGERPRINT = "FINGERPRINT"
    FACE = "FACE"
    IRIS = "IRIS"


class DedupDecision(str, enum.Enum):
    MATCH_CONFIRMED = "MATCH_CONFIRMED"
    NO_MATCH = "NO_MATCH"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class FingerprintStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"
    REPLACED = "REPLACED"
    INVALID = "INVALID"
    PENDING = "PENDING"


class EnrollmentStatus(str, enum.Enum):
    OPEN = "OPEN"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


class MatchDecision(str, enum.Enum):
    NO_MATCH = "NO_MATCH"
    REVIEW = "REVIEW"
    STRONG_MATCH = "STRONG_MATCH"
    EXCEPTION_APPROVED = "EXCEPTION_APPROVED"
    REJECTED = "REJECTED"


class BiometricDevice(Base):
    __tablename__ = "biometric_devices"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(128))
    model: Mapped[str | None] = mapped_column(String(128))
    serial_number: Mapped[str | None] = mapped_column(String(128))
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BiometricThreshold(Base):
    __tablename__ = "biometric_thresholds"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    biometric_type: Mapped[str] = mapped_column(String(32), default="FINGERPRINT", nullable=False)
    environment: Mapped[str] = mapped_column(String(32), default="demo", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BiometricEnrollment(Base):
    __tablename__ = "biometric_enrollments"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(EnrollmentStatus, name="enrollment_status", schema="biometric", create_type=False),
        nullable=False,
        default=EnrollmentStatus.OPEN,
    )
    enrollment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    enrolled_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    required_fingers: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class BiometricTemplate(Base):
    """Encrypted biometric template. NEVER expose bytes via API responses."""

    __tablename__ = "biometric_templates"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    modality: Mapped[BiometricModality] = mapped_column(
        Enum(BiometricModality, name="biometric_modality", schema="biometric", create_type=False),
        nullable=False,
    )
    template_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    quality_score: Mapped[float | None] = mapped_column(Float)
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False, default="mvp-hash-v1")
    enrollment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    finger_position: Mapped[str | None] = mapped_column(String(32))
    hand: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[FingerprintStatus | None] = mapped_column(
        Enum(FingerprintStatus, name="fingerprint_status", schema="biometric", create_type=False),
        default=FingerprintStatus.ACTIVE,
    )
    template_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    capture_device: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BiometricMatch(Base):
    __tablename__ = "biometric_matches"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_citizen_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    matched_citizen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    source_fingerprint_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    matched_fingerprint_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    match_score: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_used: Mapped[float] = mapped_column(Float, nullable=False)
    decision: Mapped[MatchDecision] = mapped_column(
        Enum(MatchDecision, name="match_decision", schema="biometric", create_type=False),
        nullable=False,
    )
    review_status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
    finger_position: Mapped[str | None] = mapped_column(String(32))
    enrollment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class IdentityMedia(Base):
    __tablename__ = "identity_media"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    media_type: Mapped[str] = mapped_column(String(64), nullable=False, default="OFFICIAL_PHOTO")
    storage_uri: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DedupSession(Base):
    __tablename__ = "dedup_sessions"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    probe_citizen_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    modality: Mapped[BiometricModality] = mapped_column(
        Enum(BiometricModality, name="biometric_modality", schema="biometric", create_type=False),
        nullable=False,
    )
    candidates: Mapped[list[Any] | None] = mapped_column(JSONB)
    scores: Mapped[list[Any] | None] = mapped_column(JSONB)
    decision: Mapped[DedupDecision | None] = mapped_column(
        Enum(DedupDecision, name="dedup_decision", schema="biometric", create_type=False)
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
