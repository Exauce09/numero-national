"""Citizen portal authentication dependency (soft identity binding)."""

from __future__ import annotations

from uuid import UUID

from fastapi import Header, HTTPException, status


async def get_current_citizen_id(
    x_citizen_id: str | None = Header(default=None, alias="X-Citizen-Id"),
) -> UUID:
    """
    Resolve the authenticated citizen.

    MVP: X-Citizen-Id header. Production should bind JWT claim `citizen_id`
    from CITIZEN role tokens issued by the identity domain.
    """
    if not x_citizen_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Citizen-Id required for citizen portal endpoints",
        )
    try:
        return UUID(x_citizen_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Citizen-Id; expected UUID",
        ) from exc
