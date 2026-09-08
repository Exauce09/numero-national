"""Health ORM models — citizen_reference UUID only, no national identity field copies."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.base import Base


class FacilityType(str, enum.Enum):
    HOSPITAL = "HOSPITAL"
    CLINIC = "CLINIC"
    MATERNITY = "MATERNITY"
    OTHER = "OTHER"


class NotificationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    FORWARDED_CIVIL = "FORWARDED_CIVIL"
    REJECTED = "REJECTED"


class HealthFacility(Base):
    __tablename__ = "health_facilities"
    __table_args__ = {"schema": "health"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    facility_type: Mapped[FacilityType] = mapped_column(
        Enum(FacilityType, name="facility_type", schema="health"),
        default=FacilityType.HOSPITAL,
        nullable=False,
    )
    commune_code: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class HealthRecord(Base):
    """Clinical / administrative health record linked by citizen_reference only."""

    __tablename__ = "health_records"
    __table_args__ = {"schema": "health"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_reference: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    record_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # Clinical payload — never duplicate NIC / names / DOB from core registry.
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BirthNotification(Base):
    __tablename__ = "birth_notifications"
    __table_args__ = {"schema": "health"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    mother_citizen_reference: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    # Birth details for civil handoff — no permanent national identity fields.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="health_notification_status", schema="health"),
        default=NotificationStatus.DRAFT,
        nullable=False,
    )
    civil_declaration_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DeathNotification(Base):
    __tablename__ = "death_notifications"
    __table_args__ = {"schema": "health"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    citizen_reference: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="health_notification_status", schema="health", create_type=False),
        default=NotificationStatus.DRAFT,
        nullable=False,
    )
    civil_declaration_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
