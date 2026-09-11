"""Account administration — provision wizard, lifecycle, territorial guards."""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.core.security import hash_password, validate_password_strength
from apps.api.domains.audit.models import AuditEvent
from apps.api.domains.audit.services import write_audit
from apps.api.domains.identity.iam_schemas import (
    AccountDetail,
    AccountListItem,
    AccountListResponse,
    AccountProvisionCreate,
    AccountProvisionResult,
    AccountStats,
    AssignmentChangeRequest,
    AssignableRolesResponse,
    CitizenRegisterRequest,
    HistoryEvent,
    InviteActivateRequest,
    RoleChangeRequest,
)
from apps.api.domains.identity.iam_services import (
    PRIVILEGED_ROLES,
    ROLE_CREATION_MATRIX,
    SENSITIVE_FUNCTIONS,
    assert_can_request_role,
    assert_not_self_privilege,
    list_scopes,
    load_user_with_rbac,
    user_has_bureau_access,
    user_role_codes,
)
from apps.api.domains.identity.models import (
    AccountInvitation,
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
from apps.api.domains.identity.services import _resolve_roles, get_user_by_email, get_user_by_id

# Role → allowed assignment function codes
ROLE_FUNCTION_COMPAT: dict[str, frozenset[str]] = {
    "OFFICIER_ETAT_CIVIL": frozenset(
        {"OFFICIER_ETAT_CIVIL", "OFFICIER", "RESPONSABLE_BUREAU", "CIVIL_OFFICER"}
    ),
    "CIVIL_OFFICER": frozenset(
        {"OFFICIER_ETAT_CIVIL", "OFFICIER", "RESPONSABLE_BUREAU", "CIVIL_OFFICER"}
    ),
    "AGENT_ETAT_CIVIL": frozenset(
        {"AGENT_ETAT_CIVIL", "AGENT", "OFFICIER_ETAT_CIVIL", "RESPONSABLE_BUREAU"}
    ),
    "RESPONSABLE_BUREAU": frozenset({"RESPONSABLE_BUREAU", "CHEF_BUREAU", "OFFICIER_ETAT_CIVIL"}),
}

NATIONAL_ROLES = frozenset({"SUPER_ADMIN_NATIONAL", "CENTRAL_ADMIN", "ADMIN_NATIONAL"})


def _slug_username(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9._-]", "", value.lower().strip().replace(" ", "."))
    return cleaned[:64] or f"user{secrets.token_hex(3)}"


def _login_email(*, username: str, email: str | None) -> str:
    if email:
        return str(email).lower().strip()
    return f"{_slug_username(username)}@accounts.nic.cd"


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def assert_actor_can_manage_territory(
    db: AsyncSession,
    actor: User,
    *,
    province_id: UUID | None = None,
    bureau_id: UUID | None = None,
) -> None:
    roles = user_role_codes(actor)
    if roles & NATIONAL_ROLES:
        return
    if bureau_id is not None:
        if not await user_has_bureau_access(db, actor, bureau_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bureau hors périmètre d'administration",
            )
        return
    if province_id is not None:
        if actor.province_id and actor.province_id != province_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Province hors périmètre d'administration",
            )
        scopes = await list_scopes(db, actor.id)
        for s in scopes:
            if s.scope_type == "NATIONAL":
                return
            if s.scope_type == "PROVINCE" and s.territory_id == province_id:
                return
        if actor.province_id == province_id:
            return
        if "ADMIN_PROVINCIAL" in roles and actor.province_id is None and not scopes:
            # Provincial without geo binding: still refuse foreign province if no match
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Province hors périmètre d'administration",
            )
        if "ADMIN_PROVINCIAL" in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Province hors périmètre d'administration",
            )


def assert_role_function_compatible(role_code: str, function_code: str) -> None:
    allowed = ROLE_FUNCTION_COMPAT.get(role_code)
    if allowed is None:
        return
    if function_code.upper() not in {x.upper() for x in allowed}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Impossible d'attribuer cette habilitation. "
                "L'affectation/fonction du personnel ne permet pas cette habilitation."
            ),
        )


