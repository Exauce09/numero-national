"""Refresh-token session store — rotation + revocation (jti hashed)."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import get_settings
from apps.api.core.security import create_access_token, create_refresh_token, decode_token
from apps.api.domains.identity.models import RefreshSession, User
from apps.api.domains.identity.schemas import TokenPair


def hash_jti(jti: str) -> str:
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


async def issue_token_pair(db: AsyncSession, user: User) -> TokenPair:
    """Create access + refresh tokens and persist refresh session."""
    settings = get_settings()
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    payload = decode_token(refresh, expected_type="refresh")
    jti = str(payload.get("jti") or "")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Refresh token missing jti",
        )
    family_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshSession(
            user_id=user.id,
            jti_hash=hash_jti(jti),
            family_id=family_id,
            expires_at=expires_at,
        )
    )
    await db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


async def rotate_refresh_token(db: AsyncSession, refresh_token: str) -> TokenPair:
    """Validate refresh jti, revoke it, issue a new pair (rotation)."""
    settings = get_settings()
    payload = decode_token(refresh_token, expected_type="refresh")
    jti = str(payload.get("jti") or "")
    subject = payload.get("sub")
    if not jti or not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    try:
        user_id = uuid.UUID(str(subject))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from exc

    digest = hash_jti(jti)
    session = await db.scalar(
        select(RefreshSession).where(RefreshSession.jti_hash == digest)
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token unknown or already rotated",
        )
    if session.revoked_at is not None:
        # Possible theft: revoke entire family
        await _revoke_family(db, session.family_id)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reused — session family revoked",
        )
    if session.expires_at < datetime.now(timezone.utc):
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    # Rotate
    new_access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))
    new_payload = decode_token(new_refresh, expected_type="refresh")
    new_jti = str(new_payload.get("jti") or "")
    now = datetime.now(timezone.utc)
    session.revoked_at = now
    session.replaced_by_jti_hash = hash_jti(new_jti)

    db.add(
        RefreshSession(
            user_id=user.id,
            jti_hash=hash_jti(new_jti),
            family_id=session.family_id,
            expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()
    return TokenPair(access_token=new_access, refresh_token=new_refresh)


async def revoke_refresh_token(db: AsyncSession, refresh_token: str) -> None:
    """Logout: revoke presented refresh token (and optionally family)."""
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except HTTPException:
        return
    jti = str(payload.get("jti") or "")
    if not jti:
        return
    session = await db.scalar(
        select(RefreshSession).where(RefreshSession.jti_hash == hash_jti(jti))
    )
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def _revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshSession).where(
            RefreshSession.family_id == family_id,
            RefreshSession.revoked_at.is_(None),
        )
    )
    for row in result.scalars().all():
        row.revoked_at = now
