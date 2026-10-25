"""Périmètre territorial Module 1 — appliqué côté serveur (cahier §3.1 / DASH-004)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import Principal
from apps.api.domains.onip.service import DashboardFilters, normalize_dashboard_filters


# Rôles considérés nationaux (vue toutes zones si pas de province sur le compte)
_NATIONAL_ROLE_HINTS = frozenset(
    {
        "SUPER_ADMIN_NATIONAL",
        "CENTRAL_ADMIN",
        "ADMIN_NATIONAL",
        "ONIP_NATIONAL",
    }
)


@dataclass(frozen=True)
class TerritorialBound:
    province_code: str | None
    commune_code: str | None
    forced: bool
    national_view: bool


async def resolve_user_territory(
    db: AsyncSession, *, user_id: UUID | None
) -> TerritorialBound:
    """Charge province/commune codes depuis le compte (geography)."""
    if user_id is None:
        return TerritorialBound(None, None, forced=False, national_view=True)

    from apps.api.domains.geography.models import Commune, Province
    from apps.api.domains.identity.services import get_user_by_id

    user = await get_user_by_id(db, user_id)
    if user is None:
        return TerritorialBound(None, None, forced=False, national_view=True)

    role_codes = {r.code for r in (user.roles or [])}
    national_hint = bool(role_codes & _NATIONAL_ROLE_HINTS)

    province_code: str | None = None
    commune_code: str | None = None
    if user.province_id:
        prov = await db.get(Province, user.province_id)
        if prov is not None:
            province_code = (prov.code or "").strip().upper() or None
    if user.commune_id:
        com = await db.get(Commune, user.commune_id)
        if com is not None:
            commune_code = (com.code or "").strip().upper() or None

    # Compte rattaché à une province → périmètre forcé (même ONIP_OPS provincial)
    if province_code:
        return TerritorialBound(
            province_code=province_code,
            commune_code=commune_code,
            forced=True,
            national_view=False,
        )
    return TerritorialBound(
        province_code=None,
        commune_code=None,
        forced=False,
        national_view=True if national_hint or not province_code else False,
    )


def enforce_dashboard_filters(
    requested: DashboardFilters,
    bound: TerritorialBound,
) -> DashboardFilters:
    """Refuse une province/commune hors périmètre ; force sinon."""
    req_prov = requested.province_code
    req_com = requested.commune_code

    if bound.forced and bound.province_code:
        if req_prov and req_prov != bound.province_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Province hors périmètre autorisé",
                    "allowed_province": bound.province_code,
                    "requested_province": req_prov,
                },
            )
        if bound.commune_code and req_com and req_com != bound.commune_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Commune hors périmètre autorisé",
                    "allowed_commune": bound.commune_code,
                    "requested_commune": req_com,
                },
            )
        return normalize_dashboard_filters(
            period_from=requested.period_from,
            period_to=requested.period_to,
            province_code=bound.province_code,
            commune_code=bound.commune_code or req_com,
            campaign_id=requested.campaign_id,
            citizen_status=requested.citizen_status,
            card_status=requested.card_status,
        )

    return requested


async def resolve_scoped_filters(
    db: AsyncSession,
    principal: Principal,
    requested: DashboardFilters,
) -> tuple[DashboardFilters, TerritorialBound]:
    bound = await resolve_user_territory(db, user_id=principal.actor_id)
    # Si Principal porte déjà un code (JWT enrichi), prioriser si forced
    if principal.province_code and not bound.forced:
        bound = TerritorialBound(
            province_code=principal.province_code,
            commune_code=principal.commune_code,
            forced=bool(principal.territory_forced),
            national_view=not principal.territory_forced,
        )
    elif principal.territory_forced and principal.province_code:
        bound = TerritorialBound(
            province_code=principal.province_code,
            commune_code=principal.commune_code,
            forced=True,
            national_view=False,
        )
    applied = enforce_dashboard_filters(requested, bound)
    return applied, bound
