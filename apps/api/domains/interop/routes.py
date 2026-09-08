"""Interop HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.audit.services import write_audit
from apps.api.domains.interop.deps import rate_limit_dependency
from apps.api.domains.interop.schemas import ClientCredentialsRequest, ServiceTokenResponse
from apps.api.domains.interop.services import get_client_by_id, issue_client_credentials_token

router = APIRouter(prefix="/interop", tags=["interop"])


@router.post(
    "/token",
    response_model=ServiceTokenResponse,
    summary="Client credentials token",
    dependencies=[Depends(rate_limit_dependency)],
)
async def client_credentials_token(
    payload: ClientCredentialsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ServiceTokenResponse:
    """
    OAuth2-style client_credentials grant for service-to-service access.

    Rate-limited via the in-memory stub in ``deps.check_rate_limit``.
    """
    tokens = await issue_client_credentials_token(db, payload)
    client = await get_client_by_id(db, payload.client_id)
    ip = request.client.host if request.client else None
    await write_audit(
        db,
        actor_id=None,
        institution_id=client.institution_id if client else None,
        action="interop.token",
        resource_type="service_client",
        resource_id=payload.client_id,
        ip=ip,
        device=request.headers.get("user-agent"),
        result="success",
        new_value={"scopes": tokens.scope},
    )
    return tokens
