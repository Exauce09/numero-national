"""HTTP routes for état civil — /api/v1/civil."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_CIVIL_DECLARE,
    Principal,
    require_permissions,
)
from apps.api.db.session import get_db
from apps.api.domains.etat_civil.enums import (
    ActType,
    PERM_CIVIL_READ,
    PERM_CIVIL_STATS,
    PERM_CIVIL_VALIDATE,
    PERM_CIVIL_WRITE,
)
from apps.api.domains.etat_civil.schemas import (
    ActTransitionRequest,
    CivilActCreate,
    CivilActRead,
    DeclarationCreate,
    DeclarationRead,
    DeclarationValidateRequest,
    DocumentVerifyRequest,
    FiliationCreate,
    FiliationRead,
    MentionCreate,
    MentionRead,
    PopulationHit,
    PopulationSearchQuery,
    ResidenceCreate,
    ResidenceRead,
    StatsByActType,
)
from apps.api.domains.etat_civil import services

router = APIRouter(prefix="/civil", tags=["etat-civil"])


def _act_create(act_type: ActType):
    async def _endpoint(
        body: CivilActCreate,
        db: AsyncSession = Depends(get_db),
        principal: Principal = Depends(require_permissions(PERM_CIVIL_WRITE)),
    ) -> CivilActRead:
        data = body.model_copy(update={"act_type": act_type})
        act = await services.create_act(db, data, actor_id=principal.actor_id)
        return CivilActRead.model_validate(act)

    return _endpoint


def _act_list(act_type: ActType):
    async def _endpoint(
        commune_code: str | None = None,
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        db: AsyncSession = Depends(get_db),
        _: Principal = Depends(require_permissions(PERM_CIVIL_READ)),
    ) -> list[CivilActRead]:
        rows = await services.list_acts(
            db, act_type=act_type, commune_code=commune_code, limit=limit, offset=offset
        )
        return [CivilActRead.model_validate(r) for r in rows]

    return _endpoint


@router.get("/population/search", response_model=list[PopulationHit])
async def population_search(
    q: str | None = None,
    family_name: str | None = None,
    given_names: str | None = None,
    date_of_birth: str | None = None,
    commune_code: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_READ)),
) -> list[PopulationHit]:
    """Population search stub via conceptual citizen_reference."""
    return await services.search_population(
        db,
        PopulationSearchQuery(
            q=q,
            family_name=family_name,
            given_names=given_names,
            date_of_birth=date_of_birth,
            commune_code=commune_code,
            limit=limit,
        ),
    )


@router.get("/acts/{act_id}", response_model=CivilActRead)
async def get_act(
    act_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_READ)),
) -> CivilActRead:
    act = await services.get_act(db, act_id)
    if act is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Act not found")
    return CivilActRead.model_validate(act)


# Typed act collections
router.add_api_route("/births", _act_create(ActType.BIRTH), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/births", _act_list(ActType.BIRTH), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/marriages", _act_create(ActType.MARRIAGE), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/marriages", _act_list(ActType.MARRIAGE), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/divorces", _act_create(ActType.DIVORCE), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/divorces", _act_list(ActType.DIVORCE), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/deaths", _act_create(ActType.DEATH), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/deaths", _act_list(ActType.DEATH), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/recognitions", _act_create(ActType.RECOGNITION), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/recognitions", _act_list(ActType.RECOGNITION), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/rectifications", _act_create(ActType.RECTIFICATION), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/rectifications", _act_list(ActType.RECTIFICATION), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/adoptions", _act_create(ActType.ADOPTION), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/adoptions", _act_list(ActType.ADOPTION), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/displacements", _act_create(ActType.DISPLACEMENT), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/displacements", _act_list(ActType.DISPLACEMENT), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/census", _act_create(ActType.CENSUS), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/census", _act_list(ActType.CENSUS), methods=["GET"], response_model=list[CivilActRead])
router.add_api_route("/documents-acts", _act_create(ActType.DOCUMENT), methods=["POST"], response_model=CivilActRead)
router.add_api_route("/documents-acts", _act_list(ActType.DOCUMENT), methods=["GET"], response_model=list[CivilActRead])


@router.post("/residence", response_model=ResidenceRead, status_code=status.HTTP_201_CREATED)
async def create_residence(
    body: ResidenceCreate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_WRITE)),
) -> ResidenceRead:
    record = await services.create_residence(db, body)
    return ResidenceRead.model_validate(record)


@router.get("/residence", response_model=list[ResidenceRead])
async def list_residence(
    citizen_id: UUID | None = None,
    commune_code: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_READ)),
) -> list[ResidenceRead]:
    rows = await services.list_residence(
        db, citizen_id=citizen_id, commune_code=commune_code, limit=limit
    )
    return [ResidenceRead.model_validate(r) for r in rows]


@router.get("/declarations", response_model=list[DeclarationRead])
async def list_declarations(
    status_filter: str | None = Query(None, alias="status"),
    declaration_type: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_READ)),
) -> list[DeclarationRead]:
    """File d'attente des déclarations pour l'officier d'état civil."""
    rows = await services.list_declarations(
        db,
        status=status_filter,
        declaration_type=declaration_type,
        limit=limit,
        offset=offset,
    )
    return [DeclarationRead.model_validate(r) for r in rows]


