"""HTTP routes for Core Registry and sectoral tokens under /api/v1/registry."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_CITIZEN_CREATE,
    PERM_CITIZEN_MERGE,
    PERM_CITIZEN_READ,
    PERM_CITIZEN_VALIDATE,
    PERM_TOKEN_MANAGE,
    Principal,
    require_permissions,
)
from apps.api.db.session import get_db
from apps.api.domains.core_registry import service as citizen_service
from apps.api.domains.core_registry.schemas import (
    CitizenCreate,
    CitizenDetail,
    CitizenListItem,
    CitizenMergeRequest,
    CitizenMergeResponse,
    CitizenUpdate,
    CitizenValidateResponse,
    PaginatedCitizens,
)
from apps.api.domains.token_service import service as token_service
from apps.api.domains.token_service.enums import TokenStatus
from apps.api.domains.token_service.schemas import (
    TokenGenerateRequest,
    TokenGenerateResponse,
    TokenLookupRequest,
    TokenResolveResponse,
    TokenRevokeResponse,
)

router = APIRouter(prefix="/registry", tags=["core-registry"])


@router.post(
    "/citizens",
    response_model=CitizenDetail,
    status_code=201,
    summary="Create draft citizen (no NIC)",
)
async def create_citizen(
    body: CitizenCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> CitizenDetail:
    citizen, _ = await citizen_service.create_draft_citizen(
        db, body, actor_id=principal.actor_id
    )
    return CitizenDetail.model_validate(citizen)


@router.post(
    "/citizens/merge",
    response_model=CitizenMergeResponse,
    summary="Controlled citizen merge (admin/ONIP)",
)
async def merge_citizens(
    body: CitizenMergeRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_MERGE)),
) -> CitizenMergeResponse:
    source = await citizen_service.merge_citizens(db, body, actor_id=principal.actor_id)
    return CitizenMergeResponse(
        source_citizen_id=source.id,
        target_citizen_id=body.target_citizen_id,
        source_status=source.status,  # type: ignore[arg-type]
        message="Source citizen marked MERGED",
    )


@router.get(
    "/citizens",
    response_model=PaginatedCitizens,
    summary="Search citizens (minimal PII, permission-gated)",
)
async def search_citizens(
    family_name: str | None = Query(default=None),
    given_names: str | None = Query(default=None),
    date_of_birth: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> PaginatedCitizens:
    rows, total = await citizen_service.search_citizens(
        db,
        family_name=family_name,
        given_names=given_names,
        date_of_birth=date_of_birth,
        page=page,
        page_size=page_size,
    )
    return PaginatedCitizens(
        items=[CitizenListItem.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/citizens/by-nic/{nic}",
    response_model=CitizenDetail,
    summary="Get citizen by NIC",
)
async def get_by_nic(
    nic: str,
    db: AsyncSession = Depends(get_db),
    _principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> CitizenDetail:
    citizen = await citizen_service.get_citizen_by_nic(db, nic)
    return CitizenDetail.model_validate(citizen)


@router.post(
    "/citizens/{citizen_id}/validate",
    response_model=CitizenValidateResponse,
    summary="Validate citizen and assign system-generated NIC",
)
async def validate_citizen(
    citizen_id: UUID,
    force_despite_duplicates: bool = Query(default=False),
    override_justification: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_VALIDATE)),
) -> CitizenValidateResponse:
    from apps.api.core.permissions import PERM_CITIZEN_VALIDATE_OVERRIDE

    if force_despite_duplicates and PERM_CITIZEN_VALIDATE_OVERRIDE not in principal.permissions:
        from fastapi import HTTPException, status as http_status

        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Missing permission registry:citizen:validate_override",
        )
    citizen, dup_count = await citizen_service.validate_and_assign_nic(
        db,
        citizen_id,
        actor_id=principal.actor_id,
        force_despite_duplicates=force_despite_duplicates,
        override_justification=override_justification,
    )
    assert citizen.nic is not None and citizen.validated_at is not None
    return CitizenValidateResponse(
        id=citizen.id,
        nic=citizen.nic,
        status=citizen.status,  # type: ignore[arg-type]
        validated_at=citizen.validated_at,
        duplicate_candidates_created=dup_count,
    )


@router.get(
    "/citizens/{citizen_id}",
    response_model=CitizenDetail,
    summary="Get citizen by internal UUID",
)
async def get_citizen(
    citizen_id: UUID,
    db: AsyncSession = Depends(get_db),
    _principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> CitizenDetail:
    citizen = await citizen_service.get_citizen(db, citizen_id)
    return CitizenDetail.model_validate(citizen)


@router.patch(
    "/citizens/{citizen_id}",
    response_model=CitizenDetail,
    summary="Limited update before validation",
)
async def patch_citizen(
    citizen_id: UUID,
    body: CitizenUpdate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> CitizenDetail:
    citizen = await citizen_service.update_draft_citizen(
        db, citizen_id, body, actor_id=principal.actor_id
    )
    return CitizenDetail.model_validate(citizen)


@router.post(
    "/tokens",
    response_model=TokenGenerateResponse,
    status_code=201,
    summary="Generate sectoral opaque token (plaintext returned once)",
)
async def create_token(
    body: TokenGenerateRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_TOKEN_MANAGE)),
) -> TokenGenerateResponse:
    token, plaintext = await token_service.generate_token(
        db,
        citizen_id=body.citizen_id,
        sector=body.sector,
        institution_id=body.institution_id,
        actor_id=principal.actor_id,
    )
    return TokenGenerateResponse(
        id=token.id,
        citizen_id=token.citizen_id,
        sector=token.sector,  # type: ignore[arg-type]
        token=plaintext,
        token_prefix=token.token_prefix,
        status=token.status,  # type: ignore[arg-type]
        institution_id=token.institution_id,
        created_at=token.created_at,
    )


@router.post(
    "/tokens/resolve",
    response_model=TokenResolveResponse,
    summary="Resolve opaque token to citizen_id (POST body — never in URL)",
)
async def resolve_token(
    body: TokenLookupRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_TOKEN_MANAGE)),
) -> TokenResolveResponse:
    row = await token_service.resolve_token(db, body.token, actor_id=principal.actor_id)
    return TokenResolveResponse(
        token_id=row.id,
        citizen_id=row.citizen_id,
        sector=row.sector,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        institution_id=row.institution_id,
    )


@router.post(
    "/tokens/revoke",
    response_model=TokenRevokeResponse,
    summary="Revoke a sectoral token (POST body)",
)
async def revoke_token(
    body: TokenLookupRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_TOKEN_MANAGE)),
) -> TokenRevokeResponse:
    row = await token_service.revoke_token(db, body.token, actor_id=principal.actor_id)
    from datetime import datetime, timezone

    revoked_at = row.revoked_at or datetime.now(timezone.utc)
    return TokenRevokeResponse(
        token_id=row.id,
        token_prefix=row.token_prefix,
        status=TokenStatus.REVOKED,
        revoked_at=revoked_at,
    )
