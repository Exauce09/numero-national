"""IAM institutional routes — /api/v1/iam."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.security import get_current_user, require_permissions, user_permission_codes
from apps.api.db.session import get_db
from apps.api.domains.identity import iam_services
from apps.api.domains.identity.iam_schemas import (
    AccountDetail,
    AccountListResponse,
    AccountProvisionCreate,
    AccountProvisionResult,
    AccountRequestApprove,
    AccountRequestCreate,
    AccountRequestRead,
    AccountRequestReject,
    AssignableRolesResponse,
    AssignmentChangeRequest,
    AssignmentCreate,
    AssignmentRead,
    BureauCreate,
    BureauRead,
    BureauUpdate,
    HistoryEvent,
    PersonnelCreate,
    PersonnelRead,
    PersonnelUpdate,
    RoleChangeRequest,
    ScopeCreate,
    ScopeRead,
    UserStatusAction,
)
from apps.api.domains.identity.models import User
from apps.api.domains.identity.seed import seed_roles_and_permissions

iam_router = APIRouter(prefix="/iam", tags=["iam-institutional"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    device = request.headers.get("user-agent")
    return ip, device


@iam_router.post("/personnel", response_model=PersonnelRead, status_code=201)
async def create_personnel(
    payload: PersonnelCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("personnel:manage")),
) -> PersonnelRead:
    row = await iam_services.create_personnel(db, payload, actor_id=actor.id)
    return PersonnelRead.model_validate(row)


@iam_router.get("/personnel", response_model=list[PersonnelRead])
async def list_personnel(
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions("personnel:read")),
) -> list[PersonnelRead]:
    from apps.api.domains.identity import account_admin_services as admin

    if q:
        rows = await admin.searchable_personnel(db, q=q, limit=limit)
    else:
        rows = await iam_services.list_personnel(db, limit=limit, offset=offset)
    return [PersonnelRead.model_validate(r) for r in rows]


@iam_router.get("/personnel/{personnel_id}/account-check")
async def personnel_account_check(
    personnel_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions("personnel:read")),
) -> dict:
    from apps.api.domains.identity import account_admin_services as admin

    existing = await admin.personnel_has_active_account(db, personnel_id)
    return {
        "personnel_id": str(personnel_id),
        "has_active_account": existing is not None,
        "user_id": str(existing.id) if existing else None,
        "account_status": existing.account_status if existing else None,
    }


@iam_router.patch("/personnel/{personnel_id}", response_model=PersonnelRead)
async def update_personnel(
    personnel_id: UUID,
    payload: PersonnelUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("personnel:manage")),
) -> PersonnelRead:
    row = await iam_services.update_personnel(db, personnel_id, payload, actor_id=actor.id)
    return PersonnelRead.model_validate(row)


@iam_router.post("/bureaux", response_model=BureauRead, status_code=201)
async def create_bureau(
    payload: BureauCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("bureau:manage")),
) -> BureauRead:
    row = await iam_services.create_bureau(db, payload, actor_id=actor.id)
    return BureauRead.model_validate(row)


@iam_router.get("/bureaux", response_model=list[BureauRead])
async def list_bureaux(
    commune_code: str | None = None,
    province_id: UUID | None = None,
    ville_id: UUID | None = None,
    commune_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("bureau:read")),
) -> list[BureauRead]:
    from apps.api.domains.identity import account_admin_services as admin

    if province_id or ville_id or commune_id:
        rows = await admin.list_bureaux_scoped(
            db,
            actor,
            province_id=province_id,
            ville_id=ville_id,
            commune_id=commune_id,
            commune_code=commune_code,
        )
    else:
        rows = await iam_services.list_bureaux(db, commune_code=commune_code)
        # Still filter by actor scope when listing broadly
        roles = iam_services.user_role_codes(actor)
        if not (roles & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN", "ADMIN_NATIONAL"}):
            filtered = []
            for b in rows:
                if await iam_services.user_has_bureau_access(db, actor, b.id):
                    filtered.append(b)
            rows = filtered
    return [BureauRead.model_validate(r) for r in rows]


@iam_router.patch("/bureaux/{bureau_id}", response_model=BureauRead)
async def update_bureau(
    bureau_id: UUID,
    payload: BureauUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("bureau:manage")),
) -> BureauRead:
    row = await iam_services.update_bureau(db, bureau_id, payload, actor_id=actor.id)
    return BureauRead.model_validate(row)


@iam_router.post("/assignments", response_model=AssignmentRead, status_code=201)
async def create_assignment(
    payload: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("assignment:manage")),
) -> AssignmentRead:
    row = await iam_services.create_assignment(db, payload, actor_id=actor.id)
    return AssignmentRead.model_validate(row)


@iam_router.get("/assignments", response_model=list[AssignmentRead])
async def list_assignments(
    personnel_id: UUID | None = None,
    bureau_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions("assignment:read")),
) -> list[AssignmentRead]:
    rows = await iam_services.list_assignments(db, personnel_id=personnel_id, bureau_id=bureau_id)
    return [AssignmentRead.model_validate(r) for r in rows]


@iam_router.post("/assignments/{assignment_id}/close", response_model=AssignmentRead)
async def close_assignment(
    assignment_id: UUID,
    end_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("assignment:manage")),
) -> AssignmentRead:
    row = await iam_services.close_assignment(
        db, assignment_id, actor_id=actor.id, end_date=end_date
    )
    return AssignmentRead.model_validate(row)


@iam_router.post("/scopes", response_model=ScopeRead, status_code=201)
async def assign_scope(
    payload: ScopeCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> ScopeRead:
    if actor.id == payload.user_id:
        raise HTTPException(status_code=403, detail="Cannot assign own territorial scope")
    row = await iam_services.set_scopes(db, payload, actor_id=actor.id)
    return ScopeRead.model_validate(row)


@iam_router.get("/scopes/{user_id}", response_model=list[ScopeRead])
async def list_user_scopes(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions("users:manage")),
) -> list[ScopeRead]:
    rows = await iam_services.list_scopes(db, user_id)
    return [ScopeRead.model_validate(r) for r in rows]


@iam_router.post("/account-requests", response_model=AccountRequestRead, status_code=201)
async def create_account_request(
    payload: AccountRequestCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> AccountRequestRead:
    await seed_roles_and_permissions(db)
    # Responsable bureau may initiate; admins may manage
    perms = user_permission_codes(actor)
    if "account_request:create" not in perms and "account_request:manage" not in perms:
        raise HTTPException(status_code=403, detail="Missing account_request permission")
    row = await iam_services.create_account_request(db, payload, actor=actor)
    return AccountRequestRead.model_validate(row)


@iam_router.get("/account-requests", response_model=list[AccountRequestRead])
async def list_account_requests(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions("account_request:manage")),
) -> list[AccountRequestRead]:
    rows = await iam_services.list_account_requests(db, status_filter=status_filter)
    return [AccountRequestRead.model_validate(r) for r in rows]


@iam_router.post("/account-requests/{request_id}/approve", response_model=AccountRequestRead)
async def approve_account_request(
    request_id: UUID,
    payload: AccountRequestApprove,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("account_request:manage")),
) -> AccountRequestRead:
    await seed_roles_and_permissions(db)
    row = await iam_services.approve_account_request(db, request_id, payload, actor=actor)
    return AccountRequestRead.model_validate(row)


@iam_router.post("/account-requests/{request_id}/reject", response_model=AccountRequestRead)
async def reject_account_request(
    request_id: UUID,
    payload: AccountRequestReject,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("account_request:manage")),
) -> AccountRequestRead:
    row = await iam_services.reject_account_request(
        db, request_id, payload.rejection_reason, actor=actor
    )
    return AccountRequestRead.model_validate(row)


@iam_router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: UUID,
    payload: UserStatusAction,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> dict:
    from apps.api.domains.identity import account_admin_services as admin

    user = await admin.reactivate_account(db, user_id, actor=actor, reason=payload.reason)
    return {"id": str(user.id), "account_status": user.account_status, "is_active": user.is_active}


@iam_router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: UUID,
    payload: UserStatusAction,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> dict:
    user = await iam_services.set_user_account_status(
        db, user_id, account_status="SUSPENDED", reason=payload.reason, actor=actor
    )
    return {"id": str(user.id), "account_status": user.account_status, "is_active": user.is_active}


@iam_router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: UUID,
    payload: UserStatusAction,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> dict:
    user = await iam_services.set_user_account_status(
        db, user_id, account_status="DISABLED", reason=payload.reason, actor=actor
    )
    return {"id": str(user.id), "account_status": user.account_status, "is_active": user.is_active}


@iam_router.get("/bureaux/{bureau_id}/access-check")
async def bureau_access_check(
    bureau_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    ok = await iam_services.user_has_bureau_access(db, actor, bureau_id)
    if not ok:
        raise HTTPException(status_code=403, detail="Outside territorial scope")
    return {"bureau_id": str(bureau_id), "allowed": True}


# --- Account administration (wizard lifecycle) ---------------------------------


@iam_router.get("/accounts", response_model=AccountListResponse)
async def list_accounts(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> AccountListResponse:
    from apps.api.domains.identity import account_admin_services as admin

    return await admin.list_accounts(
        db, actor, status_filter=status_filter, limit=limit, offset=offset
    )


@iam_router.get("/accounts/assignable-roles", response_model=AssignableRolesResponse)
async def assignable_roles(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> AssignableRolesResponse:
    from apps.api.domains.identity import account_admin_services as admin

    return await admin.assignable_roles_for_actor(db, actor)


@iam_router.post("/accounts/provision", response_model=AccountProvisionResult, status_code=201)
async def provision_account(
    payload: AccountProvisionCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> AccountProvisionResult:
    from apps.api.domains.identity import account_admin_services as admin

    return await admin.provision_account(db, payload, actor=actor)


@iam_router.get("/accounts/{user_id}", response_model=AccountDetail)
async def get_account(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> AccountDetail:
    from apps.api.domains.identity import account_admin_services as admin

    return await admin.get_account_detail(db, actor, user_id)


@iam_router.get("/accounts/{user_id}/history", response_model=list[HistoryEvent])
async def account_history(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> list[HistoryEvent]:
    from apps.api.domains.identity import account_admin_services as admin

    await admin.get_account_detail(db, actor, user_id)
    return await admin.account_history(db, user_id)


@iam_router.post("/accounts/{user_id}/change-role", response_model=AccountDetail)
async def change_role(
    user_id: UUID,
    payload: RoleChangeRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> AccountDetail:
    from apps.api.domains.identity import account_admin_services as admin

    await admin.change_role(db, user_id, payload, actor=actor)
    return await admin.get_account_detail(db, actor, user_id)


@iam_router.post("/accounts/{user_id}/change-assignment", response_model=AssignmentRead)
async def change_assignment(
    user_id: UUID,
    payload: AssignmentChangeRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("assignment:manage")),
) -> AssignmentRead:
    from apps.api.domains.identity import account_admin_services as admin

    row = await admin.change_assignment(db, user_id, payload, actor=actor)
    return AssignmentRead.model_validate(row)


@iam_router.post("/accounts/{user_id}/reset-access", response_model=AccountProvisionResult)
async def reset_access(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permissions("users:manage")),
) -> AccountProvisionResult:
    from apps.api.domains.identity import account_admin_services as admin

    return await admin.reset_access_invite(db, user_id, actor=actor)

