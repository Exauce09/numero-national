"""Census HTTP routes — `/api/v1/census`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_CENSUS_MANAGE,
    PERM_CENSUS_SYNC,
    PERM_CITIZEN_CREATE,
    PERM_CITIZEN_VALIDATE,
)
from apps.api.core.security import get_current_user, require_permissions
from apps.api.db.session import get_db
from apps.api.domains.identity.models import User
from apps.api.domains.recensement import service
from apps.api.domains.recensement.models import CampaignStatus, CensusRecordStatus
from apps.api.domains.recensement.schemas import (
    AgentStatsOut,
    AssignmentCreate,
    AssignmentOut,
    BatchPromoteRequest,
    BatchPromoteResult,
    CampaignCreate,
    CampaignOut,
    CampaignStatsOut,
    CampaignUpdate,
    CensusRecordOut,
    CouponResolveIn,
    CouponResolveOut,
    DeviceOut,
    DeviceRegister,
    FormDraftCreate,
    FormDraftOut,
    FormDraftUpdate,
    MyAssignmentOut,
    PromoteRequest,
    PromoteResult,
    RecordRejectRequest,
    RecordReviewRequest,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResult,
    TeamCreate,
    TeamOut,
    ZoneCreate,
    ZoneOut,
)

router = APIRouter(prefix="/census", tags=["census"])


@router.post(
    "/campaigns",
    response_model=CampaignOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def create_campaign(body: CampaignCreate, db: AsyncSession = Depends(get_db)) -> CampaignOut:
    return await service.create_campaign(db, body)  # type: ignore[return-value]


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(
    status_filter: CampaignStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> list[CampaignOut]:
    return await service.list_campaigns(db, status_filter)  # type: ignore[return-value]


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> CampaignOut:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign  # type: ignore[return-value]


@router.patch(
    "/campaigns/{campaign_id}",
    response_model=CampaignOut,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def update_campaign(
    campaign_id: uuid.UUID, body: CampaignUpdate, db: AsyncSession = Depends(get_db)
) -> CampaignOut:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return await service.update_campaign(db, campaign, body)  # type: ignore[return-value]


@router.delete(
    "/campaigns/{campaign_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def delete_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await service.delete_campaign(db, campaign)


@router.post(
    "/campaigns/{campaign_id}/zones",
    response_model=ZoneOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def create_zone(
    campaign_id: uuid.UUID, body: ZoneCreate, db: AsyncSession = Depends(get_db)
) -> ZoneOut:
    try:
        return await service.create_zone(db, campaign_id, body)  # type: ignore[return-value]
    except ValueError as exc:
        if str(exc) == "campaign_not_found":
            raise HTTPException(status_code=404, detail="Campaign not found") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/campaigns/{campaign_id}/zones", response_model=list[ZoneOut])
async def list_zones(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[ZoneOut]:
    return await service.list_zones(db, campaign_id)  # type: ignore[return-value]


@router.post(
    "/campaigns/{campaign_id}/teams",
    response_model=TeamOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def create_team(
    campaign_id: uuid.UUID, body: TeamCreate, db: AsyncSession = Depends(get_db)
) -> TeamOut:
    try:
        return await service.create_team(db, campaign_id, body)  # type: ignore[return-value]
    except ValueError as exc:
        detail = {
            "campaign_not_found": "Campaign not found",
            "zone_not_found": "Zone not found for this campaign",
        }.get(str(exc), str(exc))
        raise HTTPException(status_code=404, detail=detail) from exc


@router.get("/campaigns/{campaign_id}/teams", response_model=list[TeamOut])
async def list_teams(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[TeamOut]:
    return await service.list_teams(db, campaign_id)  # type: ignore[return-value]


@router.post(
    "/teams/{team_id}/assignments",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def assign_agent(
    team_id: uuid.UUID, body: AssignmentCreate, db: AsyncSession = Depends(get_db)
) -> AssignmentOut:
    try:
        return await service.assign_agent(db, team_id, body)  # type: ignore[return-value]
    except ValueError as exc:
        if str(exc) == "team_not_found":
            raise HTTPException(status_code=404, detail="Team not found") from exc
        raise


@router.get(
    "/teams/{team_id}/assignments",
    response_model=list[AssignmentOut],
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def list_assignments(
    team_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[AssignmentOut]:
    return await service.list_team_assignments(db, team_id)  # type: ignore[return-value]


@router.get(
    "/agents/me/assignments",
    response_model=list[MyAssignmentOut],
    dependencies=[Depends(require_permissions(PERM_CENSUS_SYNC))],
)
async def my_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MyAssignmentOut]:
    return await service.list_my_assignments(db, current_user.id)


@router.post("/devices/register", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def register_device(body: DeviceRegister, db: AsyncSession = Depends(get_db)) -> DeviceOut:
    return await service.register_device(db, body)  # type: ignore[return-value]


@router.post("/sync/push", response_model=SyncPushResult)
async def sync_push(body: SyncPushRequest, db: AsyncSession = Depends(get_db)) -> SyncPushResult:
    return await service.sync_push(db, body)


@router.post("/sync/pull", response_model=SyncPullResponse)
async def sync_pull(body: SyncPullRequest, db: AsyncSession = Depends(get_db)) -> SyncPullResponse:
    return await service.sync_pull(db, body)


@router.get("/agents/{agent_user_id}/stats", response_model=AgentStatsOut)
async def get_agent_stats(
    agent_user_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> AgentStatsOut:
    return await service.agent_stats(db, agent_user_id)


@router.get(
    "/campaigns/{campaign_id}/records",
    response_model=list[CensusRecordOut],
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def list_campaign_records(
    campaign_id: uuid.UUID,
    status_filter: CensusRecordStatus | None = Query(default=CensusRecordStatus.SYNCED, alias="status"),
    zone_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[CensusRecordOut]:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    rows = await service.list_campaign_records(
        db,
        campaign_id,
        status_filter=status_filter,
        zone_id=zone_id,
        limit=limit,
        offset=offset,
    )
    return [CensusRecordOut.model_validate(r) for r in rows]


@router.get(
    "/campaigns/{campaign_id}/stats",
    response_model=CampaignStatsOut,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def get_campaign_stats(
    campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> CampaignStatsOut:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return await service.campaign_stats(db, campaign_id)


@router.get(
    "/campaigns/{campaign_id}/export.csv",
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def export_campaign_csv(
    campaign_id: uuid.UUID,
    status_filter: CensusRecordStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    csv_text = await service.export_campaign_records_csv(
        db, campaign_id, status_filter=status_filter
    )
    filename = f"census-{campaign.code}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/records/{record_id}/approve",
    response_model=CensusRecordOut,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def approve_record(
    record_id: uuid.UUID,
    body: RecordReviewRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CensusRecordOut:
    rec = await service.get_record(db, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    try:
        updated = await service.approve_record(
            db, rec, current_user.id, body or RecordReviewRequest()
        )
    except ValueError as exc:
        if str(exc) == "not_reviewable":
            raise HTTPException(
                status_code=409,
                detail=f"Record status {rec.status.value} cannot be approved",
            ) from exc
        raise
    return CensusRecordOut.model_validate(updated)


@router.post(
    "/records/{record_id}/reject",
    response_model=CensusRecordOut,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE))],
)
async def reject_record(
    record_id: uuid.UUID,
    body: RecordRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CensusRecordOut:
    rec = await service.get_record(db, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    try:
        updated = await service.reject_record(db, rec, current_user.id, body)
    except ValueError as exc:
        if str(exc) == "not_reviewable":
            raise HTTPException(
                status_code=409,
                detail=f"Record status {rec.status.value} cannot be rejected",
            ) from exc
        raise
    return CensusRecordOut.model_validate(updated)


@router.post(
    "/records/{record_id}/promote",
    response_model=PromoteResult,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE, PERM_CITIZEN_CREATE))],
)
async def promote_record(
    record_id: uuid.UUID,
    body: PromoteRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PromoteResult:
    from apps.api.core.security import user_permission_codes

    req = body or PromoteRequest()
    if req.assign_nic and PERM_CITIZEN_VALIDATE not in user_permission_codes(current_user):
        raise HTTPException(
            status_code=403,
            detail="Missing required permission registry:citizen:validate for assign_nic",
        )
    rec = await service.get_record(db, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    try:
        return await service.promote_record(db, rec, current_user.id, req)
    except ValueError as exc:
        code = str(exc)
        mapping = {
            "not_promotable": (409, f"Record status {rec.status.value} cannot be promoted"),
            "missing_given_names": (422, "given_names required"),
            "missing_family_name": (422, "family_name required"),
            "missing_date_of_birth": (422, "date_of_birth required"),
            "invalid_date_of_birth": (422, "date_of_birth must be YYYY-MM-DD"),
            "orphan_citizen_link": (409, "Linked citizen missing"),
        }
        status_code, detail = mapping.get(code, (400, code))
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post(
    "/campaigns/{campaign_id}/promote",
    response_model=BatchPromoteResult,
    dependencies=[Depends(require_permissions(PERM_CENSUS_MANAGE, PERM_CITIZEN_CREATE))],
)
async def promote_campaign(
    campaign_id: uuid.UUID,
    body: BatchPromoteRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchPromoteResult:
    from apps.api.core.security import user_permission_codes

    campaign = await service.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    req = body or BatchPromoteRequest()
    if req.assign_nic and PERM_CITIZEN_VALIDATE not in user_permission_codes(current_user):
        raise HTTPException(
            status_code=403,
            detail="Missing required permission registry:citizen:validate for assign_nic",
        )
    return await service.promote_campaign_batch(db, campaign_id, current_user.id, req)


@router.post(
    "/form-drafts",
    response_model=FormDraftOut,
    status_code=status.HTTP_201_CREATED,
    summary="Créer / mettre à jour un brouillon partagé (tous systèmes)",
)
async def upsert_form_draft(
    body: FormDraftCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormDraftOut:
    try:
        draft = await service.upsert_form_draft(db, body, owner_user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return draft  # type: ignore[return-value]


@router.get(
    "/form-drafts",
    response_model=list[FormDraftOut],
    summary="Lister les brouillons synchronisés (reprise par un autre agent)",
)
async def list_form_drafts(
    system: str | None = Query(default=None),
    form_type: str | None = Query(default=None),
    status_filter: str | None = Query(default="DRAFT", alias="status"),
    province_id: uuid.UUID | None = Query(default=None),
    ville_id: uuid.UUID | None = Query(default=None),
    campaign_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None, description="Recherche titre / local_id / contenu"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[FormDraftOut]:
    rows = await service.list_form_drafts(
        db,
        system=system,
        form_type=form_type,
        status=status_filter,
        province_id=province_id,
        ville_id=ville_id,
        campaign_id=campaign_id,
        q=q,
        limit=limit,
    )
    return rows  # type: ignore[return-value]


@router.get("/form-drafts/{draft_id}", response_model=FormDraftOut)
async def get_form_draft(
    draft_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> FormDraftOut:
    draft = await service.get_form_draft(db, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft  # type: ignore[return-value]


@router.patch("/form-drafts/{draft_id}", response_model=FormDraftOut)
async def patch_form_draft(
    draft_id: uuid.UUID,
    body: FormDraftUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormDraftOut:
    draft = await service.get_form_draft(db, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    try:
        updated = await service.update_form_draft(db, draft, body, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return updated  # type: ignore[return-value]


@router.post(
    "/coupons/resolve",
    response_model=CouponResolveOut,
    summary="Résoudre un coupon QR APK (nn_census_coupon) pour la commune",
)
async def resolve_coupon(
    body: CouponResolveIn,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> CouponResolveOut:
    result = await service.resolve_field_coupon(db, body.raw)
    return CouponResolveOut(**result)
