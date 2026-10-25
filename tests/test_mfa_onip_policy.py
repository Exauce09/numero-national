"""Lot 4 — MFA signalée pour permissions sensibles."""

from __future__ import annotations

from uuid import uuid4

from apps.api.core.permissions import (
    PERM_BIOMETRIC_MATCH,
    PERM_CITIZEN_VALIDATE,
    PERM_ONIP_DASHBOARD,
    Principal,
    SENSITIVE_ONIP_PERMISSIONS,
    mfa_status_for,
)


def test_sensitive_set_includes_validate_and_bio():
    assert PERM_CITIZEN_VALIDATE in SENSITIVE_ONIP_PERMISSIONS
    assert PERM_BIOMETRIC_MATCH in SENSITIVE_ONIP_PERMISSIONS


def test_mfa_recommended_when_sensitive_without_mfa():
    p = Principal(
        actor_id=uuid4(),
        permissions=frozenset({PERM_CITIZEN_VALIDATE, PERM_ONIP_DASHBOARD}),
        mfa_enabled=False,
    )
    st = mfa_status_for(p)
    assert st["mfa_recommended"] is True
    assert PERM_CITIZEN_VALIDATE in st["sensitive_permissions_held"]


def test_mfa_ok_when_enabled():
    p = Principal(
        actor_id=uuid4(),
        permissions=frozenset({PERM_CITIZEN_VALIDATE}),
        mfa_enabled=True,
    )
    st = mfa_status_for(p)
    assert st["mfa_recommended"] is False
    assert st["mfa_enforced"] is False
