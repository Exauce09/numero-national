"""Seed data for identity roles and full domain permissions."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.core.permissions import ALL_DOMAIN_PERMISSIONS
from apps.api.domains.identity.models import Permission, Role

SEED_ROLES: list[dict[str, str]] = [
    {"code": "CENTRAL_ADMIN", "name": "Administrateur central", "description": "Administration complète"},
    {"code": "CENSUS_AGENT", "name": "Agent de recensement", "description": "Recensement terrain"},
    {"code": "CENSUS_SUPERVISOR", "name": "Superviseur recensement", "description": "Validation fiches terrain"},
    {"code": "CIVIL_OFFICER", "name": "Officier d'état civil", "description": "Actes d'état civil"},
    {"code": "HEALTH_AGENT", "name": "Agent de santé", "description": "Déclarations sanitaires"},
    {"code": "MINISTRY_HEALTH", "name": "Ministère de la Santé", "description": "Statistiques santé nationales anonymisées"},
    {"code": "MINISTRY_STATS", "name": "Statistiques ministérielles", "description": "Stats ministère"},
    {"code": "INTERIOR_VIEW", "name": "Ministère de l'Intérieur", "description": "Supervision état civil, sécurité, cartes"},
    {"code": "ONIP_OPS", "name": "Opérations ONIP", "description": "Supervision identité"},
    {"code": "PRESIDENCY_VIEW", "name": "Vue Présidence", "description": "Tableaux stratégiques"},
    {"code": "PRIMATURE_VIEW", "name": "Vue Primature", "description": "Coordination gouvernementale"},
    {"code": "ORGANIZATION_STATISTICS", "name": "Statistiques organisations", "description": "Stats agrégées"},
    {"code": "RELYING_PARTY", "name": "Relying party", "description": "Vérification d'identité"},
    {"code": "CITIZEN", "name": "Citoyen", "description": "Self-service citoyen"},
]

IAM_PERMISSIONS: list[dict[str, str]] = [
    {"code": "users:manage", "name": "Gérer les utilisateurs", "resource": "users", "action": "manage"},
    {"code": "institutions:manage", "name": "Gérer les institutions", "resource": "institutions", "action": "manage"},
    {"code": "roles:manage", "name": "Gérer les rôles", "resource": "roles", "action": "manage"},
    {"code": "permissions:read", "name": "Lire les permissions", "resource": "permissions", "action": "read"},
    {"code": "audit:read", "name": "Lire l'audit", "resource": "audit", "action": "read"},
    {"code": "interop:manage", "name": "Gérer l'interopérabilité", "resource": "interop", "action": "manage"},
]

# Role → permission codes (least privilege; CENTRAL_ADMIN gets all via grant-all).
ROLE_PERMISSION_MAP: dict[str, tuple[str, ...]] = {
    "CENSUS_AGENT": (
        "census:sync",
        "registry:citizen:create",
        "registry:citizen:read",
    ),
    "CENSUS_SUPERVISOR": (
        "census:sync",
        "census:manage",
        "registry:citizen:read",
    ),
    "CIVIL_OFFICER": (
        "civil:act:read",
        "civil:act:write",
        "civil:act:validate",
        "civil:stats:read",
        "civil:declaration:create",
        "registry:citizen:read",
        "registry:citizen:create",
        "registry:citizen:validate",
        "documents:read",
        "documents:write",
        "cards:issue",
        "cards:manage",
    ),
    "HEALTH_AGENT": (
        "health:declare",
        "health:read",
        "civil:declaration:create",
        "registry:citizen:read",
        "identity:verify",
    ),
    "MINISTRY_HEALTH": (
        "analytics:read",
        "health:read",
    ),
    "ONIP_OPS": (
        "onip:dashboard",
        "registry:citizen:read",
        "registry:citizen:validate",
        "registry:citizen:merge",
        "registry:citizen:validate_override",
        "registry:token:manage",
        "cards:manage",
        "cards:verify",
        "biometric:enroll",
        "biometric:match",
        "audit:read",
        "census:manage",
    ),
    "INTERIOR_VIEW": (
        "analytics:read",
        "onip:dashboard",
        "civil:act:read",
        "civil:stats:read",
        "registry:citizen:read",
        "cards:issue",
        "cards:manage",
        "cards:verify",
        "audit:read",
        "census:manage",
    ),
    "MINISTRY_STATS": ("analytics:read",),
    "PRESIDENCY_VIEW": ("analytics:read", "onip:dashboard"),
    "PRIMATURE_VIEW": ("analytics:read", "onip:dashboard"),
    "ORGANIZATION_STATISTICS": ("analytics:read",),
    "RELYING_PARTY": ("identity:verify", "cards:verify"),
    "CITIZEN": ("cards:verify",),
}


def _domain_permission_dicts() -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for code in ALL_DOMAIN_PERMISSIONS:
        resource, _, action = code.partition(":")
        # codes like registry:citizen:create → resource=registry, action=citizen:create
        parts = code.split(":")
        resource = parts[0]
        action = ":".join(parts[1:]) if len(parts) > 1 else "manage"
        items.append(
            {
                "code": code,
                "name": code,
                "resource": resource,
                "action": action,
            }
        )
    return items


SEED_PERMISSIONS: list[dict[str, str]] = IAM_PERMISSIONS + _domain_permission_dicts()


async def seed_roles_and_permissions(db: AsyncSession) -> None:
    """Idempotent seed of roles, permissions, and role grants."""
    perm_by_code: dict[str, Permission] = {}
    for item in SEED_PERMISSIONS:
        existing = await db.scalar(select(Permission).where(Permission.code == item["code"]))
        if existing is None:
            existing = Permission(**item)
            db.add(existing)
            await db.flush()
        perm_by_code[item["code"]] = existing

    for item in SEED_ROLES:
        role = await db.scalar(
            select(Role)
            .where(Role.code == item["code"])
            .options(selectinload(Role.permissions))
        )
        if role is None:
            role = Role(**item)
            db.add(role)
            await db.flush()
            role = await db.scalar(
                select(Role)
                .where(Role.code == item["code"])
                .options(selectinload(Role.permissions))
            )
            assert role is not None

        current = {p.code for p in role.permissions}
        if role.code == "CENTRAL_ADMIN":
            wanted = set(perm_by_code.keys())
        else:
            wanted = set(ROLE_PERMISSION_MAP.get(role.code, ()))

        for code in wanted:
            if code not in current and code in perm_by_code:
                role.permissions.append(perm_by_code[code])

    await db.commit()
