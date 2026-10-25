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
from apps.api.domains.core_registry.enums import CitizenStatus, Sex
from apps.api.domains.core_registry.schemas import (
    CitizenAddressIn,
    CitizenCreate,
    CitizenDetail,
    CitizenHistoryItem,
    CitizenListItem,
    CitizenMergeRequest,
    CitizenMergeResponse,
    CitizenStatusChangeRequest,
    CitizenSubmitRequest,
    CitizenUpdate,
    CitizenValidateResponse,
    DuplicateCandidateOut,
    DuplicateResolveRequest,
    DuplicateResolveResponse,
    PaginatedCitizenHistory,
    PaginatedCitizens,
    SimilarSearchResponse,
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


def _scope_codes(principal: Principal) -> tuple[str | None, str | None, bool]:
    if principal.territory_forced and principal.province_code:
        return principal.province_code, principal.commune_code, True
    return principal.province_code, principal.commune_code, bool(principal.territory_forced)


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
    "/citizens/similar",
    response_model=SimilarSearchResponse,
    summary="Recherche dossiers similaires avant création (RB-04)",
)
async def similar_citizens(
    family_name: str = Query(min_length=1),
    given_names: str = Query(min_length=1),
    date_of_birth: date = Query(...),
    sex: Sex = Query(default=Sex.UNKNOWN),
    province_code: str | None = Query(default=None),
    commune_code: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> SimilarSearchResponse:
    bound_prov, bound_com, forced = _scope_codes(principal)
    prov = bound_prov if forced else (province_code or bound_prov)
    com = bound_com if (forced and bound_com) else (commune_code or bound_com)
    rows = await citizen_service.find_similar_citizens(
        db,
        family_name=family_name,
        given_names=given_names,
        sex=sex.value,
        date_of_birth=date_of_birth,
        province_code=prov,
        territory_key=com,
    )
    return SimilarSearchResponse(
        items=[CitizenListItem.model_validate(citizen_service.citizen_to_list_item(r)) for r in rows],
        total=len(rows),
    )


@router.get(
    "/citizens",
    response_model=PaginatedCitizens,
    summary="Search citizens (minimal PII, permission-gated)",
)
async def search_citizens(
    q: str | None = Query(default=None, description="Recherche libre (nom, prénom, NIC…)"),
    family_name: str | None = Query(default=None),
    given_names: str | None = Query(default=None),
    nic: str | None = Query(default=None),
    date_of_birth: date | None = Query(default=None),
    citizen_status: CitizenStatus | None = Query(default=None, alias="status"),
    sex: Sex | None = Query(default=None),
    place_of_birth: str | None = Query(default=None),
    province_code: str | None = Query(default=None),
    commune_code: str | None = Query(default=None),
    include_closed: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> PaginatedCitizens:
    bound_prov, bound_com, forced = _scope_codes(principal)
    if forced and bound_prov:
        if province_code and province_code.strip().upper() != bound_prov:
            from fastapi import HTTPException, status as http_status

            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Province hors périmètre autorisé",
                    "allowed_province": bound_prov,
                },
            )
        province_code = bound_prov
        if bound_com:
            commune_code = bound_com

    rows, total = await citizen_service.search_citizens(
        db,
        q=q,
        family_name=family_name,
        given_names=given_names,
        nic=nic,
        date_of_birth=date_of_birth,
        status_filter=citizen_status.value if citizen_status else None,
        sex=sex.value if sex else None,
        place_of_birth=place_of_birth,
        province_code=province_code,
        commune_code=commune_code,
        include_closed=include_closed,
        page=page,
        page_size=page_size,
    )
    return PaginatedCitizens(
        items=[CitizenListItem.model_validate(citizen_service.citizen_to_list_item(r)) for r in rows],
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
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> CitizenDetail:
    citizen = await citizen_service.get_citizen_by_nic(db, nic)
    bound_prov, bound_com, forced = _scope_codes(principal)
    citizen_service.assert_citizen_in_scope(
        citizen, province_code=bound_prov, commune_code=bound_com, forced=forced
    )
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


@router.post(
    "/citizens/{citizen_id}/submit",
    response_model=CitizenDetail,
    summary="Soumettre brouillon pour contrôle (pas de NIN)",
)
async def submit_citizen(
    citizen_id: UUID,
    body: CitizenSubmitRequest | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> CitizenDetail:
    citizen = await citizen_service.submit_citizen(
        db,
        citizen_id,
        actor_id=principal.actor_id,
        note=(body.note if body else None),
    )
    return CitizenDetail.model_validate(citizen)


@router.post(
    "/citizens/{citizen_id}/status",
    response_model=CitizenDetail,
    summary="Changer statut dossier (transitions contrôlées, sans NIN)",
)
async def change_status(
    citizen_id: UUID,
    body: CitizenStatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> CitizenDetail:
    citizen = await citizen_service.change_citizen_status(
        db,
        citizen_id,
        new_status=body.status,
        reason=body.reason,
        actor_id=principal.actor_id,
    )
    return CitizenDetail.model_validate(citizen)


@router.get(
    "/citizens/{citizen_id}/history",
    response_model=PaginatedCitizenHistory,
    summary="Historique chronologique du dossier",
)
async def citizen_history(
    citizen_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> PaginatedCitizenHistory:
    citizen = await citizen_service.get_citizen(db, citizen_id)
    bound_prov, bound_com, forced = _scope_codes(principal)
    citizen_service.assert_citizen_in_scope(
        citizen, province_code=bound_prov, commune_code=bound_com, forced=forced
    )
    rows, total = await citizen_service.list_citizen_history(
        db, citizen_id, page=page, page_size=page_size
    )
    return PaginatedCitizenHistory(
        items=[CitizenHistoryItem.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/citizens/{citizen_id}/duplicates",
    response_model=list[DuplicateCandidateOut],
    summary="Doublons démographiques liés au dossier",
)
async def citizen_duplicates(
    citizen_id: UUID,
    open_only: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> list[DuplicateCandidateOut]:
    citizen = await citizen_service.get_citizen(db, citizen_id)
    bound_prov, bound_com, forced = _scope_codes(principal)
    citizen_service.assert_citizen_in_scope(
        citizen, province_code=bound_prov, commune_code=bound_com, forced=forced
    )
    pairs = await citizen_service.list_duplicates_for_citizen(
        db, citizen_id, open_only=open_only
    )
    out: list[DuplicateCandidateOut] = []
    for row, other in pairs:
        other_id = row.citizen_b_id if row.citizen_a_id == citizen_id else row.citizen_a_id
        out.append(
            DuplicateCandidateOut(
                id=row.id,
                citizen_a_id=row.citizen_a_id,
                citizen_b_id=row.citizen_b_id,
                other_citizen_id=other_id,
                score=row.score,
                status=row.status,
                match_method=row.match_method,
                created_at=row.created_at,
                other_family_name=other.family_name if other else None,
                other_given_names=other.given_names if other else None,
                other_date_of_birth=other.date_of_birth if other else None,
                other_status=other.status if other else None,
                other_nic=other.nic if other else None,
            )
        )
    return out


@router.post(
    "/duplicates/{candidate_id}/resolve",
    response_model=DuplicateResolveResponse,
    summary="Résoudre un doublon (pas de fusion auto)",
)
async def resolve_duplicate(
    candidate_id: UUID,
    body: DuplicateResolveRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_VALIDATE)),
) -> DuplicateResolveResponse:
    row = await citizen_service.resolve_duplicate_candidate(
        db,
        candidate_id,
        decision=body.decision,
        justification=body.justification,
        actor_id=principal.actor_id,
    )
    return DuplicateResolveResponse(
        id=row.id,
        status=row.status,
        message="Doublon résolu — fusion uniquement via POST /citizens/merge si requis",
    )


@router.post(
    "/citizens/{citizen_id}/addresses",
    response_model=CitizenDetail,
    summary="Ajouter une adresse (historisée)",
)
async def add_address(
    citizen_id: UUID,
    body: CitizenAddressIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> CitizenDetail:
    citizen = await citizen_service.add_citizen_address(
        db, citizen_id, body, actor_id=principal.actor_id
    )
    return CitizenDetail.model_validate(citizen)


@router.get(
    "/citizens/{citizen_id}",
    response_model=CitizenDetail,
    summary="Get citizen by internal UUID",
)
async def get_citizen(
    citizen_id: UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> CitizenDetail:
    citizen = await citizen_service.get_citizen(db, citizen_id)
    bound_prov, bound_com, forced = _scope_codes(principal)
    citizen_service.assert_citizen_in_scope(
        citizen, province_code=bound_prov, commune_code=bound_com, forced=forced
    )
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
