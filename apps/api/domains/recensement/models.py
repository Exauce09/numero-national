"""ORM models for schema `recensement` (Phase 3)."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"


class SyncBatchStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    ACCEPTED = "ACCEPTED"
    PARTIAL = "PARTIAL"
    REJECTED = "REJECTED"


class CensusRecordStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    QUEUED = "QUEUED"
    SYNCED = "SYNCED"
    CONFLICT = "CONFLICT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PROMOTED = "PROMOTED"


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus, name="campaign_status", schema="recensement"),
        default=CampaignStatus.DRAFT,
        nullable=False,
    )
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    zones: Mapped[list[Zone]] = relationship(back_populates="campaign")
    teams: Mapped[list[Team]] = relationship(back_populates="campaign")


class Zone(Base):
    __tablename__ = "zones"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.campaigns.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    commune_code: Mapped[str | None] = mapped_column(String(32))
    province_code: Mapped[str | None] = mapped_column(String(32))
    geo_level: Mapped[str | None] = mapped_column(String(32))  # PROVINCE|COMMUNE|QUARTIER|…
    geo_ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    geo_bounds: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    campaign: Mapped[Campaign] = relationship(back_populates="zones")
    teams: Mapped[list["Team"]] = relationship(back_populates="zone")


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.campaigns.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.zones.id")
    )

    campaign: Mapped[Campaign] = relationship(back_populates="teams")
    zone: Mapped[Zone | None] = relationship(back_populates="teams")
    assignments: Mapped[list[AgentAssignment]] = relationship(back_populates="team")


class AgentAssignment(Base):
    __tablename__ = "agent_assignments"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.teams.id"), nullable=False, index=True
    )
    agent_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    role_label: Mapped[str] = mapped_column(String(64), default="CENSUS_AGENT")
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    team: Mapped[Team] = relationship(back_populates="assignments")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    agent_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    platform: Mapped[str | None] = mapped_column(String(64))
    app_version: Mapped[str | None] = mapped_column(String(32))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Household(Base):
    __tablename__ = "households"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.campaigns.id"), nullable=False, index=True
    )
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.zones.id")
    )
    local_id: Mapped[str | None] = mapped_column(String(128), index=True)
    address_line: Mapped[str | None] = mapped_column(String(512))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    collected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.devices.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    records: Mapped[list[CensusRecord]] = relationship(back_populates="household")


class CensusRecord(Base):
    """Field draft of a citizen — not the authoritative Core Registry row."""

    __tablename__ = "census_records"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.households.id"), nullable=False, index=True
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.campaigns.id"), nullable=False, index=True
    )
    local_id: Mapped[str | None] = mapped_column(String(128), index=True)
    given_names: Mapped[str | None] = mapped_column(String(255))
    family_name: Mapped[str | None] = mapped_column(String(255))
    sex: Mapped[str | None] = mapped_column(String(16))
    date_of_birth: Mapped[str | None] = mapped_column(String(32))
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    photo_ref: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[CensusRecordStatus] = mapped_column(
        Enum(CensusRecordStatus, name="census_record_status", schema="recensement"),
        default=CensusRecordStatus.DRAFT,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    collected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_note: Mapped[str | None] = mapped_column(Text)
    citizen_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    promoted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    household: Mapped[Household] = relationship(back_populates="records")


class SyncBatch(Base):
    __tablename__ = "sync_batches"
    __table_args__ = {"schema": "recensement"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recensement.devices.id")
    )
    agent_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    direction: Mapped[str] = mapped_column(String(16), nullable=False)  # PULL | PUSH
    status: Mapped[SyncBatchStatus] = mapped_column(
        Enum(SyncBatchStatus, name="sync_batch_status", schema="recensement"),
        default=SyncBatchStatus.PENDING,
        nullable=False,
    )
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    conflict_count: Mapped[int] = mapped_column(Integer, default=0)
    payload_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
