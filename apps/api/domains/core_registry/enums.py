"""Enumerations for the Core Registry domain."""

from __future__ import annotations

from enum import StrEnum


class CitizenStatus(StrEnum):
    """Statuts citoyen FGP (convention projet).

    Mapping métier demandé (cahier ONIP) → existant :
    - DRAFT → DRAFT
    - SUBMITTED / UNDER_REVIEW → PENDING_VALIDATION (ou statut fiche recensement)
    - DUPLICATE_REVIEW → DuplicateCandidate OPEN + verification FLAGGED_DUPLICATE
    - APPROVED → validation métier recensement (distinct du NIC)
    - IDENTIFIED → ACTIVE avec nic non nul (NIN attribué)
    - REJECTED / CORRECTION_PENDING → flux sectoriels (ne pas dupliquer ici)
    - DECEASED → DECEASED
    """

    DRAFT = "DRAFT"
    PENDING_VALIDATION = "PENDING_VALIDATION"
    ACTIVE = "ACTIVE"
    DECEASED = "DECEASED"
    MERGED = "MERGED"
    SUSPENDED = "SUSPENDED"


class Sex(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    UNKNOWN = "UNKNOWN"


class AddressType(StrEnum):
    RESIDENTIAL = "RESIDENTIAL"
    POSTAL = "POSTAL"
    BIRTH = "BIRTH"
    OTHER = "OTHER"


class RelationType(StrEnum):
    PARENT = "PARENT"
    CHILD = "CHILD"
    SPOUSE = "SPOUSE"
    GUARDIAN = "GUARDIAN"
    OTHER = "OTHER"


class DuplicateStatus(StrEnum):
    OPEN = "OPEN"
    CONFIRMED_DUPLICATE = "CONFIRMED_DUPLICATE"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    MERGED = "MERGED"


class DuplicateMatchMethod(StrEnum):
    DEMOGRAPHIC = "DEMOGRAPHIC"
    BIOMETRIC = "BIOMETRIC"
    GEO_CIVIL = "GEO_CIVIL"


class VerificationStatus(StrEnum):
    UNVERIFIED = "UNVERIFIED"
    PENDING_DEDUP = "PENDING_DEDUP"
    VERIFIED = "VERIFIED"
    FLAGGED_DUPLICATE = "FLAGGED_DUPLICATE"


class CitizenEventType(StrEnum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    VALIDATED = "VALIDATED"
    NIC_ASSIGNED = "NIC_ASSIGNED"
    MERGED = "MERGED"
    STATUS_CHANGED = "STATUS_CHANGED"
    ZD_CHANGED = "ZD_CHANGED"
