"""ONIP routes — `/api/v1/onip/dashboard` + conformité NIN."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_CITIZEN_VALIDATE,
    PERM_CIVIL_READ,
    PERM_ONIP_DASHBOARD,
    Principal,
    mfa_status_for,
    require_mfa_if_enforced,
    require_permissions,
)
from apps.api.db.session import get_db
from apps.api.domains.core_registry.enums import CitizenStatus
from apps.api.domains.core_registry.models import Citizen, NicIssuanceLog
from apps.api.domains.core_registry.national_identity_number_service import (
    OFFICIAL_BLOCK_REASON,
    OFFICIAL_NIN_FORMAT_CONFIRMED,
    OfficialNinFormatUnresolvedError,
    NationalIdentityNumberService,
    ProvisionalNinPrerequisitesError,
    assign_official_nin,
    assign_provisional_nic,
)
from apps.api.domains.onip import service
from apps.api.domains.onip.scope import resolve_scoped_filters

router = APIRouter(prefix="/onip", tags=["onip"])


def _dashboard_filters_from_query(
    period_from: date | None = None,
    period_to: date | None = None,
    province_code: str | None = None,
    commune_code: str | None = None,
    campaign_id: UUID | None = None,
    citizen_status: str | None = None,
    card_status: str | None = None,
) -> service.DashboardFilters:
    return service.normalize_dashboard_filters(
        period_from=period_from,
        period_to=period_to,
        province_code=province_code,
        commune_code=commune_code,
        campaign_id=campaign_id,
        citizen_status=citizen_status,
        card_status=card_status,
    )


async def _scoped_dashboard_filters(
    db: AsyncSession,
    principal: Principal,
    *,
    period_from: date | None = None,
    period_to: date | None = None,
    province_code: str | None = None,
    commune_code: str | None = None,
    campaign_id: UUID | None = None,
    citizen_status: str | None = None,
    card_status: str | None = None,
) -> tuple[service.DashboardFilters, Any]:
    requested = _dashboard_filters_from_query(
        period_from,
        period_to,
        province_code,
        commune_code,
        campaign_id,
        citizen_status,
        card_status,
    )
    return await resolve_scoped_filters(db, principal, requested)


async def _audit_dashboard(
    db: AsyncSession,
    principal: Principal,
    *,
    action: str,
    filters: service.DashboardFilters,
    result: str = "success",
) -> None:
    try:
        from apps.api.domains.audit.services import write_audit

        await write_audit(
            db,
            action=action,
            actor_id=principal.actor_id,
            institution_id=principal.institution_id,
            resource_type="onip_dashboard",
            resource_id="module-1",
            result=result,
            new_value={
                "period_from": filters.period_from.isoformat() if filters.period_from else None,
                "period_to": filters.period_to.isoformat() if filters.period_to else None,
                "province_code": filters.province_code,
                "commune_code": filters.commune_code,
                "campaign_id": str(filters.campaign_id) if filters.campaign_id else None,
            },
            commit=False,
        )
    except Exception:
        # L'audit ne doit pas casser la lecture du dashboard
        await db.rollback()


@router.get("/dashboard")
async def onip_dashboard(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
    period_from: date | None = Query(default=None, description="Début période (inclus)"),
    period_to: date | None = Query(default=None, description="Fin période (inclus)"),
    province_code: str | None = Query(default=None),
    commune_code: str | None = Query(default=None),
    campaign_id: UUID | None = Query(default=None),
    citizen_status: str | None = Query(default=None),
    card_status: str | None = Query(default=None),
) -> dict[str, Any]:
    """Module 1 — agrégats nationaux filtrables (sans PII), périmètre serveur."""
    filters, bound = await _scoped_dashboard_filters(
        db,
        principal,
        period_from=period_from,
        period_to=period_to,
        province_code=province_code,
        commune_code=commune_code,
        campaign_id=campaign_id,
        citizen_status=citizen_status,
        card_status=card_status,
    )
    await _audit_dashboard(db, principal, action="onip.dashboard.view", filters=filters)
    out = await service.build_dashboard(db, filters)
    meta = dict(out.get("meta") or {})
    meta["territory"] = {
        "forced": bound.forced,
        "national_view": bound.national_view,
        "allowed_province": bound.province_code,
        "allowed_commune": bound.commune_code,
    }
    out["meta"] = meta
    return out


@router.get("/dashboard/trends")
async def onip_dashboard_trends(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
    period_from: date | None = Query(default=None),
    period_to: date | None = Query(default=None),
    province_code: str | None = Query(default=None),
    commune_code: str | None = Query(default=None),
    campaign_id: UUID | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=180),
) -> dict[str, Any]:
    """Module 1 — tendances temporelles agrégées."""
    filters, _ = await _scoped_dashboard_filters(
        db,
        principal,
        period_from=period_from,
        period_to=period_to,
        province_code=province_code,
        commune_code=commune_code,
        campaign_id=campaign_id,
    )
    return await service.build_dashboard_trends(db, filters, days=days)


@router.get("/dashboard/territories")
async def onip_dashboard_territories(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
    period_from: date | None = Query(default=None),
    period_to: date | None = Query(default=None),
    province_code: str | None = Query(default=None),
    commune_code: str | None = Query(default=None),
    campaign_id: UUID | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
) -> dict[str, Any]:
    """Module 1 — répartition territoriale agrégée."""
    filters, _ = await _scoped_dashboard_filters(
        db,
        principal,
        period_from=period_from,
        period_to=period_to,
        province_code=province_code,
        commune_code=commune_code,
        campaign_id=campaign_id,
    )
    return await service.build_dashboard_territories(db, filters, limit=limit)


@router.get("/dashboard/alerts")
async def onip_dashboard_alerts(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
    period_from: date | None = Query(default=None),
    period_to: date | None = Query(default=None),
    province_code: str | None = Query(default=None),
    commune_code: str | None = Query(default=None),
    campaign_id: UUID | None = Query(default=None),
) -> dict[str, Any]:
    """Module 1 — centre d'alertes synthétique."""
    filters, _ = await _scoped_dashboard_filters(
        db,
        principal,
        period_from=period_from,
        period_to=period_to,
        province_code=province_code,
        commune_code=commune_code,
        campaign_id=campaign_id,
    )
    return await service.build_dashboard_alerts(db, filters)


