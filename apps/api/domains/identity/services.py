"""Business logic for identity — users, institutions, RBAC."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
    generate_mfa_secret,
    get_mfa_provisioning_uri,
    hash_password,
    validate_password_strength,
    verify_mfa_code,
    verify_password,
)
from apps.api.domains.identity.models import Institution, Permission, Role, User
from apps.api.domains.identity.refresh_store import (
    issue_token_pair,
    revoke_refresh_token,
    rotate_refresh_token,
)
from apps.api.domains.identity.schemas import (
    InstitutionCreate,
    InstitutionUpdate,
    MFASetupResponse,
    TokenPair,
    UserLogin,
    UserMe,
    UserRegister,
    UserUpdate,
)
from apps.api.core.redis_client import (
    clear_login_failures,
    is_login_locked,
    record_login_failure,
)


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.email == email.lower())
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    return result.scalar_one_or_none()


def user_to_me(user: User) -> UserMe:
    roles = [r.code for r in user.roles]
    permissions: set[str] = set()
    for role in user.roles:
        for perm in role.permissions:
            permissions.add(perm.code)
    return UserMe(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        mfa_enabled=user.mfa_enabled,
        institution_id=user.institution_id,
        province_id=user.province_id,
        ville_id=user.ville_id,
        commune_id=user.commune_id,
        roles=roles,
        permissions=sorted(permissions),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def _resolve_roles(db: AsyncSession, role_codes: list[str]) -> list[Role]:
    if not role_codes:
        return []
    result = await db.execute(select(Role).where(Role.code.in_(role_codes)))
    roles = list(result.scalars().all())
    found = {r.code for r in roles}
    missing = [c for c in role_codes if c not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role codes: {', '.join(missing)}",
        )
    return roles


async def _validate_user_geo(
    db: AsyncSession,
    *,
    province_id: UUID | None,
    ville_id: UUID | None,
    commune_id: UUID | None,
) -> tuple[UUID | None, UUID | None, UUID | None]:
    if province_id is None and ville_id is None and commune_id is None:
        return None, None, None
    from apps.api.domains.geography.models import Commune, Province, Ville

    if province_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="province_id est requis pour rattacher un compte à un territoire",
        )
    province = await db.get(Province, province_id)
    if province is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Province introuvable",
        )
    if ville_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ville_id est requis (affectation type élections : province → ville)",
        )
    ville = await db.get(Ville, ville_id)
    if ville is None or ville.province_id != province_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La ville doit appartenir à la province sélectionnée",
        )
    if commune_id is not None:
        commune = await db.get(Commune, commune_id)
        if commune is None or commune.ville_id != ville_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La commune doit appartenir à la ville sélectionnée",
            )
    return province_id, ville_id, commune_id


async def register_user(db: AsyncSession, payload: UserRegister) -> User:
    validate_password_strength(payload.password)

    existing = await get_user_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    if payload.institution_id is not None:
        inst = await db.get(Institution, payload.institution_id)
        if inst is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Institution not found",
            )

    province_id, ville_id, commune_id = await _validate_user_geo(
        db,
        province_id=payload.province_id,
        ville_id=payload.ville_id,
        commune_id=payload.commune_id,
    )

    roles = await _resolve_roles(db, payload.role_codes)
    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        institution_id=payload.institution_id,
        province_id=province_id,
        ville_id=ville_id,
        commune_id=commune_id,
        roles=roles,
        account_status="ACTIVE",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    loaded = await get_user_by_id(db, user.id)
    assert loaded is not None
    return loaded


async def update_user(db: AsyncSession, user_id: UUID, payload: UserUpdate) -> User:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.model_dump(exclude_unset=True)

    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()

    if "password" in data and data["password"]:
        validate_password_strength(data["password"])
        user.hashed_password = hash_password(data["password"])

    if "institution_id" in data:
        institution_id = data["institution_id"]
        if institution_id is not None:
            inst = await db.get(Institution, institution_id)
            if inst is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Institution not found",
                )
        user.institution_id = institution_id

    if "is_active" in data and data["is_active"] is not None:
        user.is_active = bool(data["is_active"])

    geo_touched = any(k in data for k in ("province_id", "ville_id", "commune_id"))
    if geo_touched:
        province_id = data["province_id"] if "province_id" in data else user.province_id
        ville_id = data["ville_id"] if "ville_id" in data else user.ville_id
        commune_id = data["commune_id"] if "commune_id" in data else user.commune_id
        province_id, ville_id, commune_id = await _validate_user_geo(
            db,
            province_id=province_id,
            ville_id=ville_id,
            commune_id=commune_id,
        )
        user.province_id = province_id
        user.ville_id = ville_id
        user.commune_id = commune_id

    if "role_codes" in data and data["role_codes"] is not None:
        user.roles = await _resolve_roles(db, data["role_codes"])

    await db.commit()
    loaded = await get_user_by_id(db, user_id)
    assert loaded is not None
    return loaded


async def authenticate_user(
    db: AsyncSession,
    payload: UserLogin,
    *,
    lock_key: str | None = None,
) -> TokenPair:
    key = lock_key or payload.email.lower()
    if await is_login_locked(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked after failed attempts",
        )

    user = await get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        await record_login_failure(key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active or getattr(user, "account_status", "ACTIVE") in {
        "SUSPENDED",
        "DISABLED",
        "EXPIRED",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    if user.mfa_enabled:
        if not payload.mfa_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="MFA code required",
            )
        if not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MFA misconfigured for user",
            )
        secret = decrypt_mfa_secret(user.mfa_secret)
        if not verify_mfa_code(secret, payload.mfa_code):
            await record_login_failure(key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA code",
            )

    await clear_login_failures(key)
    return await issue_token_pair(db, user)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenPair:
    return await rotate_refresh_token(db, refresh_token)


async def logout_user(db: AsyncSession, refresh_token: str) -> None:
    await revoke_refresh_token(db, refresh_token)


async def setup_mfa(db: AsyncSession, user: User) -> MFASetupResponse:
    secret = generate_mfa_secret()
    user.mfa_secret = encrypt_mfa_secret(secret)
    # Enabled only after successful verify.
    user.mfa_enabled = False
    await db.commit()
    await db.refresh(user)
    return MFASetupResponse(
        secret=secret,
        provisioning_uri=get_mfa_provisioning_uri(secret, user.email),
        mfa_enabled=user.mfa_enabled,
    )


async def verify_and_enable_mfa(db: AsyncSession, user: User, code: str) -> User:
    if not user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup not started; call /mfa/setup first",
        )
    secret = decrypt_mfa_secret(user.mfa_secret)
    if not verify_mfa_code(secret, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code",
        )
    user.mfa_enabled = True
    await db.commit()
    loaded = await get_user_by_id(db, user.id)
    assert loaded is not None
    return loaded


# --- Institutions -----------------------------------------------------------


async def create_institution(db: AsyncSession, payload: InstitutionCreate) -> Institution:
    existing = await db.scalar(select(Institution).where(Institution.code == payload.code))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Institution code already exists",
        )
    inst = Institution(
        code=payload.code,
        name=payload.name,
        type=payload.type,
        status=payload.status,
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


async def list_institutions(db: AsyncSession) -> list[Institution]:
    result = await db.execute(select(Institution).order_by(Institution.code))
    return list(result.scalars().all())


async def get_institution(db: AsyncSession, institution_id: UUID) -> Institution:
    inst = await db.get(Institution, institution_id)
    if inst is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")
    return inst


async def update_institution(
    db: AsyncSession,
    institution_id: UUID,
    payload: InstitutionUpdate,
) -> Institution:
    inst = await get_institution(db, institution_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(inst, key, value)
    await db.commit()
    await db.refresh(inst)
    return inst


async def delete_institution(db: AsyncSession, institution_id: UUID) -> None:
    inst = await get_institution(db, institution_id)
    await db.delete(inst)
    await db.commit()


# --- RBAC -------------------------------------------------------------------


async def list_users(db: AsyncSession, *, limit: int = 100, offset: int = 0) -> list[User]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def set_user_active(db: AsyncSession, user_id: UUID, is_active: bool) -> User:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return await get_user_by_id(db, user_id)  # type: ignore[return-value]


async def list_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(select(Role).order_by(Role.code))
    return list(result.scalars().all())


async def list_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(select(Permission).order_by(Permission.code))
    return list(result.scalars().all())


async def assign_roles_to_user(
    db: AsyncSession,
    user_id: UUID,
    role_codes: list[str],
) -> User:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    roles = await _resolve_roles(db, role_codes)
    user.roles = roles
    await db.commit()
    loaded = await get_user_by_id(db, user_id)
    assert loaded is not None
    return loaded
