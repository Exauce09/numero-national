"""Core Registry domain — citizens, NIC attribution, demographic dedup."""

from apps.api.domains.core_registry.models import (
    Citizen,
    CitizenAddress,
    CitizenHistory,
    DuplicateCandidate,
    FamilyRelation,
    NicIssuanceLog,
)

__all__ = [
    "Citizen",
    "CitizenAddress",
    "CitizenHistory",
    "DuplicateCandidate",
    "FamilyRelation",
    "NicIssuanceLog",
]
