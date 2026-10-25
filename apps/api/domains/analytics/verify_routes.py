"""Relying-party identity verify — `/api/v1/identity/verify`."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import PERM_IDENTITY_VERIFY, Principal, require_permissions
from apps.api.db.session import get_db
from apps.api.domains.analytics import service
from apps.api.domains.analytics.schemas import IdentityVerifyRequest, IdentityVerifyResponse

router = APIRouter(prefix="/identity", tags=["relying-party"])


@router.post(
    "/verify",
    response_model=IdentityVerifyResponse,
    dependencies=[Depends(require_permissions(PERM_IDENTITY_VERIFY))],
)
async def verify_identity(
    body: IdentityVerifyRequest,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_IDENTITY_VERIFY)),
) -> IdentityVerifyResponse:
    """
    Returns {verified, status, claims} only (réponse minimale partenaire).

    Never returns full citizen dossier, addresses, biometrics, or documents.
    """
    return await service.relying_party_verify(db, body)
