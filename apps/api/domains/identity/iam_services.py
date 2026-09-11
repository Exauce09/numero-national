"""Institutional IAM services — personnel, bureaux, assignments, scopes, account requests."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.core.security import hash_password
from apps.api.domains.audit.services import write_audit
from apps.api.domains.identity.iam_schemas import (
    AccountRequestApprove,
    AccountRequestCreate,
    AssignmentCreate,
    BureauCreate,
    BureauUpdate,
    PersonnelCreate,
    PersonnelUpdate,
    ScopeCreate,
)
from apps.api.domains.identity.models import (
    AccountRequest,
    AccountRequestStatus,
    AccountStatus,
    Assignment,
    AssignmentStatus,
    BureauEtatCivil,
    Personnel,
    PersonnelStatus,
    Role,
    TerritorialScope,
    User,
)
from apps.api.domains.identity.services import _resolve_roles, get_user_by_id

# Roles that may never be self-assigned or requested via open register.
PRIVILEGED_ROLES = frozenset(
    {
        "SUPER_ADMIN_NATIONAL",
        "ADMIN_NATIONAL",
        "ADMIN_PROVINCIAL",
        "CENTRAL_ADMIN",
    }
)

# Who may create whom (requested_role → required creator roles).
ROLE_CREATION_MATRIX: dict[str, frozenset[str]] = {
    "ADMIN_NATIONAL": frozenset({"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN"}),
    "ADMIN_PROVINCIAL": frozenset({"ADMIN_NATIONAL", "SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN"}),
    "RESPONSABLE_BUREAU": frozenset(
        {"ADMIN_PROVINCIAL", "ADMIN_NATIONAL", "SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN"}
    ),
    "OFFICIER_ETAT_CIVIL": frozenset(
        {
            "ADMIN_PROVINCIAL",
            "ADMIN_NATIONAL",
            "SUPER_ADMIN_NATIONAL",
            "CENTRAL_ADMIN",
            "RESPONSABLE_BUREAU",
        }
    ),
    "AGENT_ETAT_CIVIL": frozenset(
        {
            "ADMIN_PROVINCIAL",
            "ADMIN_NATIONAL",
            "SUPER_ADMIN_NATIONAL",
            "CENTRAL_ADMIN",
            "RESPONSABLE_BUREAU",
        }
    ),
    "AUDITEUR": frozenset({"ADMIN_NATIONAL", "SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN"}),
    "CIVIL_OFFICER": frozenset(
        {
            "ADMIN_PROVINCIAL",
            "ADMIN_NATIONAL",
            "SUPER_ADMIN_NATIONAL",
            "CENTRAL_ADMIN",
            "RESPONSABLE_BUREAU",
        }
    ),
}

SENSITIVE_FUNCTIONS = frozenset({"OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"})


def user_role_codes(user: User) -> set[str]:
    return {r.code for r in (user.roles or [])}


def assert_not_self_privilege(actor: User, target_user_id: UUID, role_codes: list[str]) -> None:
    if actor.id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self role elevation is forbidden",
        )
    actor_roles = user_role_codes(actor)
    for code in role_codes:
        if code in PRIVILEGED_ROLES and not (
            actor_roles & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN"}
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot assign privileged role {code}",
            )


def assert_can_request_role(actor: User, requested_role: str) -> None:
    allowed_creators = ROLE_CREATION_MATRIX.get(requested_role)
    if allowed_creators is None:
        # Unknown role: only national admins
        if not (user_role_codes(actor) & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN", "ADMIN_NATIONAL"}):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot request role {requested_role}",
            )
        return
    if not (user_role_codes(actor) & allowed_creators):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your roles cannot create/request {requested_role}",
        )


async def create_personnel(db: AsyncSession, payload: PersonnelCreate, *, actor_id: UUID | None) -> Personnel:
    existing = await db.scalar(select(Personnel).where(Personnel.matricule == payload.matricule))
    if existing:
        raise HTTPException(status_code=409, detail="Matricule already exists")
    row = Personnel(**payload.model_dump())
    db.add(row)
    await db.flush()
    await write_audit(
        db,
        action="personnel.create",
        actor_id=actor_id,
        resource_type="personnel",
        resource_id=str(row.id),
        new_value={"matricule": row.matricule},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def list_personnel(db: AsyncSession, *, limit: int = 50, offset: int = 0) -> list[Personnel]:
    result = await db.execute(
        select(Personnel).order_by(Personnel.family_name).offset(offset).limit(limit)
    )
    return list(result.scalars().all())


async def update_personnel(
    db: AsyncSession, personnel_id: UUID, payload: PersonnelUpdate, *, actor_id: UUID | None
) -> Personnel:
    row = await db.get(Personnel, personnel_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Personnel not found")
    old = {"status": row.status}
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await write_audit(
        db,
        action="personnel.update",
        actor_id=actor_id,
        resource_type="personnel",
        resource_id=str(row.id),
        old_value=old,
        new_value=payload.model_dump(exclude_unset=True),
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def create_bureau(db: AsyncSession, payload: BureauCreate, *, actor_id: UUID | None) -> BureauEtatCivil:
    existing = await db.scalar(select(BureauEtatCivil).where(BureauEtatCivil.code == payload.code))
    if existing:
        raise HTTPException(status_code=409, detail="Bureau code already exists")
    row = BureauEtatCivil(**payload.model_dump(), opened_at=datetime.now(timezone.utc))
    db.add(row)
    await db.flush()
    await write_audit(
        db,
        action="bureau.create",
        actor_id=actor_id,
        resource_type="bureau_etat_civil",
        resource_id=str(row.id),
        new_value={"code": row.code, "name": row.name},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def list_bureaux(
    db: AsyncSession, *, commune_code: str | None = None, limit: int = 100, offset: int = 0
) -> list[BureauEtatCivil]:
    q = select(BureauEtatCivil).order_by(BureauEtatCivil.code)
    if commune_code:
        q = q.where(BureauEtatCivil.commune_code == commune_code)
    result = await db.execute(q.offset(offset).limit(limit))
    return list(result.scalars().all())


async def update_bureau(
    db: AsyncSession, bureau_id: UUID, payload: BureauUpdate, *, actor_id: UUID | None
) -> BureauEtatCivil:
    row = await db.get(BureauEtatCivil, bureau_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Bureau not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await write_audit(
        db,
        action="bureau.update",
        actor_id=actor_id,
        resource_type="bureau_etat_civil",
        resource_id=str(row.id),
        new_value=payload.model_dump(exclude_unset=True),
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def create_assignment(
    db: AsyncSession, payload: AssignmentCreate, *, actor_id: UUID | None
) -> Assignment:
    personnel = await db.get(Personnel, payload.personnel_id)
    if personnel is None or personnel.status != PersonnelStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Personnel must exist and be ACTIVE")
    if payload.bureau_id:
        bureau = await db.get(BureauEtatCivil, payload.bureau_id)
        if bureau is None or bureau.status != "ACTIVE":
            raise HTTPException(status_code=400, detail="Bureau must exist and be ACTIVE")
    row = Assignment(
        **payload.model_dump(exclude={"open_ended"}),
        assigned_by=actor_id,
        status=AssignmentStatus.ACTIVE.value,
    )
    if getattr(payload, "open_ended", False):
        row.end_date = None
    if row.end_date is not None and row.end_date < row.start_date:
        raise HTTPException(status_code=400, detail="date_fin must be >= date_debut")
    db.add(row)
    await db.flush()
    await write_audit(
        db,
        action="assignment.create",
        actor_id=actor_id,
        resource_type="assignment",
        resource_id=str(row.id),
        new_value={
            "personnel_id": str(row.personnel_id),
            "bureau_id": str(row.bureau_id) if row.bureau_id else None,
            "function_code": row.function_code,
        },
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def close_assignment(
    db: AsyncSession, assignment_id: UUID, *, actor_id: UUID | None, end_date: date | None = None
) -> Assignment:
    row = await db.get(Assignment, assignment_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    row.status = AssignmentStatus.CLOSED.value
    row.end_date = end_date or date.today()
    await write_audit(
        db,
        action="assignment.close",
        actor_id=actor_id,
        resource_type="assignment",
        resource_id=str(row.id),
        new_value={"status": row.status, "end_date": str(row.end_date)},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def list_assignments(
    db: AsyncSession, *, personnel_id: UUID | None = None, bureau_id: UUID | None = None
) -> list[Assignment]:
    q = select(Assignment).order_by(Assignment.created_at.desc())
    if personnel_id:
        q = q.where(Assignment.personnel_id == personnel_id)
    if bureau_id:
        q = q.where(Assignment.bureau_id == bureau_id)
    result = await db.execute(q.limit(200))
    return list(result.scalars().all())


async def set_scopes(
    db: AsyncSession, payload: ScopeCreate, *, actor_id: UUID | None
) -> TerritorialScope:
    user = await get_user_by_id(db, payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    scope = TerritorialScope(**payload.model_dump())
    db.add(scope)
    await db.flush()
    await write_audit(
        db,
        action="scope.assign",
        actor_id=actor_id,
        resource_type="territorial_scope",
        resource_id=str(scope.id),
        new_value=payload.model_dump(mode="json"),
        commit=False,
    )
    await db.commit()
    await db.refresh(scope)
    return scope


async def list_scopes(db: AsyncSession, user_id: UUID) -> list[TerritorialScope]:
    result = await db.execute(
        select(TerritorialScope).where(TerritorialScope.user_id == user_id)
    )
    return list(result.scalars().all())


async def create_account_request(
    db: AsyncSession, payload: AccountRequestCreate, *, actor: User
) -> AccountRequest:
    assert_can_request_role(actor, payload.requested_role)
    personnel = await db.get(Personnel, payload.personnel_id)
    if personnel is None or personnel.status != PersonnelStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Personnel must be ACTIVE")

    if payload.requested_role in SENSITIVE_FUNCTIONS or payload.requested_role == "OFFICIER_ETAT_CIVIL":
        active = await db.scalar(
            select(Assignment).where(
                Assignment.personnel_id == payload.personnel_id,
                Assignment.status == AssignmentStatus.ACTIVE.value,
            )
        )
        if active is None:
            raise HTTPException(
                status_code=400,
                detail="Active assignment required before OFFICIER/AGENT account request",
            )

    row = AccountRequest(
        personnel_id=payload.personnel_id,
        requested_by=actor.id,
        reason=payload.reason,
        requested_role=payload.requested_role,
        requested_scope_type=payload.requested_scope_type,
        requested_bureau_id=payload.requested_bureau_id,
        requested_province_id=payload.requested_province_id,
        status=AccountRequestStatus.PENDING.value,
    )
    db.add(row)
    await db.flush()
    await write_audit(
        db,
        action="account_request.create",
        actor_id=actor.id,
        resource_type="account_request",
        resource_id=str(row.id),
        new_value={"requested_role": row.requested_role, "personnel_id": str(row.personnel_id)},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def list_account_requests(
    db: AsyncSession, *, status_filter: str | None = None
) -> list[AccountRequest]:
    q = select(AccountRequest).order_by(AccountRequest.requested_at.desc())
    if status_filter:
        q = q.where(AccountRequest.status == status_filter)
    result = await db.execute(q.limit(200))
    return list(result.scalars().all())


async def approve_account_request(
    db: AsyncSession,
    request_id: UUID,
    payload: AccountRequestApprove,
    *,
    actor: User,
) -> AccountRequest:
    row = await db.get(AccountRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Account request not found")
    if row.status != AccountRequestStatus.PENDING.value:
        raise HTTPException(status_code=409, detail=f"Request is {row.status}")

    assert_can_request_role(actor, row.requested_role)
    personnel = await db.get(Personnel, row.personnel_id)
    if personnel is None:
        raise HTTPException(status_code=400, detail="Personnel missing")

    email = payload.email or personnel.email_pro
    if not email:
        raise HTTPException(status_code=400, detail="email required to create account")

    existing = await db.scalar(select(User).where(User.email == str(email).lower()))
    if existing:
        raise HTTPException(status_code=409, detail="User email already exists")

    role_codes = payload.role_codes or [row.requested_role]
    if row.requested_role == "OFFICIER_ETAT_CIVIL" and "CIVIL_OFFICER" not in role_codes:
        role_codes = list({*role_codes, "CIVIL_OFFICER", "OFFICIER_ETAT_CIVIL"})
    # Creating a *new* account — never treat as self-elevation of the approver.
    actor_roles = user_role_codes(actor)
    if set(role_codes) & PRIVILEGED_ROLES and not (
        actor_roles & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN"}
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approver cannot grant privileged administrative roles",
        )

    roles = await _resolve_roles(db, role_codes)
    user = User(
        email=str(email).lower(),
        hashed_password=hash_password(payload.temporary_password),
        full_name=f"{personnel.given_names} {personnel.family_name}".strip(),
        is_active=True,
        account_status=AccountStatus.ACTIVE.value,
        personnel_id=personnel.id,
        roles=roles,
    )
    db.add(user)
    await db.flush()

    if row.requested_bureau_id or row.requested_scope_type:
        db.add(
            TerritorialScope(
                user_id=user.id,
                scope_type=row.requested_scope_type or "BUREAU",
                territory_id=row.requested_province_id,
                bureau_id=row.requested_bureau_id,
            )
        )

    row.status = AccountRequestStatus.APPROVED.value
    row.approved_by = actor.id
    row.approved_at = datetime.now(timezone.utc)
    row.created_user_id = user.id

    await write_audit(
        db,
        action="account_request.approve",
        actor_id=actor.id,
        resource_type="account_request",
        resource_id=str(row.id),
        new_value={"created_user_id": str(user.id), "roles": role_codes},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def reject_account_request(
    db: AsyncSession, request_id: UUID, reason: str, *, actor: User
) -> AccountRequest:
    row = await db.get(AccountRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Account request not found")
    if row.status != AccountRequestStatus.PENDING.value:
        raise HTTPException(status_code=409, detail=f"Request is {row.status}")
    row.status = AccountRequestStatus.REJECTED.value
    row.rejection_reason = reason
    row.approved_by = actor.id
    row.approved_at = datetime.now(timezone.utc)
    await write_audit(
        db,
        action="account_request.reject",
        actor_id=actor.id,
        resource_type="account_request",
        resource_id=str(row.id),
        new_value={"rejection_reason": reason},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def set_user_account_status(
    db: AsyncSession,
    user_id: UUID,
    *,
    account_status: str,
    reason: str,
    actor: User,
) -> User:
    if actor.id == user_id and account_status in {
        AccountStatus.DISABLED.value,
        AccountStatus.SUSPENDED.value,
    }:
        raise HTTPException(status_code=403, detail="Cannot suspend/disable yourself")
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    old = {"account_status": user.account_status, "is_active": user.is_active}
    user.account_status = account_status
    if account_status == AccountStatus.ACTIVE.value:
        user.is_active = True
        user.disabled_at = None
    elif account_status in {AccountStatus.SUSPENDED.value, AccountStatus.DISABLED.value}:
        user.is_active = False
        user.disabled_at = datetime.now(timezone.utc)
        from apps.api.domains.identity.services import _revoke_user_refresh_sessions

        await _revoke_user_refresh_sessions(db, user_id)
    await write_audit(
        db,
        action={
            AccountStatus.ACTIVE.value: "ACCOUNT_REACTIVATED",
            AccountStatus.SUSPENDED.value: "ACCOUNT_SUSPENDED",
            AccountStatus.DISABLED.value: "ACCOUNT_DISABLED",
        }.get(account_status, f"user.{account_status.lower()}"),
        actor_id=actor.id,
        resource_type="user",
        resource_id=str(user.id),
        old_value=old,
        new_value={"account_status": account_status},
        justification=reason,
        commit=False,
    )
    await db.commit()
    await db.refresh(user)
    return user


async def get_active_assignment_for_user(db: AsyncSession, user: User) -> Assignment | None:
    if not user.personnel_id:
        return None
    return await db.scalar(
        select(Assignment).where(
            Assignment.personnel_id == user.personnel_id,
            Assignment.status == AssignmentStatus.ACTIVE.value,
        )
    )


async def user_has_bureau_access(db: AsyncSession, user: User, bureau_id: UUID) -> bool:
    roles = user_role_codes(user)
    if roles & {"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN", "ADMIN_NATIONAL"}:
        return True
    scopes = await list_scopes(db, user.id)
    for s in scopes:
        if s.scope_type == "NATIONAL":
            return True
    # Explicit BUREAU scopes restrict to listed bureaux (mutation-safe).
    bureau_scopes = [s for s in scopes if s.scope_type == "BUREAU" and s.bureau_id]
    if bureau_scopes:
        if any(s.bureau_id == bureau_id for s in bureau_scopes):
            return True
        assignment = await get_active_assignment_for_user(db, user)
        return bool(assignment and assignment.bureau_id == bureau_id)
    for s in scopes:
        if s.bureau_id == bureau_id:
            return True
        # Resolve PROVINCE / VILLE / COMMUNE scopes against bureau geography.
        if s.scope_type in {"PROVINCE", "VILLE", "COMMUNE"} and s.territory_id:
            bureau = await db.get(BureauEtatCivil, bureau_id)
            if bureau is None:
                continue
            if s.scope_type == "PROVINCE" and bureau.province_id == s.territory_id:
                return True
            if s.scope_type == "VILLE" and bureau.ville_id == s.territory_id:
                return True
            if s.scope_type == "COMMUNE" and bureau.commune_id == s.territory_id:
                return True
    # User geo fallback (élections-style assignment on the account).
    if user.province_id or user.ville_id or user.commune_id:
        bureau = await db.get(BureauEtatCivil, bureau_id)
        if bureau is not None:
            if user.commune_id and bureau.commune_id == user.commune_id:
                return True
            if user.ville_id and bureau.ville_id == user.ville_id:
                return True
            if user.province_id and bureau.province_id == user.province_id:
                return True
    assignment = await get_active_assignment_for_user(db, user)
    return bool(assignment and assignment.bureau_id == bureau_id)


async def load_user_with_rbac(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.territorial_scopes),
        )
    )
    return result.scalar_one_or_none()
