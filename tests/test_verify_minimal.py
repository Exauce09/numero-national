"""Lot 4 — réponse verify minimale + schéma."""

from __future__ import annotations

from apps.api.domains.analytics.schemas import IdentityVerifyResponse


def test_verify_response_has_minimal_fields():
    r = IdentityVerifyResponse(
        verified=True,
        identity_status="ACTIVE",
        status="ACTIVE",
        claims={"status": "ACTIVE", "alive": True},
    )
    dumped = r.model_dump()
    assert set(dumped.keys()) >= {"verified", "status", "claims", "identity_status"}
    assert "biometrics" not in dumped
    assert "addresses" not in dumped
    assert "family_name" not in dumped
