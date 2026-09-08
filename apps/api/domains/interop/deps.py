"""Service-to-service auth dependencies and simple rate-limit stub.

Rate limiting
-------------
This module provides an **in-memory** sliding-window stub suitable for local
development and single-process demos only.

Production must replace this with a distributed limiter (e.g. Redis / API
gateway) before multi-instance deployment. Do not rely on process memory for
enforcement across replicas.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Any
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import Settings, get_settings
from apps.api.core.security import decode_token, verify_password
from apps.api.db.session import get_db
from apps.api.domains.interop.services import get_client_by_id

service_bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# In-memory rate limit stub (documented — not production-ready)
# ---------------------------------------------------------------------------

_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_DEFAULT_LIMIT = 60  # requests
_DEFAULT_WINDOW_SECONDS = 60


def check_rate_limit(
    key: str,
    *,
    limit: int = _DEFAULT_LIMIT,
    window_seconds: int = _DEFAULT_WINDOW_SECONDS,
) -> None:
    """
    Simple in-memory rate limiter.

    STUB: single-process only. Replace with Redis/token-bucket at the edge
    for production multi-instance deployments.
    """
    now = time.monotonic()
    bucket = _RATE_BUCKETS[key]
    cutoff = now - window_seconds
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )
    bucket.append(now)


async def rate_limit_dependency(request: Request) -> None:
    """FastAPI dependency applying the in-memory rate-limit stub per client IP."""
    host = request.client.host if request.client else "unknown"
    check_rate_limit(f"ip:{host}")


# ---------------------------------------------------------------------------
# Service JWT / API key authentication
# ---------------------------------------------------------------------------


async def get_current_service(
    credentials: HTTPAuthorizationCredentials | None = Depends(service_bearer),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    x_client_id: str | None = Header(default=None, alias="X-Client-Id"),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """
    Authenticate a machine client via:
    1) Bearer service JWT (type=service), or
    2) X-API-Key + X-Client-Id (API key = client_secret).
    """
    if credentials is not None and credentials.scheme.lower() == "bearer":
        payload = decode_token(credentials.credentials, settings, expected_type="service")
        client_id = payload.get("client_id") or payload.get("sub")
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid service token subject",
            )
        client = await get_client_by_id(db, str(client_id))
        if client is None or not client.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Service client inactive or unknown",
            )
        return {
            "client_id": client.client_id,
            "scopes": list(client.scopes or payload.get("scopes") or []),
            "institution_id": str(client.institution_id) if client.institution_id else None,
            "auth_method": "jwt",
        }

    if x_api_key and x_client_id:
        client = await get_client_by_id(db, x_client_id)
        if (
            client is None
            or not client.is_active
            or not verify_password(x_api_key, client.client_secret_hash)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key credentials",
            )
        return {
            "client_id": client.client_id,
            "scopes": list(client.scopes or []),
            "institution_id": str(client.institution_id) if client.institution_id else None,
            "auth_method": "api_key",
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Service authentication required (Bearer JWT or X-API-Key)",
    )


def require_scopes(*required: str):
    """Dependency factory ensuring the service token holds all required scopes."""

    async def _dep(service: dict[str, Any] = Depends(get_current_service)) -> dict[str, Any]:
        held = set(service.get("scopes") or [])
        missing = [s for s in required if s not in held]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing scopes: {', '.join(missing)}",
            )
        return service

    return _dep


def parse_optional_uuid(value: str | None) -> UUID | None:
    if not value:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None
