"""Permission gating: JWT preferred; X-* headers only when ALLOW_DEV_AUTH_HEADERS=true."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import get_settings
from apps.api.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)

# Core Registry
PERM_CITIZEN_CREATE = "registry:citizen:create"
PERM_CITIZEN_READ = "registry:citizen:read"
PERM_CITIZEN_VALIDATE = "registry:citizen:validate"
PERM_CITIZEN_MERGE = "registry:citizen:merge"
PERM_CITIZEN_VALIDATE_OVERRIDE = "registry:citizen:validate_override"
PERM_TOKEN_MANAGE = "registry:token:manage"

# État civil
PERM_CIVIL_READ = "civil:act:read"
PERM_CIVIL_WRITE = "civil:act:write"
PERM_CIVIL_VALIDATE = "civil:act:validate"
PERM_CIVIL_STATS = "civil:stats:read"
PERM_CIVIL_DECLARE = "civil:declaration:create"

# Cards / documents
PERM_CARD_ISSUE = "cards:issue"
PERM_CARD_MANAGE = "cards:manage"
PERM_CARD_VERIFY = "cards:verify"
PERM_DOC_READ = "documents:read"
PERM_DOC_WRITE = "documents:write"

# Census / biometric / health / analytics
PERM_CENSUS_SYNC = "census:sync"
PERM_CENSUS_MANAGE = "census:manage"
PERM_BIOMETRIC_ENROLL = "biometric:enroll"
PERM_BIOMETRIC_MATCH = "biometric:match"
PERM_BIOMETRIC_REVIEW = "biometric:review"
PERM_HEALTH_DECLARE = "health:declare"
PERM_HEALTH_READ = "health:read"
PERM_ONIP_DASHBOARD = "onip:dashboard"
PERM_ANALYTICS_READ = "analytics:read"
PERM_IDENTITY_VERIFY = "identity:verify"

# Institutional IAM (personnel / bureaux / scopes)
PERM_PERSONNEL_READ = "personnel:read"
PERM_PERSONNEL_MANAGE = "personnel:manage"
PERM_ASSIGNMENT_READ = "assignment:read"
PERM_ASSIGNMENT_MANAGE = "assignment:manage"
PERM_BUREAU_READ = "bureau:read"
PERM_BUREAU_MANAGE = "bureau:manage"
PERM_ACCOUNT_REQUEST_CREATE = "account_request:create"
PERM_ACCOUNT_REQUEST_MANAGE = "account_request:manage"
PERM_CIVIL_AUTHENTICATE = "civil:act:authenticate"

ALL_DOMAIN_PERMISSIONS: tuple[str, ...] = (
    PERM_CITIZEN_CREATE,
    PERM_CITIZEN_READ,
    PERM_CITIZEN_VALIDATE,
    PERM_CITIZEN_MERGE,
    PERM_CITIZEN_VALIDATE_OVERRIDE,
    PERM_TOKEN_MANAGE,
    PERM_CIVIL_READ,
    PERM_CIVIL_WRITE,
    PERM_CIVIL_VALIDATE,
    PERM_CIVIL_STATS,
    PERM_CIVIL_DECLARE,
    PERM_CIVIL_AUTHENTICATE,
    PERM_CARD_ISSUE,
    PERM_CARD_MANAGE,
    PERM_CARD_VERIFY,
    PERM_DOC_READ,
    PERM_DOC_WRITE,
    PERM_CENSUS_SYNC,
    PERM_CENSUS_MANAGE,
    PERM_BIOMETRIC_ENROLL,
    PERM_BIOMETRIC_MATCH,
    PERM_BIOMETRIC_REVIEW,
    PERM_HEALTH_DECLARE,
    PERM_HEALTH_READ,
    PERM_ONIP_DASHBOARD,
    PERM_ANALYTICS_READ,
    PERM_IDENTITY_VERIFY,
    PERM_PERSONNEL_READ,
    PERM_PERSONNEL_MANAGE,
    PERM_ASSIGNMENT_READ,
    PERM_ASSIGNMENT_MANAGE,
    PERM_BUREAU_READ,
    PERM_BUREAU_MANAGE,
    PERM_ACCOUNT_REQUEST_CREATE,
    PERM_ACCOUNT_REQUEST_MANAGE,
)


@dataclass(frozen=True, slots=True)
class Principal:
    actor_id: UUID | None = None
    permissions: frozenset[str] = field(default_factory=frozenset)
    institution_id: UUID | None = None


async def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    x_actor_id: str | None = Header(default=None, alias="X-Actor-Id"),
    x_permissions: str | None = Header(default=None, alias="X-Permissions"),
) -> Principal:
    """Resolve principal from Bearer JWT, else optional dev headers."""
    settings = get_settings()

    if credentials and credentials.scheme.lower() == "bearer":
        from apps.api.core.security import decode_token
        from apps.api.domains.identity.services import get_user_by_id, user_to_me

        payload = decode_token(credentials.credentials, expected_type="access")
        user_id = UUID(str(payload["sub"]))
        user = await get_user_by_id(db, user_id)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User inactive or not found",
            )
        account_status = getattr(user, "account_status", "ACTIVE") or "ACTIVE"
        if account_status in {"SUSPENDED", "DISABLED", "EXPIRED"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User inactive or not found",
            )
        me = user_to_me(user)
        return Principal(
            actor_id=me.id,
            permissions=frozenset(me.permissions),
            institution_id=me.institution_id,
        )

    if settings.dev_header_auth_enabled:
        actor_id: UUID | None = None
        if x_actor_id:
            try:
                actor_id = UUID(x_actor_id)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid X-Actor-Id; expected UUID",
                ) from exc
        perms: set[str] = set()
        if x_permissions:
            perms = {p.strip() for p in x_permissions.split(",") if p.strip()}
        return Principal(actor_id=actor_id, permissions=frozenset(perms))

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_permissions(*required: str):
    """Require all listed permission codes on the resolved principal."""

    async def _checker(
        principal: Principal = Depends(get_current_principal),
    ) -> Principal:
        missing = [code for code in required if code not in principal.permissions]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Missing required permissions",
                    "missing": missing,
                },
            )
        return principal

    return _checker
