"""Document domain enumerations."""

from __future__ import annotations

from enum import StrEnum


class DocumentStatus(StrEnum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    REVOKED = "REVOKED"
    SUPERSEDED = "SUPERSEDED"


class DocumentType(StrEnum):
    CIVIL_ACT_EXTRACT = "CIVIL_ACT_EXTRACT"
    RESIDENCE_ATTESTATION = "RESIDENCE_ATTESTATION"
    NATIONAL_CARD_FACE = "NATIONAL_CARD_FACE"
    DIGITAL_ID_CERTIFICATE = "DIGITAL_ID_CERTIFICATE"
    OTHER = "OTHER"


PERM_DOC_READ = "documents:read"
PERM_DOC_WRITE = "documents:write"
