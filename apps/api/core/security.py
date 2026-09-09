"""Authentication and authorization primitives (JWT, passwords, MFA, deps)."""

from __future__ import annotations

import base64
import hashlib
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import bcrypt
import jwt
import pyotp
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.core.config import Settings, get_settings
from apps.api.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------


def validate_password_strength(password: str, settings: Settings | None = None) -> None:
    """Enforce minimum password policy; raise HTTP 400 on failure.

    Policy: at least PASSWORD_MIN_LENGTH characters (default 8).
    """
    cfg = settings or get_settings()
    if len(password) < cfg.password_min_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le mot de passe doit contenir au moins {cfg.password_min_length} caractères",
        )
    if len(password) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe ne peut pas dépasser 128 caractères",
        )


def hash_password(password: str, settings: Settings | None = None) -> str:
    """Hash a plaintext password with bcrypt (configurable cost)."""
    cfg = settings or get_settings()
    rounds = max(10, min(cfg.bcrypt_rounds, 16))
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=rounds),
    ).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Return True if password matches the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# MFA secret encryption (Fernet key derived from SECRET_KEY — placeholder KMS)
# ---------------------------------------------------------------------------


def _fernet_from_settings(settings: Settings | None = None) -> Fernet:
    """Derive a Fernet key from MFA_ENCRYPTION_KEY (or SECRET_KEY). Prefer KMS in prod."""
    cfg = settings or get_settings()
    digest = hashlib.sha256(cfg.mfa_secret_material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_mfa_secret(secret: str, settings: Settings | None = None) -> str:
    """Encrypt a TOTP secret for storage."""
    return _fernet_from_settings(settings).encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_mfa_secret(token: str, settings: Settings | None = None) -> str:
    """Decrypt a stored TOTP secret."""
    try:
        return _fernet_from_settings(settings).decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Invalid MFA secret ciphertext") from exc


# ---------------------------------------------------------------------------
# MFA TOTP helpers
# ---------------------------------------------------------------------------


def generate_mfa_secret() -> str:
    """Generate a new base32 TOTP secret."""
    return pyotp.random_base32()


def build_totp(secret: str, settings: Settings | None = None) -> pyotp.TOTP:
    """Build a TOTP instance from secret and app MFA settings."""
    cfg = settings or get_settings()
    return pyotp.TOTP(
        secret,
        digits=cfg.mfa_digits,
        interval=cfg.mfa_interval,
        issuer=cfg.mfa_issuer,
    )


def get_mfa_provisioning_uri(
    secret: str,
    account_name: str,
    settings: Settings | None = None,
) -> str:
    """OTP Auth URI for authenticator apps."""
    cfg = settings or get_settings()
    totp = build_totp(secret, cfg)
    return totp.provisioning_uri(name=account_name, issuer_name=cfg.mfa_issuer)


def verify_mfa_code(
    secret: str,
    code: str,
    settings: Settings | None = None,
) -> bool:
    """Verify a TOTP code against the secret."""
    cfg = settings or get_settings()
    totp = build_totp(secret, cfg)
    return bool(totp.verify(code, valid_window=cfg.mfa_valid_window))


# ---------------------------------------------------------------------------
# JWT access + refresh tokens
# ---------------------------------------------------------------------------


_PROTECTED_CLAIMS = frozenset({"type", "sub", "exp", "iat", "nbf", "jti"})


def create_access_token(
    subject: str,
    *,
    extra_claims: dict[str, Any] | None = None,
    settings: Settings | None = None,
) -> str:
    """Create a short-lived access JWT. `type`/`sub` cannot be overwritten by extras."""
    cfg = settings or get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "iat": now,
        "exp": now + timedelta(minutes=cfg.access_token_expire_minutes),
    }
    if extra_claims:
        payload.update({k: v for k, v in extra_claims.items() if k not in _PROTECTED_CLAIMS})
    payload["sub"] = subject
    payload["type"] = "access"
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def create_refresh_token(
    subject: str,
    *,
    extra_claims: dict[str, Any] | None = None,
    settings: Settings | None = None,
) -> str:
    """Create a longer-lived refresh JWT."""
    cfg = settings or get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "iat": now,
        "exp": now + timedelta(days=cfg.refresh_token_expire_days),
        "jti": str(__import__("uuid").uuid4()),
    }
    if extra_claims:
        payload.update({k: v for k, v in extra_claims.items() if k not in _PROTECTED_CLAIMS})
    payload["sub"] = subject
    payload["type"] = "refresh"
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def decode_token(
    token: str,
    settings: Settings | None = None,
    *,
    expected_type: str | None = None,
) -> dict[str, Any]:
    """Decode and validate a JWT; optionally enforce token type."""
    cfg = settings or get_settings()
    try:
        payload = jwt.decode(token, cfg.jwt_secret, algorithms=[cfg.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if expected_type is not None and payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Any:
    """Resolve the authenticated user from a Bearer access token."""
    # Local import avoids circular imports with domain models.
    from apps.api.domains.identity.models import Role, User

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials, settings)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(str(subject))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive or not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def user_permission_codes(user: Any) -> set[str]:
    """Collect permission codes granted via the user's roles."""
    codes: set[str] = set()
    for role in getattr(user, "roles", []) or []:
        for perm in getattr(role, "permissions", []) or []:
            codes.add(perm.code)
    return codes


def require_permissions(
    *codes: str,
) -> Callable[..., Coroutine[Any, Any, Any]]:
    """Dependency factory: require the current user to hold all given permission codes."""

    async def _dependency(current_user: Any = Depends(get_current_user)) -> Any:
        held = user_permission_codes(current_user)
        missing = [c for c in codes if c not in held]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return current_user

    return _dependency


def create_service_access_token(
    client_id: str,
    scopes: list[str],
    *,
    settings: Settings | None = None,
) -> str:
    """JWT for service-to-service clients — dedicated builder, type forced to service."""
    cfg = settings or get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": client_id,
        "client_id": client_id,
        "scopes": scopes,
        "type": "service",
        "iat": now,
        "exp": now + timedelta(minutes=cfg.access_token_expire_minutes),
    }
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)
