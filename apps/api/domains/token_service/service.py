"""Sectoral token generation — plaintext once; hash-at-rest; POST resolve/revoke."""

from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.core_registry.enums import CitizenStatus
from apps.api.domains.core_registry.models import Citizen
from apps.api.domains.token_service.enums import TokenSector, TokenStatus
from apps.api.domains.token_service.models import IdentityToken, TokenUsageLog

logger = logging.getLogger(__name__)

TOKEN_BYTES = 32


def hash_token(plaintext: str) -> str:
    """SHA-256 hex digest of opaque token (high entropy — no pepper required)."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def _new_opaque_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


async def _write_usage_audit(
    session: AsyncSession,
    *,
    token_id: uuid.UUID,
    action: str,
    actor_id: uuid.UUID | None,
    detail: str | None = None,
) -> None:
    try:
        from apps.api.domains.audit.services import write_audit

        await write_audit(
            session,
            action=action,
            actor_id=actor_id,
            resource_type="IdentityToken",
            resource_id=str(token_id),
            new_value={"detail": detail} if detail else None,
            commit=False,
        )
    except Exception:
        logger.exception("Central audit write failed; falling back to TokenUsageLog")

    session.add(
        TokenUsageLog(
            token_id=token_id,
            action=action,
            actor_id=actor_id,
            detail=detail,
        )
    )


async def generate_token(
    session: AsyncSession,
    *,
    citizen_id: uuid.UUID,
    sector: TokenSector,
    institution_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
) -> tuple[IdentityToken, str]:
    """Return (token_row, plaintext). Plaintext is never persisted."""
    citizen = await session.scalar(select(Citizen).where(Citizen.id == citizen_id))
    if citizen is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")
    if citizen.status != CitizenStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tokens may only be issued for ACTIVE citizens",
        )

    plaintext = _new_opaque_token()
    token = IdentityToken(
        citizen_id=citizen_id,
        sector=sector.value,
        token_value=None,
        token_hash=hash_token(plaintext),
        token_prefix=plaintext[:8],
        status=TokenStatus.ACTIVE.value,
        institution_id=institution_id,
    )
    session.add(token)
    await session.flush()
    await _write_usage_audit(
        session,
        token_id=token.id,
        action="TOKEN_GENERATED",
        actor_id=actor_id,
        detail=f"sector={sector.value}",
    )
    await session.commit()
    await session.refresh(token)
    return token, plaintext


async def resolve_token(
    session: AsyncSession,
    token_value: str,
    *,
    actor_id: uuid.UUID | None = None,
) -> IdentityToken:
    digest = hash_token(token_value)
    token = await session.scalar(
        select(IdentityToken).where(IdentityToken.token_hash == digest)
    )
    if token is None:
        token = await session.scalar(
            select(IdentityToken).where(IdentityToken.token_value == token_value)
        )
    if token is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")
    if token.status != TokenStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Token is revoked")

    await _write_usage_audit(
        session,
        token_id=token.id,
        action="TOKEN_RESOLVED",
        actor_id=actor_id,
    )
    await session.commit()
    return token


async def revoke_token(
    session: AsyncSession,
    token_value: str,
    *,
    actor_id: uuid.UUID | None = None,
) -> IdentityToken:
    digest = hash_token(token_value)
    token = await session.scalar(
        select(IdentityToken).where(IdentityToken.token_hash == digest)
    )
    if token is None:
        token = await session.scalar(
            select(IdentityToken).where(IdentityToken.token_value == token_value)
        )
    if token is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")
    if token.status == TokenStatus.REVOKED.value:
        return token

    now = datetime.now(timezone.utc)
    token.status = TokenStatus.REVOKED.value
    token.revoked_at = now
    token.token_value = None
    await _write_usage_audit(
        session,
        token_id=token.id,
        action="TOKEN_REVOKED",
        actor_id=actor_id,
    )
    await session.commit()
    await session.refresh(token)
    return token
