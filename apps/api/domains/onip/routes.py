"""ONIP routes — `/api/v1/onip/dashboard` + conformité NIN."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_CITIZEN_VALIDATE,
    PERM_ONIP_DASHBOARD,
    Principal,
    require_permissions,
)
from apps.api.db.session import get_db
from apps.api.domains.core_registry.models import Citizen
from apps.api.domains.core_registry.national_identity_number_service import (
    OFFICIAL_BLOCK_REASON,
    OFFICIAL_NIN_FORMAT_CONFIRMED,
    OfficialNinFormatUnresolvedError,
    NationalIdentityNumberService,
    assign_official_nin,
    assign_provisional_nic,
)
from apps.api.domains.onip import service

router = APIRouter(prefix="/onip", tags=["onip"])


@router.get("/dashboard")
async def onip_dashboard(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """National operations aggregates for ONIP operators."""
    return await service.build_dashboard(db)


@router.get("/map-points")
async def onip_map_points(
    address_source: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Un marqueur GPS par personne recensée. Filtre: gps | online | manual."""
    return await service.list_map_points(db, address_source=address_source)


@router.get("/map-by-milieu")
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
    dash = await service.build_dashboard(db)
    return {
        "api": "up",
        "onip_dashboard": "ok",
        "official_nin_format_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
        "population_cards": dash.get("cards") if isinstance(dash, dict) else None,
        "anomaly_count": len(dash.get("anomalies") or []) if isinstance(dash, dict) else 0,
        "hint": "Biométrie / civil : consulter les pages dédiées (permissions séparées).",
    }


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
        "decree_ref": "Décret n° 22/07 du 2 mars 2022, art. 8",
    }


class NinAssignRequest(BaseModel):
    citizen_id: UUID
    mode: Literal["provisional", "official"] = Field(
        default="official",
        description="official = règle légale (bloqué tant que non confirmée) ; provisional = DEV uniquement",
    )


@router.post("/nin/assign")
async def nin_assign(
    body: NinAssignRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_CITIZEN_VALIDATE, PERM_ONIP_DASHBOARD)),
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
        result = await assign_provisional_nic(
            db, citizen=citizen, actor_id=principal.actor_id
        )

    await db.commit()
    return {
        "nin": result.nin,
        "citizen_id": str(result.citizen_id),
        "algorithm_version": result.algorithm_version,
        "official": result.official,
        "already_assigned": result.already_assigned,
        "service": NationalIdentityNumberService.__name__,
    }
