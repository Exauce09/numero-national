"""HTTP routes — auth, institutions, RBAC."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import Settings, get_settings
from apps.api.core.security import (
    bearer_scheme,
    get_current_user,
    require_permissions,
    user_permission_codes,
)
from apps.api.db.session import get_db
from apps.api.domains.audit.services import write_audit
from apps.api.domains.identity import services as identity_services
from apps.api.domains.identity.models import User
from apps.api.domains.identity.schemas import (
    InstitutionCreate,
    InstitutionRead,
    InstitutionUpdate,
    MFASetupResponse,
    MFAVerifyRequest,
    PermissionRead,
    RefreshRequest,
    RoleAssignRequest,
    RoleRead,
    TokenPair,
    UserLogin,
    UserMe,
    UserRegister,
)
from apps.api.domains.identity.seed import seed_roles_and_permissions

auth_router = APIRouter(prefix="/auth", tags=["auth"])
institutions_router = APIRouter(prefix="/institutions", tags=["institutions"])
rbac_router = APIRouter(prefix="/rbac", tags=["rbac"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    device = request.headers.get("user-agent")
    return ip, device


async def _require_register_actor(
    request: Request,
    db: AsyncSession,
    settings: Settings,
) -> User | None:
    """Open registration only when ALLOW_OPEN_REGISTRATION=true (never implied by env alone)."""
    if settings.allow_open_registration and not settings.is_production:
        return None

    credentials = await bearer_scheme(request)
    actor = await get_current_user(credentials=credentials, db=db, settings=settings)
    if "users:manage" not in user_permission_codes(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing permissions: users:manage",
        )
    return actor


@auth_router.post(
    "/register",
    response_model=UserMe,
    status_code=status.HTTP_201_CREATED,
    summary="Register a user (development or admin)",
)
async def register(
    payload: UserRegister,
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UserMe:
    """
    Registration is open in non-production environments.
    In production, only callers with ``users:manage`` may register accounts.
    """
    await seed_roles_and_permissions(db)
    actor = await _require_register_actor(request, db, settings)
    user = await identity_services.register_user(db, payload)
    ip, device = _client_meta(request)
    await write_audit(
        db,
        actor_id=actor.id if actor else user.id,
        institution_id=user.institution_id,
        action="user.register",
        resource_type="user",
        resource_id=str(user.id),
        ip=ip,
        device=device,
        result="success",
        new_value={"email": user.email, "full_name": user.full_name},
    )
    return identity_services.user_to_me(user)


@auth_router.post("/login", response_model=TokenPair, summary="Login with email/password (+ MFA)")
async def login(
    payload: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    tokens = await identity_services.authenticate_user(db, payload)
    user = await identity_services.get_user_by_email(db, payload.email)
    ip, device = _client_meta(request)
    await write_audit(
        db,
        actor_id=user.id if user else None,
        institution_id=user.institution_id if user else None,
        action="user.login",
        resource_type="user",
        resource_id=str(user.id) if user else None,
        ip=ip,
        device=device,
        result="success",
    )
    return tokens


@auth_router.post("/refresh", response_model=TokenPair, summary="Refresh access token")
async def refresh(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    return await identity_services.refresh_tokens(db, payload.refresh_token)


@auth_router.post("/mfa/setup", response_model=MFASetupResponse, summary="Start MFA enrollment")
async def mfa_setup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MFASetupResponse:
    return await identity_services.setup_mfa(db, current_user)


@auth_router.post("/mfa/verify", response_model=UserMe, summary="Verify TOTP and enable MFA")
async def mfa_verify(
    payload: MFAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMe:
    user = await identity_services.verify_and_enable_mfa(db, current_user, payload.code)
    ip, device = _client_meta(request)
    await write_audit(
        db,
        actor_id=user.id,
        institution_id=user.institution_id,
        action="user.mfa.enable",
        resource_type="user",
        resource_id=str(user.id),
        ip=ip,
        device=device,
        result="success",
    )
    return identity_services.user_to_me(user)


@auth_router.get("/me", response_model=UserMe, summary="Current authenticated user")
async def me(current_user: User = Depends(get_current_user)) -> UserMe:
    return identity_services.user_to_me(current_user)


# --- Institutions (admin) ---------------------------------------------------


@institutions_router.post(
    "",
    response_model=InstitutionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permissions("institutions:manage"))],
)
async def create_institution(
    payload: InstitutionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstitutionRead:
    inst = await identity_services.create_institution(db, payload)
    ip, device = _client_meta(request)
    await write_audit(
        db,
        actor_id=current_user.id,
        institution_id=current_user.institution_id,
        action="institution.create",
        resource_type="institution",
        resource_id=str(inst.id),
        ip=ip,
        device=device,
        result="success",
        new_value={"code": inst.code, "name": inst.name, "type": inst.type.value},
    )
    return InstitutionRead.model_validate(inst)


@institutions_router.get(
    "",
    response_model=list[InstitutionRead],
    dependencies=[Depends(require_permissions("institutions:manage"))],
)
async def list_institutions(db: AsyncSession = Depends(get_db)) -> list[InstitutionRead]:
    items = await identity_services.list_institutions(db)
    return [InstitutionRead.model_validate(i) for i in items]


@institutions_router.get(
    "/{institution_id}",
    response_model=InstitutionRead,
    dependencies=[Depends(require_permissions("institutions:manage"))],
)
async def get_institution(
    institution_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> InstitutionRead:
    inst = await identity_services.get_institution(db, institution_id)
    return InstitutionRead.model_validate(inst)


@institutions_router.patch(
    "/{institution_id}",
    response_model=InstitutionRead,
    dependencies=[Depends(require_permissions("institutions:manage"))],
)
async def update_institution(
    institution_id: UUID,
    payload: InstitutionUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstitutionRead:
    before = await identity_services.get_institution(db, institution_id)
    old = {"name": before.name, "type": before.type.value, "status": before.status.value}
    inst = await identity_services.update_institution(db, institution_id, payload)
    ip, device = _client_meta(request)
    await write_audit(
        db,
        actor_id=current_user.id,
        institution_id=current_user.institution_id,
        action="institution.update",
        resource_type="institution",
        resource_id=str(inst.id),
        ip=ip,
        device=device,
        result="success",
        old_value=old,
        new_value={"name": inst.name, "type": inst.type.value, "status": inst.status.value},
    )
    return InstitutionRead.model_validate(inst)


@institutions_router.delete(
    "/{institution_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permissions("institutions:manage"))],
)
async def delete_institution(
    institution_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await identity_services.delete_institution(db, institution_id)
    ip, device = _client_meta(request)
    await write_audit(
        db,
        actor_id=current_user.id,
        institution_id=current_user.institution_id,
        action="institution.delete",
        resource_type="institution",
        resource_id=str(institution_id),
        ip=ip,
        device=device,
        result="success",
    )


# --- RBAC -------------------------------------------------------------------


@rbac_router.get(
    "/roles",
    response_model=list[RoleRead],
    dependencies=[Depends(require_permissions("roles:manage"))],
)
async def list_roles(db: AsyncSession = Depends(get_db)) -> list[RoleRead]:
    await seed_roles_and_permissions(db)
    roles = await identity_services.list_roles(db)
    return [RoleRead.model_validate(r) for r in roles]


@rbac_router.get(
    "/permissions",
    response_model=list[PermissionRead],
    dependencies=[Depends(require_permissions("permissions:read"))],
)
async def list_permissions(db: AsyncSession = Depends(get_db)) -> list[PermissionRead]:
    await seed_roles_and_permissions(db)
    perms = await identity_services.list_permissions(db)
    return [PermissionRead.model_validate(p) for p in perms]


@rbac_router.put(
    "/users/{user_id}/roles",
    response_model=UserMe,
    dependencies=[Depends(require_permissions("roles:manage"))],
)
async def assign_roles(
    user_id: UUID,
    payload: RoleAssignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMe:
    user = await identity_services.assign_roles_to_user(db, user_id, payload.role_codes)
    ip, device = _client_meta(request)
    await write_audit(
        db,
        actor_id=current_user.id,
        institution_id=current_user.institution_id,
        action="user.roles.assign",
        resource_type="user",
        resource_id=str(user.id),
        ip=ip,
        device=device,
        result="success",
        new_value={"role_codes": payload.role_codes},
    )
    return identity_services.user_to_me(user)