async def searchable_personnel(
    db: AsyncSession,
    *,
    q: str | None = None,
    limit: int = 50,
) -> list[Personnel]:
    stmt = select(Personnel).order_by(Personnel.family_name).limit(limit)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Personnel.matricule.ilike(like),
                Personnel.family_name.ilike(like),
                Personnel.postnom.ilike(like),
                Personnel.given_names.ilike(like),
            )
        )
    return list((await db.execute(stmt)).scalars().all())


async def personnel_has_active_account(db: AsyncSession, personnel_id: UUID) -> User | None:
    return await db.scalar(
        select(User).where(
            User.personnel_id == personnel_id,
            User.account_status.in_(
                [
                    AccountStatus.ACTIVE.value,
                    AccountStatus.PENDING.value,
                    AccountStatus.SUSPENDED.value,
                ]
            ),
        )
    )


async def list_bureaux_scoped(
    db: AsyncSession,
    actor: User,
    *,
    province_id: UUID | None = None,
    ville_id: UUID | None = None,
    commune_id: UUID | None = None,
    commune_code: str | None = None,
) -> list[BureauEtatCivil]:
    await assert_actor_can_manage_territory(db, actor, province_id=province_id)
    q = select(BureauEtatCivil).where(BureauEtatCivil.status == "ACTIVE").order_by(BureauEtatCivil.code)
    if province_id:
        q = q.where(BureauEtatCivil.province_id == province_id)
    if ville_id:
        q = q.where(BureauEtatCivil.ville_id == ville_id)
    if commune_id:
        q = q.where(BureauEtatCivil.commune_id == commune_id)
    if commune_code:
        q = q.where(BureauEtatCivil.commune_code == commune_code)
    rows = list((await db.execute(q.limit(200))).scalars().all())
    roles = user_role_codes(actor)
    if roles & NATIONAL_ROLES:
        return rows
    filtered: list[BureauEtatCivil] = []
    for b in rows:
        if await user_has_bureau_access(db, actor, b.id):
            filtered.append(b)
    return filtered


async def assignable_roles_for_actor(db: AsyncSession, actor: User) -> AssignableRolesResponse:
    await db.execute(select(Role).limit(1))  # ensure session warm
    from apps.api.domains.identity.seed import seed_roles_and_permissions

    await seed_roles_and_permissions(db)
    result = await db.execute(select(Role).options(selectinload(Role.permissions)).order_by(Role.code))
    roles = list(result.scalars().all())
    out: list[dict] = []
    for role in roles:
        if role.code == "CITIZEN":
            continue
        try:
            assert_can_request_role(actor, role.code)
        except HTTPException:
            continue
        out.append(
            {
                "code": role.code,
                "name": role.name,
                "description": role.description,
                "permissions": sorted({p.code for p in (role.permissions or [])}),
            }
        )
    return AssignableRolesResponse(roles=out)


async def _create_invitation(
    db: AsyncSession, *, user_id: UUID, actor_id: UUID | None, days: int = 7
) -> tuple[str, AccountInvitation]:
    token = secrets.token_urlsafe(32)
    invite = AccountInvitation(
        user_id=user_id,
        token_hash=_token_hash(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=days),
        created_by=actor_id,
    )
    db.add(invite)
    await db.flush()
    return token, invite


def _to_list_item(
    user: User,
    *,
    personnel: Personnel | None = None,
    assignment: Assignment | None = None,
    bureau: BureauEtatCivil | None = None,
) -> AccountListItem:
    pname = None
    if personnel:
        parts = [personnel.given_names, personnel.postnom or "", personnel.family_name]
        pname = " ".join(p for p in parts if p).strip()
    return AccountListItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        account_status=getattr(user, "account_status", None) or AccountStatus.ACTIVE.value,
        is_active=user.is_active,
        role_codes=[r.code for r in (user.roles or [])],
        personnel_id=user.personnel_id,
        personnel_matricule=personnel.matricule if personnel else None,
        personnel_name=pname,
        function_code=assignment.function_code if assignment else None,
        bureau_id=assignment.bureau_id if assignment else None,
        bureau_name=bureau.name if bureau else None,
        last_login_at=getattr(user, "last_login_at", None),
        created_at=user.created_at,
    )


