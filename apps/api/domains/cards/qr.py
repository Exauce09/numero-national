"""QR payload builder and offline signature verification.

QR NEVER carries full identity — only {card_id, version, nonce, kid} + HMAC.
Uses dedicated QR_HMAC_KEY when configured.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from typing import Any
from uuid import UUID

from apps.api.core.config import get_settings


def _signing_key() -> bytes:
    return get_settings().qr_signing_key.encode("utf-8")


def _key_id() -> str:
    return get_settings().qr_key_id


def build_qr_payload(card_id: UUID, version: int, *, nonce: str | None = None) -> dict[str, Any]:
    """Minimal signed QR payload — no PII / NIC / names."""
    n = nonce or secrets.token_urlsafe(16)
    body = {
        "card_id": str(card_id),
        "version": int(version),
        "nonce": n,
        "kid": _key_id(),
    }
    canonical = json.dumps(body, separators=(",", ":"), sort_keys=True)
    signature = hmac.new(_signing_key(), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    return {**body, "sig": signature}


def verify_qr_signature(payload: dict[str, Any]) -> bool:
    """Offline verification of HMAC signature on minimal QR fields."""
    try:
        kid = str(payload.get("kid") or _key_id())
        if kid != _key_id():
            # Unknown key id — reject (rotation support: extend with keyring later)
            return False
        body = {
            "card_id": str(payload["card_id"]),
            "version": int(payload["version"]),
            "nonce": str(payload["nonce"]),
            "kid": kid,
        }
        provided = str(payload.get("sig") or "")
    except (KeyError, TypeError, ValueError):
        return False
    canonical = json.dumps(body, separators=(",", ":"), sort_keys=True)
    expected = hmac.new(_signing_key(), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)


def encode_qr_string(payload: dict[str, Any]) -> str:
    """Compact JSON string suitable for QR encoding."""
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)
