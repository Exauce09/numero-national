"""RDC administrative geography — provinces → villes → communes → quartiers → voies."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base


class Province(Base):
    __tablename__ = "provinces"
    __table_args__ = {"schema": "geography"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    chef_lieu: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    districts: Mapped[list["District"]] = relationship(back_populates="province")
    villes: Mapped[list["Ville"]] = relationship(back_populates="province")


class District(Base):
    __tablename__ = "districts"
    __table_args__ = (
        UniqueConstraint("province_id", "code", name="uq_district_province_code"),
        {"schema": "geography"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    province_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.provinces.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)

    province: Mapped[Province] = relationship(back_populates="districts")
    communes: Mapped[list["Commune"]] = relationship(back_populates="district")
    localites: Mapped[list["Localite"]] = relationship(back_populates="district")


class Ville(Base):
    __tablename__ = "villes"
    __table_args__ = (
        UniqueConstraint("province_id", "code", name="uq_ville_province_code"),
        {"schema": "geography"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    province_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.provinces.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_chef_lieu: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    province: Mapped[Province] = relationship(back_populates="villes")
    communes: Mapped[list["Commune"]] = relationship(back_populates="ville")


class Commune(Base):
    __tablename__ = "communes"
    __table_args__ = (
        UniqueConstraint("code", name="uq_commune_code"),
        {"schema": "geography"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ville_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.villes.id", ondelete="CASCADE"), nullable=False
    )
    district_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.districts.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)

    ville: Mapped[Ville] = relationship(back_populates="communes")
    district: Mapped[Optional[District]] = relationship(back_populates="communes")
    quartiers: Mapped[list["Quartier"]] = relationship(back_populates="commune")
    localites: Mapped[list["Localite"]] = relationship(back_populates="commune")


class Quartier(Base):
    __tablename__ = "quartiers"
    __table_args__ = (
        UniqueConstraint("commune_id", "code", name="uq_quartier_commune_code"),
        {"schema": "geography"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    commune_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.communes.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(48), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)

    commune: Mapped[Commune] = relationship(back_populates="quartiers")
    voies: Mapped[list["Voie"]] = relationship(back_populates="quartier")


class Localite(Base):
    __tablename__ = "localites"
    __table_args__ = (
        UniqueConstraint("code", name="uq_localite_code"),
        {"schema": "geography"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.districts.id", ondelete="SET NULL"), nullable=True
    )
    commune_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.communes.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(48), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)

    district: Mapped[Optional[District]] = relationship(back_populates="localites")
    commune: Mapped[Optional[Commune]] = relationship(back_populates="localites")


class Voie(Base):
    __tablename__ = "voies"
    __table_args__ = (
        UniqueConstraint("quartier_id", "code", name="uq_voie_quartier_code"),
        {"schema": "geography"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quartier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.quartiers.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    voie_type: Mapped[str] = mapped_column(String(16), nullable=False)  # AVENUE | RUE

    quartier: Mapped[Quartier] = relationship(back_populates="voies")