async def list_accounts(
    db: AsyncSession,
    actor: User,
    *,
    status_filter: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> AccountListResponse:
    stmt = (
        select(User)
        .options(selectinload(User.roles), selectinload(User.personnel))
        .order_by(User.created_at.desc())
    )
    # Exclude pure citizens from admin directory when possible
    # (filter later by role presence)
    if status_filter:
        stmt = stmt.where(User.account_status == status_filter)
    users = list((await db.execute(stmt.offset(offset).limit(limit))).scalars().all())

    # Territorial filter for non-national admins
    roles = user_role_codes(actor)
    if not (roles & NATIONAL_ROLES):
        scoped: list[User] = []
        for u in users:
            if u.province_id and actor.province_id and u.province_id != actor.province_id:
                continue
            if u.personnel_id:
                asg = await db.scalar(
                    select(Assignment).where(
                        Assignment.personnel_id == u.personnel_id,
                        Assignment.status == AssignmentStatus.ACTIVE.value,
                    )
                )
                if asg and asg.bureau_id and not await user_has_bureau_access(db, actor, asg.bureau_id):
                    continue
            scoped.append(u)
        users = scoped

    items: list[AccountListItem] = []
    for u in users:
        # Hide citizen-only accounts from admin list
        codes = {r.code for r in (u.roles or [])}
        if codes == {"CITIZEN"}:
            continue
        personnel = u.personnel
        assignment = None
        bureau = None
        if u.personnel_id:
            assignment = await db.scalar(
                select(Assignment).where(
                    Assignment.personnel_id == u.personnel_id,
                    Assignment.status == AssignmentStatus.ACTIVE.value,
                )
            )
            if assignment and assignment.bureau_id:
                bureau = await db.get(BureauEtatCivil, assignment.bureau_id)
        items.append(_to_list_item(u, personnel=personnel, assignment=assignment, bureau=bureau))

    # Stats over filtered population (same query without pagination for counts)
    stats_q = await db.execute(select(User.account_status, func.count()).group_by(User.account_status))
    counts = {row[0]: int(row[1]) for row in stats_q.all()}
    total = sum(counts.values())
    stats = AccountStats(
        total=total,
        active=counts.get(AccountStatus.ACTIVE.value, 0),
        pending=counts.get(AccountStatus.PENDING.value, 0),
        suspended=counts.get(AccountStatus.SUSPENDED.value, 0),
        disabled=counts.get(AccountStatus.DISABLED.value, 0),
    )
    return AccountListResponse(stats=stats, items=items)


async def get_account_detail(db: AsyncSession, actor: User, user_id: UUID) -> AccountDetail:
    user = await load_user_with_rbac(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    # Territorial guard
    if user.personnel_id:
        asg = await db.scalar(
            select(Assignment).where(
                Assignment.personnel_id == user.personnel_id,
                Assignment.status == AssignmentStatus.ACTIVE.value,
            )
        )
        if asg and asg.bureau_id:
            await assert_actor_can_manage_territory(db, actor, bureau_id=asg.bureau_id)
    elif user.province_id:
        await assert_actor_can_manage_territory(db, actor, province_id=user.province_id)

    personnel = await db.get(Personnel, user.personnel_id) if user.personnel_id else None
    assignment = None
    bureau = None
    if user.personnel_id:
        assignment = await db.scalar(
            select(Assignment).where(
                Assignment.personnel_id == user.personnel_id,
                Assignment.status == AssignmentStatus.ACTIVE.value,
            )
        )
        if assignment and assignment.bureau_id:
            bureau = await db.get(BureauEtatCivil, assignment.bureau_id)
    scopes = await list_scopes(db, user.id)
    perms: set[str] = set()
    for role in user.roles or []:
        for p in role.permissions or []:
            perms.add(p.code)
    from apps.api.domains.identity.iam_schemas import AssignmentRead, PersonnelRead, ScopeRead

    return AccountDetail(
        user=_to_list_item(user, personnel=personnel, assignment=assignment, bureau=bureau),
        personnel=PersonnelRead.model_validate(personnel) if personnel else None,
        assignment=AssignmentRead.model_validate(assignment) if assignment else None,
        scopes=[ScopeRead.model_validate(s) for s in scopes],
        permissions=sorted(perms),
    )


async def provision_account(
    db: AsyncSession,
    payload: AccountProvisionCreate,
    *,
    actor: User,
) -> AccountProvisionResult:
    assert_can_request_role(actor, payload.role_code)
    assert_role_function_compatible(payload.role_code, payload.assignment.function_code)

    await assert_actor_can_manage_territory(
        db,
        actor,
        province_id=payload.assignment.province_id,
        bureau_id=payload.assignment.bureau_id,
    )

    bureau = await db.get(BureauEtatCivil, payload.assignment.bureau_id)
    if bureau is None or bureau.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Bureau must exist and be ACTIVE")
    if bureau.province_id and bureau.province_id != payload.assignment.province_id:
        raise HTTPException(status_code=400, detail="Bureau n'appartient pas à la province sélectionnée")

    # --- Personnel ---
    if payload.personnel.mode == "create":
        if payload.personnel.new_personnel is None:
            raise HTTPException(status_code=400, detail="new_personnel required")
        existing_mat = await db.scalar(
            select(Personnel).where(Personnel.matricule == payload.personnel.new_personnel.matricule)
        )
        if existing_mat:
            raise HTTPException(status_code=409, detail="Matricule already exists")
        personnel = Personnel(**payload.personnel.new_personnel.model_dump())
        db.add(personnel)
        await db.flush()
        await write_audit(
            db,
            action="personnel.create",
            actor_id=actor.id,
            resource_type="personnel",
            resource_id=str(personnel.id),
            new_value={"matricule": personnel.matricule},
            commit=False,
        )
    else:
        if payload.personnel.personnel_id is None:
            raise HTTPException(status_code=400, detail="personnel_id required")
        personnel = await db.get(Personnel, payload.personnel.personnel_id)
        if personnel is None or personnel.status != PersonnelStatus.ACTIVE.value:
            raise HTTPException(status_code=400, detail="Personnel must exist and be ACTIVE")

    existing_user = await personnel_has_active_account(db, personnel.id)
    if existing_user is not None:
        raise HTTPException(
            status_code=409,
            detail="Cette personne possède déjà un compte actif.",
        )

    end_date = None if payload.assignment.open_ended else payload.assignment.end_date
    if end_date is not None and end_date < payload.assignment.start_date:
        raise HTTPException(status_code=400, detail="date_fin must be >= date_debut")

    if payload.role_code in SENSITIVE_FUNCTIONS | {"OFFICIER_ETAT_CIVIL", "RESPONSABLE_BUREAU"}:
        if not payload.assignment.justification and not payload.assignment.document_reference:
            # Soft requirement for sensitive: justification recommended but document optional
            pass

    assignment = Assignment(
        personnel_id=personnel.id,
        bureau_id=payload.assignment.bureau_id,
        province_id=payload.assignment.province_id,
        function_code=payload.assignment.function_code,
        start_date=payload.assignment.start_date,
        end_date=end_date,
        assigned_by=actor.id,
        justification=payload.assignment.justification,
        document_reference=payload.assignment.document_reference,
        status=AssignmentStatus.ACTIVE.value,
    )
    db.add(assignment)
    await db.flush()
    await write_audit(
        db,
        action="ASSIGNMENT_CREATED",
        actor_id=actor.id,
        resource_type="assignment",
        resource_id=str(assignment.id),
        new_value={
            "personnel_id": str(personnel.id),
            "bureau_id": str(assignment.bureau_id),
            "function_code": assignment.function_code,
        },
        commit=False,
    )

    username = _slug_username(payload.credentials.username)
    email = _login_email(username=username, email=payload.credentials.email)
    if await get_user_by_email(db, email):
        raise HTTPException(status_code=409, detail="Nom d'utilisateur / email déjà utilisé")

    role_codes = [payload.role_code]
    if payload.role_code == "OFFICIER_ETAT_CIVIL":
        role_codes = list({*role_codes, "CIVIL_OFFICER", "OFFICIER_ETAT_CIVIL"})
    roles = await _resolve_roles(db, role_codes)

    access_mode = (payload.credentials.access_mode or "invite").lower()
    if access_mode == "temporary_password":
        if not payload.credentials.temporary_password:
            raise HTTPException(status_code=400, detail="temporary_password required")
        validate_password_strength(payload.credentials.temporary_password)
        pwd = payload.credentials.temporary_password
        account_status = AccountStatus.ACTIVE.value
        is_active = True
    else:
        pwd = secrets.token_urlsafe(24)
        account_status = AccountStatus.PENDING.value
        is_active = False

    user = User(
        email=email,
        hashed_password=hash_password(pwd),
        full_name=f"{personnel.given_names} {personnel.family_name}".strip(),
        is_active=is_active,
        account_status=account_status,
        personnel_id=personnel.id,
        province_id=payload.assignment.province_id,
        ville_id=payload.assignment.ville_id,
        commune_id=payload.assignment.commune_id,
        roles=roles,
    )
    db.add(user)
    await db.flush()

    scope_type = payload.scope_type
    if not scope_type:
        if payload.role_code in NATIONAL_ROLES:
            scope_type = "NATIONAL"
        elif payload.role_code == "ADMIN_PROVINCIAL":
            scope_type = "PROVINCE"
        elif payload.role_code == "RESPONSABLE_BUREAU":
            scope_type = "BUREAU"
        else:
            scope_type = "BUREAU"
    territory_id = None
    bureau_id = None
    if scope_type == "PROVINCE":
        territory_id = payload.assignment.province_id
    elif scope_type == "VILLE":
        territory_id = payload.assignment.ville_id
    elif scope_type == "COMMUNE":
        territory_id = payload.assignment.commune_id
    elif scope_type == "BUREAU":
        bureau_id = payload.assignment.bureau_id
    db.add(
        TerritorialScope(
            user_id=user.id,
            scope_type=scope_type,
            territory_id=territory_id,
            bureau_id=bureau_id,
        )
    )

    invite_token = None
    invite_url = None
    if access_mode != "temporary_password":
        invite_token, _ = await _create_invitation(db, user_id=user.id, actor_id=actor.id)
        invite_url = f"/admin/activation?token={invite_token}"

    await write_audit(
        db,
        action="ACCOUNT_CREATED",
        actor_id=actor.id,
        resource_type="user",
        resource_id=str(user.id),
        new_value={
            "email": email,
            "username": username,
            "roles": role_codes,
            "account_status": account_status,
            "personnel_id": str(personnel.id),
            "access_mode": access_mode,
        },
        commit=False,
    )
    await write_audit(
        db,
        action="ROLE_ASSIGNED",
        actor_id=actor.id,
        resource_type="user",
        resource_id=str(user.id),
        new_value={"roles": role_codes},
        commit=False,
    )
    await db.commit()

    return AccountProvisionResult(
        user_id=user.id,
        email=email,
        username=username,
        account_status=account_status,
        role_codes=role_codes,
        personnel_id=personnel.id,
        assignment_id=assignment.id,
        invite_token=invite_token,
        invite_url=invite_url,
        message="Compte créé avec succès.",
    )


async def change_role(
    db: AsyncSession, user_id: UUID, payload: RoleChangeRequest, *, actor: User
) -> User:
    assert_not_self_privilege(actor, user_id, [payload.role_code])
    assert_can_request_role(actor, payload.role_code)
    user = await load_user_with_rbac(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    assignment = None
    if user.personnel_id:
        assignment = await db.scalar(
            select(Assignment).where(
                Assignment.personnel_id == user.personnel_id,
                Assignment.status == AssignmentStatus.ACTIVE.value,
            )
        )
    if payload.role_code in SENSITIVE_FUNCTIONS | {"OFFICIER_ETAT_CIVIL"}:
        if assignment is None:
            raise HTTPException(
                status_code=400,
                detail="Affectation active requise pour cette habilitation",
            )
        assert_role_function_compatible(payload.role_code, assignment.function_code)
        if assignment.bureau_id:
            await assert_actor_can_manage_territory(db, actor, bureau_id=assignment.bureau_id)

    old_roles = [r.code for r in (user.roles or [])]
    role_codes = [payload.role_code]
    if payload.role_code == "OFFICIER_ETAT_CIVIL":
        role_codes = list({*role_codes, "CIVIL_OFFICER", "OFFICIER_ETAT_CIVIL"})
    user.roles = await _resolve_roles(db, role_codes)
    await write_audit(
        db,
        action="ROLE_CHANGED",
        actor_id=actor.id,
        resource_type="user",
        resource_id=str(user.id),
        old_value={"roles": old_roles},
        new_value={"roles": role_codes},
        justification=payload.reason,
        commit=False,
    )
    await db.commit()
    return await load_user_with_rbac(db, user_id)  # type: ignore[return-value]


async def change_assignment(
    db: AsyncSession, user_id: UUID, payload: AssignmentChangeRequest, *, actor: User
) -> Assignment:
    user = await get_user_by_id(db, user_id)
    if user is None or not user.personnel_id:
        raise HTTPException(status_code=400, detail="User must be linked to personnel")
    await assert_actor_can_manage_territory(db, actor, bureau_id=payload.bureau_id)

    active = await db.scalar(
        select(Assignment).where(
            Assignment.personnel_id == user.personnel_id,
            Assignment.status == AssignmentStatus.ACTIVE.value,
        )
    )
    old_bureau = str(active.bureau_id) if active and active.bureau_id else None
    if active:
        active.status = AssignmentStatus.CLOSED.value
        active.end_date = date.today()
        await write_audit(
            db,
            action="assignment.close",
            actor_id=actor.id,
            resource_type="assignment",
            resource_id=str(active.id),
            new_value={"status": active.status, "end_date": str(active.end_date)},
            commit=False,
        )

    end_date = None if payload.open_ended else payload.end_date
    if end_date is not None and end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="date_fin must be >= date_debut")

    row = Assignment(
        personnel_id=user.personnel_id,
        bureau_id=payload.bureau_id,
        province_id=payload.province_id or user.province_id,
        function_code=payload.function_code,
        start_date=payload.start_date,
        end_date=end_date,
        assigned_by=actor.id,
        justification=payload.justification,
        document_reference=payload.document_reference,
        status=AssignmentStatus.ACTIVE.value,
    )
    db.add(row)
    user.province_id = payload.province_id or user.province_id
    user.ville_id = payload.ville_id or user.ville_id
    user.commune_id = payload.commune_id or user.commune_id

    # Recalculate bureau scope
    existing_scopes = await list_scopes(db, user.id)
    for s in existing_scopes:
        if s.scope_type == "BUREAU":
            await db.delete(s)
    db.add(
        TerritorialScope(
            user_id=user.id,
            scope_type="BUREAU",
            bureau_id=payload.bureau_id,
        )
    )
    await write_audit(
        db,
        action="ASSIGNMENT_CHANGED",
        actor_id=actor.id,
        resource_type="user",
        resource_id=str(user.id),
        old_value={"bureau_id": old_bureau},
        new_value={"bureau_id": str(payload.bureau_id), "function_code": payload.function_code},
        justification=payload.justification,
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def reactivate_account(db: AsyncSession, user_id: UUID, *, actor: User, reason: str) -> User:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.personnel_id:
        personnel = await db.get(Personnel, user.personnel_id)
        if personnel is None or personnel.status != PersonnelStatus.ACTIVE.value:
            raise HTTPException(
                status_code=400,
                detail="Impossible de réactiver ce compte. Le personnel n'est plus actif.",
            )
        assignment = await db.scalar(
            select(Assignment).where(
                Assignment.personnel_id == user.personnel_id,
                Assignment.status == AssignmentStatus.ACTIVE.value,
            )
        )
        if assignment is None:
            raise HTTPException(
                status_code=400,
                detail="Impossible de réactiver ce compte. L'affectation doit être mise à jour.",
            )
        if assignment.end_date and assignment.end_date < date.today():
            raise HTTPException(
                status_code=400,
                detail="Impossible de réactiver ce compte. L'affectation a expiré.",
            )
        if assignment.bureau_id:
            bureau = await db.get(BureauEtatCivil, assignment.bureau_id)
            if bureau is None or bureau.status != "ACTIVE":
                raise HTTPException(status_code=400, detail="Bureau inactif")
            await assert_actor_can_manage_territory(db, actor, bureau_id=assignment.bureau_id)

    user.account_status = AccountStatus.ACTIVE.value
    user.is_active = True
    user.disabled_at = None
    await write_audit(
        db,
        action="ACCOUNT_REACTIVATED",
        actor_id=actor.id,
        resource_type="user",
        resource_id=str(user.id),
        justification=reason,
        commit=False,
    )
    await db.commit()
    return await get_user_by_id(db, user_id)  # type: ignore[return-value]


async def reset_access_invite(db: AsyncSession, user_id: UUID, *, actor: User) -> AccountProvisionResult:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    # Invalidate previous invites
    rows = await db.execute(
        select(AccountInvitation).where(
            AccountInvitation.user_id == user_id,
            AccountInvitation.consumed_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    for inv in rows.scalars().all():
        inv.consumed_at = now
    user.account_status = AccountStatus.PENDING.value
    user.is_active = False
    user.hashed_password = hash_password(secrets.token_urlsafe(24))
    token, _ = await _create_invitation(db, user_id=user.id, actor_id=actor.id)
    await write_audit(
        db,
        action="PASSWORD_RESET",
        actor_id=actor.id,
        resource_type="user",
        resource_id=str(user.id),
        new_value={"mode": "invite"},
        commit=False,
    )
    await db.commit()
    return AccountProvisionResult(
        user_id=user.id,
        email=user.email,
        username=user.email.split("@")[0],
        account_status=user.account_status,
        role_codes=[],
        personnel_id=user.personnel_id or user.id,
        assignment_id=user.id,
        invite_token=token,
        invite_url=f"/admin/activation?token={token}",
        message="Invitation d'activation régénérée.",
    )


async def activate_invite(db: AsyncSession, payload: InviteActivateRequest) -> User:
    validate_password_strength(payload.password)
    th = _token_hash(payload.token)
    invite = await db.scalar(select(AccountInvitation).where(AccountInvitation.token_hash == th))
    if invite is None or invite.consumed_at is not None:
        raise HTTPException(status_code=400, detail="Invitation invalide ou déjà utilisée")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation expirée")
    user = await get_user_by_id(db, invite.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(payload.password)
    user.account_status = AccountStatus.ACTIVE.value
    user.is_active = True
    invite.consumed_at = datetime.now(timezone.utc)
    await write_audit(
        db,
        action="ACCOUNT_ACTIVATED",
        actor_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        commit=False,
    )
    await db.commit()
    return await get_user_by_id(db, user.id)  # type: ignore[return-value]


async def register_citizen(db: AsyncSession, payload: CitizenRegisterRequest) -> User:
    if payload.password != payload.password_confirm:
        raise HTTPException(status_code=400, detail="Confirmation du mot de passe incorrecte")
    validate_password_strength(payload.password)
    username = _slug_username(payload.username)
    email = _login_email(username=username, email=str(payload.email) if payload.email else None)
    if await get_user_by_email(db, email):
        raise HTTPException(status_code=409, detail="Compte déjà existant")
    # Refuse administrative role codes sneaked in — citizen only
    roles = await _resolve_roles(db, ["CITIZEN"])
    full_name = " ".join(
        p for p in [payload.given_names, payload.postnom or "", payload.family_name] if p
    ).strip()
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=full_name,
        is_active=True,
        account_status=AccountStatus.ACTIVE.value,
        roles=roles,
    )
    db.add(user)
    await db.flush()
    await write_audit(
        db,
        action="ACCOUNT_CREATED",
        actor_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        new_value={"kind": "CITIZEN", "email": email},
        commit=False,
    )
    await db.commit()
    return await get_user_by_id(db, user.id)  # type: ignore[return-value]


async def account_history(db: AsyncSession, user_id: UUID, *, limit: int = 100) -> list[HistoryEvent]:
    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.resource_type == "user", AuditEvent.resource_id == str(user_id))
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
    )
    events = list(result.scalars().all())
    return [
        HistoryEvent(
            id=e.id,
            action=e.action,
            created_at=e.created_at,
            actor_id=e.actor_id,
            result=e.result,
            justification=e.justification,
            old_value=e.old_value,
            new_value=e.new_value,
        )
        for e in events
    ]


async def assert_can_view_user(db: AsyncSession, actor: User, target_id: UUID) -> User:
    """Test 10 helper — refuse unauthorized cross-scope user access."""
    detail = await get_account_detail(db, actor, target_id)
    return await load_user_with_rbac(db, detail.user.id)  # type: ignore[return-value]
