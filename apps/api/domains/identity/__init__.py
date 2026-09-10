"""Identity domain package."""

from apps.api.domains.identity.models import (
    AccountRequest,
    Assignment,
    BureauEtatCivil,
    Institution,
    Permission,
    Personnel,
    Role,
    TerritorialScope,
    User,
    role_permissions,
    user_roles,
)

__all__ = [
    "AccountRequest",
    "Assignment",
    "BureauEtatCivil",
    "Institution",
    "Permission",
    "Personnel",
    "Role",
    "TerritorialScope",
    "User",
    "role_permissions",
    "user_roles",
]
