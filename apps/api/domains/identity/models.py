"""Identity domain — users, institutions, roles, permissions (schema: identity)."""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base


class AccountStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DISABLED = "DISABLED"
    EXPIRED = "EXPIRED"


class PersonnelStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LEFT = "LEFT"


class AssignmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    SUSPENDED = "SUSPENDED"


class ScopeType(str, enum.Enum):
    NATIONAL = "NATIONAL"
    PROVINCE = "PROVINCE"
    VILLE = "VILLE"
    COMMUNE = "COMMUNE"
    BUREAU = "BUREAU"


class AccountRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class BureauStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    CLOSED = "CLOSED"


class InstitutionType(str, enum.Enum):
    """Types d'institutions du système national."""

    MINISTRY = "MINISTRY"
    COMMUNE = "COMMUNE"
    HOSPITAL = "HOSPITAL"
    ONIP = "ONIP"
    PRESIDENCY = "PRESIDENCY"
    PRIMATURE = "PRIMATURE"
    ORGANIZATION = "ORGANIZATION"
    RELYING_PARTY = "RELYING_PARTY"
    OTHER = "OTHER"


class InstitutionStatus(str, enum.Enum):
    """Statut opérationnel d'une institution."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("identity.roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        UUID(as_uuid=True),
        ForeignKey("identity.permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    schema="identity",
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("identity.users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("identity.roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    schema="identity",
)


class Institution(Base):
    """Organisation / institution partenaire ou étatique."""

    __tablename__ = "institutions"
    __table_args__ = (
        UniqueConstraint("code", name="uq_institutions_code"),
        {"schema": "identity"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[InstitutionType] = mapped_column(
        Enum(InstitutionType, name="institution_type", schema="identity"),
        nullable=False,
    )
    status: Mapped[InstitutionStatus] = mapped_column(
        Enum(InstitutionStatus, name="institution_status", schema="identity"),
        nullable=False,
        default=InstitutionStatus.ACTIVE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    users: Mapped[list[User]] = relationship("User", back_populates="institution")


class Permission(Base):
    """Permission atomique (resource + action)."""

    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("code", name="uq_permissions_code"),
        {"schema": "identity"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    resource: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)

    roles: Mapped[list[Role]] = relationship(
        "Role",
        secondary=role_permissions,
        back_populates="permissions",
    )


class Role(Base):
    """Rôle métier assignable aux utilisateurs."""

    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("code", name="uq_roles_code"),
        {"schema": "identity"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    permissions: Mapped[list[Permission]] = relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles",
    )
    users: Mapped[list[User]] = relationship(
        "User",
        secondary=user_roles,
        back_populates="roles",
    )


class User(Base):
    """Compte opérateur / agent (pas de citoyen / NIC ici)."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        {"schema": "identity"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Ciphertext placeholder — Fernet derived from SECRET_KEY (KMS later).
    mfa_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    institution_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.institutions.id", ondelete="SET NULL"),
        nullable=True,
    )
    personnel_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.personnel.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    account_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=AccountStatus.ACTIVE.value, server_default="ACTIVE"
    )
    disabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Périmètre géographique type élections RDC : province → ville (+ commune optionnelle).
    province_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("geography.provinces.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ville_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("geography.villes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    commune_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("geography.communes.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    institution: Mapped[Optional[Institution]] = relationship(
        "Institution", back_populates="users"
    )
    personnel: Mapped[Optional["Personnel"]] = relationship(
        "Personnel", back_populates="users", foreign_keys=[personnel_id]
    )
    roles: Mapped[list[Role]] = relationship(
        "Role",
        secondary=user_roles,
        back_populates="users",
    )
    territorial_scopes: Mapped[list["TerritorialScope"]] = relationship(
        "TerritorialScope", back_populates="user", cascade="all, delete-orphan"
    )


class Personnel(Base):
    """Agent administratif (avant compte informatique)."""

    __tablename__ = "personnel"
    __table_args__ = (
        UniqueConstraint("matricule", name="uq_personnel_matricule"),
        {"schema": "identity"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    matricule: Mapped[str] = mapped_column(String(64), nullable=False)
    family_name: Mapped[str] = mapped_column(String(128), nullable=False)
    postnom: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    given_names: Mapped[str] = mapped_column(String(128), nullable=False)
    function_title: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    phone_pro: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email_pro: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    date_entree: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date_sortie: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    users: Mapped[list[User]] = relationship(
        "User", back_populates="personnel", foreign_keys="User.personnel_id"
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        "Assignment", back_populates="personnel", cascade="all, delete-orphan"
    )


class BureauEtatCivil(Base):
    """Bureau d'état civil rattaché au référentiel territorial."""

    __tablename__ = "bureaux_etat_civil"
    __table_args__ = (
        UniqueConstraint("code", name="uq_bureaux_etat_civil_code"),
        {"schema": "etat_civil"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    bureau_type: Mapped[str] = mapped_column(String(32), nullable=False, default="PRINCIPAL")
    province_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.provinces.id", ondelete="SET NULL"), nullable=True
    )
    ville_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.villes.id", ondelete="SET NULL"), nullable=True
    )
    commune_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.communes.id", ondelete="SET NULL"), nullable=True
    )
    commune_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ressort: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Assignment(Base):
    """Affectation officielle personnel × bureau/fonction."""

    __tablename__ = "assignments"
    __table_args__ = {"schema": "identity"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    personnel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("identity.personnel.id", ondelete="CASCADE"), nullable=False
    )
    bureau_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("etat_civil.bureaux_etat_civil.id", ondelete="RESTRICT"),
        nullable=True,
    )
    province_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geography.provinces.id", ondelete="SET NULL"), nullable=True
    )
    function_code: Mapped[str] = mapped_column(String(64), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    assigned_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="SET NULL"), nullable=True
    )
    justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    document_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    personnel: Mapped[Personnel] = relationship("Personnel", back_populates="assignments")


class TerritorialScope(Base):
    """Périmètre territorial d'accès d'un compte."""

    __tablename__ = "territorial_scopes"
    __table_args__ = {"schema": "identity"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False
    )
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    territory_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    bureau_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("etat_civil.bureaux_etat_civil.id", ondelete="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship("User", back_populates="territorial_scopes")


class AccountRequest(Base):
    """Demande de création de compte (workflow d'approbation)."""

    __tablename__ = "account_requests"
    __table_args__ = {"schema": "identity"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    personnel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("identity.personnel.id", ondelete="CASCADE"), nullable=False
    )
    requested_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="SET NULL"), nullable=True
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_role: Mapped[str] = mapped_column(String(64), nullable=False)
    requested_scope_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    requested_bureau_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    requested_province_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="SET NULL"), nullable=True
    )


class RefreshSession(Base):
    """Persisted refresh-token jti (hashed) for rotation and logout revocation."""

    __tablename__ = "refresh_sessions"
    __table_args__ = {"schema": "identity"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    jti_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_jti_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
