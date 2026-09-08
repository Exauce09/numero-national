"""Interop services — client credentials token issuance."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import get_settings
from apps.api.core.security import create_access_token, hash_password, verify_password
from apps.api.domains.interop.models import ServiceClient
from apps.api.domains.interop.schemas import ClientCredentialsRequest, ServiceTokenResponse


async def get_client_by_id(db: AsyncSession, client_id: str) -> ServiceClient | None:
    result = await db.execute(
        select(ServiceClient).where(ServiceClient.client_id == client_id)
    )
    return result.scalar_one_or_none()


async def create_service_client(
    db: AsyncSession,
    *,
    client_id: str,
    client_secret: str,
    scopes: list[str],
    institution_id=None,
    description: str | None = None,
) -> ServiceClient:
    """Helper for tests/admin seeding — stores bcrypt hash of the secret."""
    existing = await get_client_by_id(db, client_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="client_id already exists",
        )
    client = ServiceClient(
        client_id=client_id,
        client_secret_hash=hash_password(client_secret),
        scopes=list(scopes),
        institution_id=institution_id,
        description=description,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def issue_client_credentials_token(
    db: AsyncSession,
    payload: ClientCredentialsRequest,
) -> ServiceTokenResponse:
    client = await get_client_by_id(db, payload.client_id)
    if (
        client is None
        or not client.is_active
        or not verify_password(payload.client_secret, client.client_secret_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client credentials",
        )

    granted: list[str] = list(client.scopes or [])
    if payload.scope:
        requested = [s for s in payload.scope.split() if s]
        unauthorized = [s for s in requested if s not in granted]
        if unauthorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unauthorized scopes: {', '.join(unauthorized)}",
            )
        scopes = requested
    else:
        scopes = granted

    settings = get_settings()
    token = create_access_token(
        subject=client.client_id,
        extra_claims={
            "type": "service",
            "client_id": client.client_id,
            "scopes": scopes,
            "institution_id": str(client.institution_id) if client.institution_id else None,
        },
    )
    return ServiceTokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        scope=" ".join(scopes),
    )
