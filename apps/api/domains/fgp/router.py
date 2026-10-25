"""HTTP Module 5 FGP — façade `/api/v1/fgp` sur core_registry."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_CITIZEN_CREATE,
    PERM_CITIZEN_READ,
    Principal,
    require_permissions,
)
from apps.api.db.session import get_db
from apps.api.domains.core_registry import service as citizen_service
from apps.api.domains.core_registry.enums import CitizenStatus, Sex
from apps.api.domains.core_registry.schemas import (
    CitizenDetail,
    CitizenHistoryItem,
    CitizenListItem,
    PaginatedCitizenHistory,
    PaginatedCitizens,
)
from apps.api.domains.fgp import service as fgp_service
from apps.api.domains.fgp.schemas import (
    FgpCatalogOut,
    FgpCorrectionIn,
    FgpCorrectionOut,
    FgpEventIn,
    FgpEventOut,
    FgpHealthOut,
    FgpRelationIn,
    FgpRelationOut,
)

router = APIRouter(prefix="/fgp", tags=["fgp-module-5"])


def _scope_codes(principal: Principal) -> tuple[str | None, str | None, bool]:
    if principal.territory_forced and principal.province_code:
        return principal.province_code, principal.commune_code, True
    return principal.province_code, principal.commune_code, bool(principal.territory_forced)


@router.get("/catalog", response_model=FgpCatalogOut)
async def catalog() -> FgpCatalogOut:
    return fgp_service.fgp_catalog()


@router.get("/health", response_model=FgpHealthOut)
async def health(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> FgpHealthOut:
    return await fgp_service.fgp_health(db)


@router.get("/persons", response_model=PaginatedCitizens, summary="Recherche FGP (auditée)")
async def search_persons(
    q: str | None = Query(default=None),
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
                detail={"message": "Province hors périmètre", "allowed_province": bound_prov},
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
    await fgp_service.audit_fgp_read(
        db,
        actor_id=principal.actor_id,
        action="FGP_SEARCH",
        resource_id="search",
        detail={"q": q, "total": total, "page": page},
    )
    return PaginatedCitizens(
        items=[CitizenListItem.model_validate(citizen_service.citizen_to_list_item(r)) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/persons/{citizen_id}", response_model=CitizenDetail, summary="Dossier FGP (audité)")
async def get_person(
    citizen_id: UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> CitizenDetail:
    citizen = await citizen_service.get_citizen(db, citizen_id)
    bound_prov, bound_com, forced = _scope_codes(principal)
    citizen_service.assert_citizen_in_scope(
        citizen, province_code=bound_prov, commune_code=bound_com, forced=forced
    )
    await fgp_service.audit_fgp_read(
        db,
        actor_id=principal.actor_id,
        action="FGP_PERSON_VIEW",
        resource_id=str(citizen_id),
        detail={"status": citizen.status, "has_nic": citizen.nic is not None},
    )
    return CitizenDetail.model_validate(citizen)


@router.get(
    "/persons/{citizen_id}/history",
    response_model=PaginatedCitizenHistory,
    summary="Historique dossier FGP",
)
async def person_history(
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
    "/persons/{citizen_id}/relations",
    response_model=list[FgpRelationOut],
    summary="Filiation / relations FGP",
)
async def person_relations(
    citizen_id: UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_READ)),
) -> list[FgpRelationOut]:
    return await fgp_service.list_relations(db, citizen_id)


@router.post(
    "/persons/{citizen_id}/relations",
    response_model=FgpRelationOut,
    status_code=201,
    summary="Ajouter une relation (historisée)",
)
async def create_relation(
    citizen_id: UUID,
    body: FgpRelationIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> FgpRelationOut:
    return await fgp_service.add_relation(
        db, citizen_id, body, actor_id=principal.actor_id
    )


@router.post(
    "/events",
    response_model=FgpEventOut,
    status_code=201,
    summary="Ingestion événement source (idempotente, sans NIN)",
)
async def ingest_event(
    body: FgpEventIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> FgpEventOut:
    return await fgp_service.ingest_event(db, body, actor_id=principal.actor_id)


@router.post(
    "/corrections",
    response_model=FgpCorrectionOut,
    status_code=201,
    summary="Demande de rectification FGP (non appliquée automatiquement)",
)
async def request_correction(
    body: FgpCorrectionIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_CREATE)),
) -> FgpCorrectionOut:
    return await fgp_service.request_correction(db, body, actor_id=principal.actor_id)