@router.get("/dashboard/health")
async def onip_dashboard_health(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> dict[str, Any]:
    """Module 1 — santé des services surveillés."""
    return await service.build_dashboard_health(db)


@router.get("/dashboard/export")
async def onip_dashboard_export(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
    period_from: date | None = Query(default=None),
    period_to: date | None = Query(default=None),
    province_code: str | None = Query(default=None),
    commune_code: str | None = Query(default=None),
    campaign_id: UUID | None = Query(default=None),
    citizen_status: str | None = Query(default=None),
    card_status: str | None = Query(default=None),
) -> Response:
    """Export CSV agrégats uniquement — journalisé (cahier §11.2 / DASH-011)."""
    filters, bound = await _scoped_dashboard_filters(
        db,
        principal,
        period_from=period_from,
        period_to=period_to,
        province_code=province_code,
        commune_code=commune_code,
        campaign_id=campaign_id,
        citizen_status=citizen_status,
        card_status=card_status,
    )
    # Responsable de centre / provincial : export national interdit
    if bound.forced and not province_code and bound.province_code:
        # déjà forcé au périmètre — OK
        pass
    await _audit_dashboard(db, principal, action="onip.dashboard.export", filters=filters)
    dash = await service.build_dashboard(db, filters)
    k = dash.get("kpis") or {}
    lines = [
        "indicateur,valeur",
        f"generated_at,{dash.get('generated_at','')}",
        f"freshness,{(dash.get('meta') or {}).get('freshness','')}",
        f"province,{filters.province_code or ''}",
        f"commune,{filters.commune_code or ''}",
    ]
    for key in (
        "registered_records",
        "validated_records",
        "pending_records",
        "assigned_nins",
        "duplicate_reviews_open",
        "cards_produced",
        "cards_delivered",
        "cards_expired",
        "cards_pending",
        "validation_rate_percent",
        "sync_rate_percent",
        "sync_failures",
        "campaigns_active",
    ):
        val = k.get(key)
        lines.append(f"{key},{'' if val is None else val}")
    body = "\n".join(lines) + "\n"
    await db.commit()
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="onip-dashboard-aggregates.csv"',
            "X-PII": "false",
        },
    )


@router.get(
    "/map-points",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD))],
)
async def onip_map_points(
    address_source: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Un marqueur GPS par personne recensée. Filtre: gps | online | manual."""
    return await service.list_map_points(db, address_source=address_source)


@router.get(
    "/map-by-milieu",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD))],
)
async def onip_map_by_milieu(
    address_source: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Carte regroupée par milieu avec statistiques."""
    return await service.list_map_by_milieu(db, address_source=address_source)


@router.get(
    "/ops-health",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD))],
)
async def onip_ops_health(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Santé agrégée pour l'administration technique ONIP (sans secrets)."""
    return await service.build_ops_health(db)


@router.get("/nin/compliance",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD))],
)
async def nin_compliance_status() -> dict[str, Any]:
    """État juridique / technique du générateur NIN (pas de données personnelles)."""
    return {
        "official_nin_format_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
        "official_generation_enabled": False,
        "block_reason": OFFICIAL_BLOCK_REASON if not OFFICIAL_NIN_FORMAT_CONFIRMED else None,
        "provisional_algorithm": "PROVISIONAL-v3-rdc-14-NOT-OFFICIAL",
        "audit_doc": "docs/legal/onip/AUDIT_CONFORMITE_FGP_NIN.md",
        "plan_matrix": "docs/legal/onip/MATRICE_PLAN_VS_EXISTANT.md",
        "detail_audit": "docs/legal/onip/RAPPORT_AUDIT_ONIP_DETAIL.md",
        "decree_ref": "Décret n° 22/07 du 2 mars 2022, art. 8",
    }


