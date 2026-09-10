"""Card domain enumerations and verification level constants."""

from __future__ import annotations

from enum import StrEnum


class CardStatus(StrEnum):
    PENDING = "PENDING"
    """Émise à l'ONIP, en attente d'envoi commune."""
    SENT_TO_COMMUNE = "SENT_TO_COMMUNE"
    """Retournée à la commune pour remise au citoyen."""
    DELIVERED = "DELIVERED"
    """Remise physiquement au titulaire (active ensuite)."""
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    LOST = "LOST"
    STOLEN = "STOLEN"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"
    REPLACED = "REPLACED"


class DigitalIdentityStatus(StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    REVOKED = "REVOKED"


class CardHistoryEvent(StrEnum):
    ISSUED = "ISSUED"
    DISPATCHED_TO_COMMUNE = "DISPATCHED_TO_COMMUNE"
    DELIVERED_TO_HOLDER = "DELIVERED_TO_HOLDER"
    ACTIVATED = "ACTIVATED"
    SUSPENDED = "SUSPENDED"
    REPORTED_LOST = "REPORTED_LOST"
    REPORTED_STOLEN = "REPORTED_STOLEN"
    REPLACED = "REPLACED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"
    VERIFIED_ONLINE = "VERIFIED_ONLINE"
    VERIFIED_OFFLINE = "VERIFIED_OFFLINE"


# Verification assurance levels (cahier / eIDAS-inspired ladder).
LEVEL_0 = "LEVEL_0"  # Anonymous / no identity binding
LEVEL_1 = "LEVEL_1"  # Self-asserted / low
LEVEL_2 = "LEVEL_2"  # Card present + signature
LEVEL_3 = "LEVEL_3"  # Online status check + allowed claims
LEVEL_4 = "LEVEL_4"  # Biometric / high assurance (future)

VERIFICATION_LEVELS: dict[str, dict[str, str | int]] = {
    LEVEL_0: {"code": LEVEL_0, "assurance": 0, "description": "No binding"},
    LEVEL_1: {"code": LEVEL_1, "assurance": 1, "description": "Low / self-asserted"},
    LEVEL_2: {"code": LEVEL_2, "assurance": 2, "description": "Offline QR signature"},
    LEVEL_3: {"code": LEVEL_3, "assurance": 3, "description": "Online status + claims"},
    LEVEL_4: {"code": LEVEL_4, "assurance": 4, "description": "Biometric high assurance"},
}

PERM_CARD_ISSUE = "cards:issue"
PERM_CARD_MANAGE = "cards:manage"
PERM_CARD_VERIFY = "cards:verify"
