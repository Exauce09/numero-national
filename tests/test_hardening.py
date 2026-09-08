"""Hardening tests — auth headers gated, JWT claims, tokens hashed, QR kid."""

from __future__ import annotations

import hashlib

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.config import get_settings
from apps.api.core.security import create_access_token, create_service_access_token, decode_token
from apps.api.domains.token_service.service import hash_token
from apps.api.main import app


def test_access_token_type_cannot_be_overwritten():
    token = create_access_token("user-1", extra_claims={"type": "service", "sub": "evil"})
    payload = decode_token(token)
    assert payload["type"] == "access"
    assert payload["sub"] == "user-1"


def test_service_token_has_forced_type():
    token = create_service_access_token("client-abc", scopes=["identity:verify"])
    payload = decode_token(token, expected_type="service")
    assert payload["type"] == "service"
    assert payload["client_id"] == "client-abc"
    assert payload["scopes"] == ["identity:verify"]


def test_token_hash_is_sha256():
    raw = "opaque-sectoral-token-value-example"
    assert hash_token(raw) == hashlib.sha256(raw.encode()).hexdigest()
    assert hash_token(raw) != raw


@pytest.mark.asyncio
async def test_dev_headers_disabled_without_flag(monkeypatch):
    monkeypatch.setenv("ALLOW_DEV_AUTH_HEADERS", "false")
    monkeypatch.setenv("ALLOW_OPEN_REGISTRATION", "true")
    get_settings.cache_clear()
    # Rebuild principal path uses fresh settings
    from apps.api.core import permissions as perms

    assert get_settings().dev_header_auth_enabled is False

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/registry/citizens",
            headers={"X-Permissions": "registry:citizen:read"},
        )
    # Without Bearer and without dev headers → 401
    assert response.status_code == 401
    get_settings.cache_clear()
    monkeypatch.setenv("ALLOW_DEV_AUTH_HEADERS", "true")
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_security_headers_present():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert "X-Request-Id" in response.headers
