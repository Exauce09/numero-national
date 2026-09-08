"""SQLAlchemy models for schema core_registry."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base
from apps.api.domains.core_registry.enums import (
    AddressType,
    CitizenStatus,
    DuplicateStatus,
    RelationType,
    Sex,
)


class Citizen(Base):
    """Canonical citizen record. NIC is system-assigned only."""

    __tablename__ = "citizens"
    __table_args__ = (
        Index("ix_core_registry_citizens_name_dob", "family_name", "given_names", "date_of_birth"),
        {"schema": "core_registry"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    nic: Mapped[str | None] = mapped_column(String(13), unique=True, nullable=True, index=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=CitizenStatus.DRAFT.value,
        server_default=CitizenStatus.DRAFT.value,
        index=True,
    )
    sex: Mapped[str] = mapped_column(String(16), nullable=False, default=Sex.UNKNOWN.value)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    place_of_birth: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nationality: Mapped[str] = mapped_column(String(3), nullable=False, default="COD")
    given_names: Mapped[str] = mapped_column(String(255), nullable=False)
    family_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deceased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merged_into_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="SET NULL"),
        nullable=True,
    )

    addresses: Mapped[list[CitizenAddress]] = relationship(
        back_populates="citizen",
        cascade="all, delete-orphan",
    )
    history: Mapped[list[CitizenHistory]] = relationship(
        back_populates="citizen",
        cascade="all, delete-orphan",
        order_by="CitizenHistory.created_at",
    )


class CitizenAddress(Base):
    """Address history for a citizen."""

    __tablename__ = "citizen_addresses"
    __table_args__ = {"schema": "core_registry"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    citizen_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    address_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=AddressType.RESIDENTIAL.value,
    )
    line1: Mapped[str] = mapped_column(String(255), nullable=False)
    line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    commune_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    province_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False, default="COD")
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    citizen: Mapped[Citizen] = relationship(back_populates="addresses")


class FamilyRelation(Base):
    """Declared family / legal relationship between two citizens."""

    __tablename__ = "family_relations"
    __table_args__ = (
        UniqueConstraint(
            "citizen_id",
            "related_citizen_id",
            "relation_type",
            name="uq_family_relation_pair_type",
        ),
        {"schema": "core_registry"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    citizen_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    related_citizen_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False)
    legal_basis: Mapped[str | None] = mapped_column(Text, nullable=True)


class CitizenHistory(Base):
    """Append-only event log for citizen lifecycle changes."""

    __tablename__ = "citizen_history"
    __table_args__ = {"schema": "core_registry"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    citizen_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    citizen: Mapped[Citizen] = relationship(back_populates="history")


class NicIssuanceLog(Base):
    """Append-only attribution journal for NIC issuance (system-only)."""

    __tablename__ = "nic_issuance_log"
    __table_args__ = {"schema": "core_registry"}

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
    nic: Mapped[str] = mapped_column(String(13), nullable=False, unique=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_system: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="CORE_REGISTRY",
        server_default="CORE_REGISTRY",
    )


class DuplicateCandidate(Base):
    """Demographic duplicate suspicion between two citizens."""

    __tablename__ = "duplicate_candidates"
    __table_args__ = (
        UniqueConstraint(
            "citizen_a_id",
            "citizen_b_id",
            name="uq_duplicate_pair",
        ),
        {"schema": "core_registry"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    citizen_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    citizen_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core_registry.citizens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=DuplicateStatus.OPEN.value,
        server_default=DuplicateStatus.OPEN.value,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
