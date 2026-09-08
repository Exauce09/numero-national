"""SQLAlchemy models for schema identity — sectoral tokens (hashed at rest)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.base import Base
from apps.api.domains.token_service.enums import TokenSector, TokenStatus


class IdentityToken(Base):
    """Opaque sectoral token — plaintext returned once; only hash stored."""

    __tablename__ = "identity_tokens"
    __table_args__ = (
        Index("ix_identity_tokens_citizen_sector", "citizen_id", "sector"),
        {"schema": "identity"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    citizen_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sector: Mapped[str] = mapped_column(String(32), nullable=False, default=TokenSector.OTHER.value)
    # Legacy plaintext column kept nullable for migration; prefer token_hash.
    token_value: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    token_prefix: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TokenStatus.ACTIVE.value,
        server_default=TokenStatus.ACTIVE.value,
        index=True,
    )
    institution_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TokenUsageLog(Base):
    """Local usage audit trail — RESTRICT delete to preserve history."""

    __tablename__ = "token_usage_log"
    __table_args__ = {"schema": "identity"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    token_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.identity_tokens.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
