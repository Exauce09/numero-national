"""ORM models for schema `biometric` — isolated vault, no PII columns."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, Float, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.base import Base


class BiometricModality(str, enum.Enum):
    FINGERPRINT = "FINGERPRINT"
    FACE = "FACE"
    IRIS = "IRIS"


class DedupDecision(str, enum.Enum):
    MATCH_CONFIRMED = "MATCH_CONFIRMED"
    NO_MATCH = "NO_MATCH"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class BiometricTemplate(Base):
    """Encrypted biometric template. NEVER join/store into citizens table."""

    __tablename__ = "biometric_templates"
    __table_args__ = {"schema": "biometric"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    modality: Mapped[BiometricModality] = mapped_column(
        Enum(BiometricModality, name="biometric_modality", schema="biometric"),
        nullable=False,
    )
    template_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    quality_score: Mapped[float | None] = mapped_column(Float)
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False, default="mvp-hash-v1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class IdentityMedia(Base):
    """Official photo / media references in a separate conceptual vault table."""

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
        Enum(DedupDecision, name="dedup_decision", schema="biometric")
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
