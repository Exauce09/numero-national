"""SQLAlchemy models for schema etat_civil."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.base import Base
from apps.api.domains.etat_civil.enums import (
    ActStatus,
    DeclarationSource,
    DeclarationStatus,
    ResidenceStatus,
)


class CivilAct(Base):
    """Acte d'état civil (naissance, mariage, décès, …)."""

    __tablename__ = "civil_acts"
    __table_args__ = (
        UniqueConstraint("act_number", "commune_code", name="uq_civil_acts_number_commune"),
        Index("ix_civil_acts_commune_type", "commune_code", "act_type"),
        Index("ix_civil_acts_citizen", "citizen_id"),
        {"schema": "etat_civil"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    act_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    act_number: Mapped[str] = mapped_column(String(64), nullable=False)
    commune_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ActStatus.DRAFT.value,
        server_default=ActStatus.DRAFT.value,
        index=True,
    )
    citizen_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    related_citizen_ids: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CivilDeclaration(Base):
    """Déclaration hospitalière / communale → workflow officier d'état civil."""

    __tablename__ = "civil_declarations"
    __table_args__ = (
        Index("ix_civil_declarations_status", "status"),
        {"schema": "etat_civil"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    source: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=DeclarationSource.HOSPITAL.value,
    )
    declaration_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=DeclarationStatus.RECEIVED.value,
        server_default=DeclarationStatus.RECEIVED.value,
    )
    linked_act_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("etat_civil.civil_acts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ResidenceRecord(Base):
    """Attestation / enregistrement de résidence."""

    __tablename__ = "residence_records"
    __table_args__ = (
        UniqueConstraint("attestation_number", name="uq_residence_attestation_number"),
        Index("ix_residence_citizen", "citizen_id"),
        {"schema": "etat_civil"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    citizen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    line1: Mapped[str] = mapped_column(String(255), nullable=False)
    line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    commune_code: Mapped[str] = mapped_column(String(32), nullable=False)
    province_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False, default="COD")
    attestation_number: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ResidenceStatus.ACTIVE.value,
        server_default=ResidenceStatus.ACTIVE.value,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CorrectionRequest(Base):
    """Demande de correction initiée depuis le portail citoyen."""

    __tablename__ = "correction_requests"
    __table_args__ = {"schema": "etat_civil"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    citizen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(128), nullable=False)
    current_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_value: Mapped[str] = mapped_column(Text, nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="SUBMITTED", server_default="SUBMITTED"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

