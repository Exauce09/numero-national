"""Enumerations for the état civil domain."""

from __future__ import annotations

from enum import StrEnum


class ActType(StrEnum):
    BIRTH = "BIRTH"
    MARRIAGE = "MARRIAGE"
    DIVORCE = "DIVORCE"
    DEATH = "DEATH"
    RECOGNITION = "RECOGNITION"
    ADOPTION = "ADOPTION"
    RECTIFICATION = "RECTIFICATION"
    RESIDENCE_ATTESTATION = "RESIDENCE_ATTESTATION"


class ActStatus(StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"


class DeclarationSource(StrEnum):
    HOSPITAL = "HOSPITAL"
    COMMUNE = "COMMUNE"
    CITIZEN = "CITIZEN"


class DeclarationType(StrEnum):
    BIRTH = "BIRTH"
    DEATH = "DEATH"


class DeclarationStatus(StrEnum):
    RECEIVED = "RECEIVED"
    PENDING_OFFICER = "PENDING_OFFICER"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"


class ResidenceStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"
    REVOKED = "REVOKED"


# Permission codes (header-gated until full RBAC wiring).
PERM_CIVIL_READ = "civil:act:read"
PERM_CIVIL_WRITE = "civil:act:write"
PERM_CIVIL_VALIDATE = "civil:act:validate"
PERM_CIVIL_STATS = "civil:stats:read"