@router.get(
    "/security/mfa-policy",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD))],
)
async def onip_mfa_policy(
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> dict[str, Any]:
    """Politique MFA pour opérations sensibles (signalement + enforcement optionnel)."""
    return mfa_status_for(principal)


@router.get(
    "/civil/conflicts",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD, PERM_CIVIL_READ))],
)
async def onip_civil_conflicts(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """File conflits / corrections EC — pas d'écrasement silencieux."""
    return await service.list_civil_conflicts(db, limit=limit)


class NinAssignRequest(BaseModel):
    citizen_id: UUID
    mode: Literal["provisional", "official"] = Field(
        default="official",
        description="official = règle légale (bloqué tant que non confirmée) ; provisional = DEV uniquement",
    )


@router.get(
    "/nin/eligible",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD))],
)
async def nin_eligible(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Citoyens sans NIC, non décédés — candidats à attribution provisoire (pas officielle)."""
    stmt = (
        select(Citizen)
        .where(
            Citizen.nic.is_(None),
            Citizen.status.notin_(
                [
                    CitizenStatus.DECEASED.value,
                    CitizenStatus.MERGED.value,
                ]
            ),
        )
        .order_by(Citizen.updated_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    items: list[dict[str, Any]] = []
    for c in rows:
        open_dupes = await NationalIdentityNumberService.count_open_duplicates(db, c.id)
        items.append(
            {
                "id": str(c.id),
                "family_name": c.family_name,
                "given_names": c.given_names,
                "date_of_birth": c.date_of_birth.isoformat() if c.date_of_birth else None,
                "status": c.status,
                "open_duplicates": open_dupes,
                "eligible_provisional": open_dupes == 0
                and bool(c.family_name and c.given_names and c.date_of_birth),
                "nin_status": None,
            }
        )
    return {
        "count": len(items),
        "items": items,
        "official_assign_available": False,
        "note": "Aucun bouton NIN officiel — générateur bloqué jusqu'à annexe signée.",
    }


@router.get(
    "/nin/issuance-log",
    dependencies=[Depends(require_permissions(PERM_ONIP_DASHBOARD))],
)
async def nin_issuance_log(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Historique d'émission NIC provisoire (pas de PII biométrique)."""
    stmt = (
        select(NicIssuanceLog)
        .order_by(NicIssuanceLog.issued_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "count": len(rows),
        "items": [
            {
                "citizen_id": str(r.citizen_id),
                "nic": r.nic,
                "issued_at": r.issued_at.isoformat() if r.issued_at else None,
                "algorithm_version": r.algorithm_version,
                "nin_status": "PROVISIONAL",
                "official": False,
            }
            for r in rows
        ],
    }


@router.post("/nin/assign")
async def nin_assign(
    body: NinAssignRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_VALIDATE, PERM_ONIP_DASHBOARD)),
    _: Principal = Depends(require_mfa_if_enforced()),
) -> dict[str, Any]:
    """Attribution via le service central — pas de génération libre publique."""
    citizen = await db.get(Citizen, body.citizen_id)
    if citizen is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    if body.mode == "official":
        try:
            result = await assign_official_nin(
                db, citizen=citizen, actor_id=principal.actor_id
            )
        except OfficialNinFormatUnresolvedError as exc:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={
                    "message": str(exc),
                    "official_nin_format_confirmed": False,
                    "hint": "Fournir l'arrêté + annexe NIN signés pour débloquer.",
                },
            ) from exc
    else:
        try:
            result = await assign_provisional_nic(
                db, citizen=citizen, actor_id=principal.actor_id
            )
        except ProvisionalNinPrerequisitesError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": str(exc),
                    "code": exc.code,
                    **exc.details,
                },
            ) from exc

    await db.commit()
    mfa = mfa_status_for(principal)
    return {
        "nin": result.nin,
        "citizen_id": str(result.citizen_id),
        "algorithm_version": result.algorithm_version,
        "official": result.official,
        "already_assigned": result.already_assigned,
        "nin_status": getattr(result, "nin_status", "PROVISIONAL"),
        "service": NationalIdentityNumberService.__name__,
        "mfa_warning": mfa["mfa_recommended"] or None,
    }
