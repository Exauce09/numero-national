"""Enumerations for sectoral identity tokens."""

from __future__ import annotations

from enum import StrEnum


class TokenSector(StrEnum):
    HEALTH = "HEALTH"
    EDUCATION = "EDUCATION"
    FINANCE = "FINANCE"
    INSTITUTION = "INSTITUTION"
    OTHER = "OTHER"


class TokenStatus(StrEnum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"