@router.post("/declarations", response_model=DeclarationRead, status_code=status.HTTP_201_CREATED)
async def post_declaration(
    body: DeclarationCreate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_DECLARE)),
) -> DeclarationRead:
    """Hospital/health → civil declaration intake (permission-gated)."""
    decl, notification = await services.create_declaration(db, body)
    read = DeclarationRead.model_validate(decl)
    read.notification = notification
    return read


@router.post("/declarations/{declaration_id}/validate")
async def validate_declaration(
    declaration_id: UUID,
    body: DeclarationValidateRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CIVIL_VALIDATE)),
) -> dict:
    try:
        decl, act, registry_signal = await services.validate_declaration(
            db, declaration_id, body, actor_id=principal.actor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {
        "declaration": DeclarationRead.model_validate(decl).model_dump(),
        "act": CivilActRead.model_validate(act).model_dump() if act else None,
        "registry_signal": registry_signal,
    }


@router.get("/statistics/{commune_code}", response_model=StatsByActType)
async def commune_statistics(
    commune_code: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_STATS)),
) -> StatsByActType:
    data = await services.stats_by_act_type(db, commune_code)
    return StatsByActType(**data)


@router.post("/acts/{act_id}/documents")
async def attach_document(
    act_id: UUID,
    document_type: str = Query("CIVIL_ACT_EXTRACT"),
    content_base64: str = Query(..., description="Base64 document bytes (MVP)"),
    institution_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_WRITE)),
) -> dict:
    import base64

    try:
        content = base64.b64decode(content_base64)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid base64 content") from exc
    try:
        doc = await services.attach_document_to_act(
            db,
            act_id,
            document_type=document_type,
            institution_id=institution_id,
            citizen_id=None,
            content=content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "document_id": str(doc.document_id),
        "content_hash": doc.content_hash,
        "status": doc.status,
    }


@router.post("/acts/{act_id}/transition", response_model=CivilActRead)
async def transition_act(
    act_id: UUID,
    body: ActTransitionRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CIVIL_VALIDATE)),
) -> CivilActRead:
    act = await services.transition_act_status(
        db, act_id, body.status.value, actor_id=principal.actor_id
    )
    return CivilActRead.model_validate(act)


@router.delete("/acts/{act_id}", response_model=CivilActRead)
async def soft_delete_act(
    act_id: UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CIVIL_WRITE)),
) -> CivilActRead:
    act = await services.soft_delete_act(db, act_id, actor_id=principal.actor_id)
    return CivilActRead.model_validate(act)


@router.post("/mentions", response_model=MentionRead, status_code=status.HTTP_201_CREATED)
async def create_mention(
    body: MentionCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CIVIL_VALIDATE)),
) -> MentionRead:
    row = await services.add_mention(
        db,
        target_act_id=body.target_act_id,
        mention_type=body.mention_type,
        source_act_id=body.source_act_id,
        authority=body.authority,
        reference=body.reference,
        justificatif=body.justificatif,
        actor_id=principal.actor_id,
    )
    return MentionRead.model_validate(row)


@router.post("/filiations", response_model=FiliationRead, status_code=status.HTTP_201_CREATED)
async def create_filiation(
    body: FiliationCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CIVIL_WRITE)),
) -> FiliationRead:
    row = await services.create_filiation(
        db,
        relation_type=body.relation_type,
        parent_citizen_id=body.parent_citizen_id,
        child_citizen_id=body.child_citizen_id,
        parent_label=body.parent_label,
        child_label=body.child_label,
        act_id=body.act_id,
        actor_id=principal.actor_id,
    )
    return FiliationRead.model_validate(row)


@router.get("/persons/{citizen_id}/history")
async def person_history(
    citizen_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_CIVIL_READ)),
) -> dict:
    events = await services.person_civil_history(db, citizen_id)
    return {"citizen_id": str(citizen_id), "events": events}


@router.post("/documents/verify")
async def verify_document(
    body: DocumentVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Public document authenticity check — no full PII."""
    return await services.verify_document_code(db, body.code)


@router.get("/config")
async def civil_config(
    _: Principal = Depends(require_permissions(PERM_CIVIL_READ)),
) -> dict:
    from apps.api.domains.civil_config import public_config

    return public_config()


# Alias for frontend mismatch documents vs documents-acts
router.add_api_route(
    "/documents",
    _act_create(ActType.DOCUMENT),
    methods=["POST"],
    response_model=CivilActRead,
    include_in_schema=False,
)
router.add_api_route(
    "/documents",
    _act_list(ActType.DOCUMENT),
    methods=["GET"],
    response_model=list[CivilActRead],
    include_in_schema=False,
)
