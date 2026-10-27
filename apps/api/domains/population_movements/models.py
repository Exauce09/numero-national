"""ORM Module 12 — schéma `population_movements` (événements liés au FGP, jamais de NIN)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.base import Base

MOVEMENT_TYPES = (
    "CHANGE_OF_RESIDENCE",
    "INTERNAL_MIGRATION",
    "TEMPORARY_MOBILITY",
    "FORCED_DISPLACEMENT",
    "RETURN_RESETTLEMENT",
    "INTERNATIONAL",
    "COLLECTIVE",
)

MOVEMENT_STATUSES = (
    "DRAFT",
    "SUBMITTED",
    "IN_REVIEW",
    "COMPLEMENT_REQUIRED",
    "VALIDATED",
    "REJECTED",
    "CANCELLED",
    "CONTESTED",
)

SOURCE_TYPES = (
    "AGENT",
    "CITIZEN",
    "CENSUS",
    "CIVIL",
    "PARTNER",
    "IMPORT",
)


class PopulationMovement(Base):
    __tablename__ = "population_movements"
    __table_args__ = (
        UniqueConstraint(
            "source_type",
            "source_reference",
            name="uq_population_movements_source_ref",
        ),
        {"schema": "population_movements"},
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
    movement_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT", index=True)
    declared_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    observed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="AGENT")
    source_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reason_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes_minimal: Mapped[str | None] = mapped_column(String(500), nullable=True)

    origin_province_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    origin_commune_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    origin_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    destination_province_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    destination_commune_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    destination_city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    destination_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    destination_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    sensitivity_class: Mapped[str] = mapped_column(
        String(32), nullable=False, default="STANDARD", server_default="STANDARD"
    )
    update_fgp_residence: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    fgp_residence_applied: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    validated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    version: Mapped[int] = mapped_column(nullable=False, default=1, server_default="1")
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class MovementEventHistory(Base):
    __tablename__ = "movement_event_history"
    __table_args__ = {"schema": "population_movements"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    movement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("population_movements.population_movements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    old_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
