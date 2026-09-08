"""Auth flow tests — register / login / me (dependency overrides + service stubs)."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pyotp
import pytest
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient

from apps.api.core.security import (
    bearer_scheme,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_mfa_secret,
    get_current_user,
    get_mfa_provisioning_uri,
    hash_password,
    verify_mfa_code,
    verify_password,
)
from apps.api.db.session import get_db
from apps.api.domains.identity.schemas import TokenPair, UserMe, UserRegister
from apps.api.main import app


def test_password_hash_roundtrip():
    hashed = hash_password("Str0ng-P@ssw0rd!")
    assert hashed != "Str0ng-P@ssw0rd!"
    assert verify_password("Str0ng-P@ssw0rd!", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_access_and_refresh():
    user_id = str(uuid4())
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    assert decode_token(access)["sub"] == user_id
    assert decode_token(access)["type"] == "access"
    assert decode_token(refresh)["type"] == "refresh"


def test_mfa_totp_helpers():
    secret = generate_mfa_secret()
    uri = get_mfa_provisioning_uri(secret, "agent@example.gov")
    assert "otpauth://" in uri
    code = pyotp.TOTP(secret).now()
    assert verify_mfa_code(secret, code)


class _FakeDB:
    async def commit(self) -> None:
        return None

    async def refresh(self, _obj) -> None:
        return None

    def add(self, _obj) -> None:
        return None


@pytest.fixture
def fake_user_store():
    return {}


@pytest.fixture
async def auth_client(monkeypatch, fake_user_store):
    """HTTP client with DB + identity service stubs (no PostgreSQL required)."""
    monkeypatch.setenv("ALLOW_OPEN_REGISTRATION", "true")
    monkeypatch.setenv("ALLOW_DEV_AUTH_HEADERS", "true")
    from apps.api.core.config import get_settings

    get_settings.cache_clear()

    async def _override_db():
        yield _FakeDB()

    app.dependency_overrides[get_db] = _override_db

    async def fake_seed(_db):
        return None

    async def fake_write_audit(*_args, **_kwargs):
        return SimpleNamespace(id=uuid4())

    async def fake_register(_db, payload: UserRegister):
        if payload.email.lower() in fake_user_store:
            raise HTTPException(status_code=409, detail="Email already registered")
        now = datetime.now(UTC)
        user = SimpleNamespace(
            id=uuid4(),
            email=payload.email.lower(),
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            is_active=True,
            mfa_enabled=False,
            mfa_secret=None,
            institution_id=payload.institution_id,
            roles=[],
            created_at=now,
            updated_at=now,
        )
        fake_user_store[user.email] = user
        return user

    async def fake_authenticate(_db, payload, lock_key=None):
        user = fake_user_store.get(payload.email.lower())
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        return TokenPair(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def fake_get_by_email(_db, email: str):
        return fake_user_store.get(email.lower())

    def fake_user_to_me(user) -> UserMe:
        return UserMe(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            mfa_enabled=user.mfa_enabled,
            institution_id=user.institution_id,
            roles=[],
            permissions=[],
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    async def override_get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    ):
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        uid = payload.get("sub")
        for user in fake_user_store.values():
            if str(user.id) == uid:
                return user
        raise HTTPException(status_code=401, detail="User inactive or not found")

    monkeypatch.setattr(
        "apps.api.domains.identity.routes.seed_roles_and_permissions", fake_seed
    )
    monkeypatch.setattr("apps.api.domains.identity.routes.write_audit", fake_write_audit)
    monkeypatch.setattr(
        "apps.api.domains.identity.routes.identity_services.register_user", fake_register
    )
    monkeypatch.setattr(
        "apps.api.domains.identity.routes.identity_services.authenticate_user",
        fake_authenticate,
    )
    monkeypatch.setattr(
        "apps.api.domains.identity.routes.identity_services.get_user_by_email",
        fake_get_by_email,
    )
    monkeypatch.setattr(
        "apps.api.domains.identity.routes.identity_services.user_to_me", fake_user_to_me
    )
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_register_login_me_flow(auth_client):
    register_payload = {
        "email": "agent.onip@example.gov",
        "password": "SecurePass123!",
        "full_name": "Agent ONIP",
    }
    reg = await auth_client.post("/api/v1/auth/register", json=register_payload)
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body["email"] == "agent.onip@example.gov"
    assert body["full_name"] == "Agent ONIP"

    login = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": register_payload["email"], "password": register_payload["password"]},
    )
    assert login.status_code == 200, login.text
    tokens = login.json()
    assert tokens["token_type"] == "bearer"
    assert "access_token" in tokens

    me = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "agent.onip@example.gov"
    assert me.json()["id"] == body["id"]


@pytest.mark.asyncio
async def test_me_requires_auth(auth_client):
    response = await auth_client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_rejects_bad_password(auth_client):
    await auth_client.post(
        "/api/v1/auth/register",
        json={
            "email": "ops@example.gov",
            "password": "SecurePass123!",
            "full_name": "Ops",
        },
    )
    bad = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": "ops@example.gov", "password": "wrong-password"},
    )
    assert bad.status_code == 401
