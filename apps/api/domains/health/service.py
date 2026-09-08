"""Health services + civil declaration interface stub."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.health.models import (
    BirthNotification,
    DeathNotification,
    HealthFacility,
    NotificationStatus,
)
from apps.api.domains.health.schemas import (
    BirthDeclare,
    DeathDeclare,
    FacilityCreate,
    VerifyIdentityRequest,
    VerifyIdentityResponse,
)

logger = logging.getLogger(__name__)


class CivilDeclarationPort(Protocol):
    """Interface toward état civil — implemented by Phase 4 when available."""

    async def create_declaration(
        self,
        declaration_type: str,
        source: str,
        payload: dict[str, Any],
    ) -> uuid.UUID: ...


class StubCivilDeclarationService:
    """Fallback when etat_civil domain is not imported."""

    async def create_declaration(
        self,
        declaration_type: str,
        source: str,
        payload: dict[str, Any],
    ) -> uuid.UUID:
        decl_id = uuid.uuid4()
        logger.info(
            "civil_declaration_stub type=%s source=%s id=%s keys=%s",
            declaration_type,
            source,
            decl_id,
            list(payload.keys()),
        )
        return decl_id


def get_civil_port() -> CivilDeclarationPort:
    try:
        from apps.api.domains.etat_civil.service import create_declaration_from_health  # type: ignore

        class Adapter:
            async def create_declaration(
                self, declaration_type: str, source: str, payload: dict[str, Any]
            ) -> uuid.UUID:
                return await create_declaration_from_health(declaration_type, source, payload)

        return Adapter()
    except Exception:
        return StubCivilDeclarationService()


async def create_facility(db: AsyncSession, data: FacilityCreate) -> HealthFacility:
    row = HealthFacility(**data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def verify_identity_stub(
    _db: AsyncSession, req: VerifyIdentityRequest
) -> VerifyIdentityResponse:
    """Identity verify for health agents — returns reference only, never full dossier."""
    if req.citizen_reference:
        return VerifyIdentityResponse(
            verified=True,
            citizen_reference=req.citizen_reference,
            status="ACTIVE",
            message="Stub verification — replace with registry token resolve + status check.",
        )
    if req.sectoral_token:
        # Soft dependency on token service when Phase 2 is present.
        try:
            from apps.api.domains.token_service.service import resolve_token  # type: ignore

            citizen_id = await resolve_token(_db, req.sectoral_token)
            return VerifyIdentityResponse(
                verified=True,
                citizen_reference=citizen_id,
                status="ACTIVE",
                message="Resolved via sectoral token.",
            )
        except Exception:
            return VerifyIdentityResponse(
                verified=False,
                citizen_reference=None,
                status="UNKNOWN",
                message="Token service unavailable; provide citizen_reference.",
            )
    return VerifyIdentityResponse(
        verified=False,
        citizen_reference=None,
        status="MISSING",
        message="Provide citizen_reference or sectoral_token.",
    )


async def declare_birth(db: AsyncSession, data: BirthDeclare) -> BirthNotification:
    civil = get_civil_port()
    decl_id = await civil.create_declaration("BIRTH", "HOSPITAL", data.payload)
    row = BirthNotification(
        facility_id=data.facility_id,
        mother_citizen_reference=data.mother_citizen_reference,
        payload=data.payload,
        status=NotificationStatus.FORWARDED_CIVIL,
        civil_declaration_id=decl_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def declare_death(db: AsyncSession, data: DeathDeclare) -> DeathNotification:
    civil = get_civil_port()
    payload = {**data.payload, "citizen_reference": str(data.citizen_reference)}
    decl_id = await civil.create_declaration("DEATH", "HOSPITAL", payload)
    row = DeathNotification(
        facility_id=data.facility_id,
        citizen_reference=data.citizen_reference,
        payload=data.payload,
        notes=data.notes,
        status=NotificationStatus.FORWARDED_CIVIL,
        civil_declaration_id=decl_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_facilities(db: AsyncSession, *, limit: int = 100) -> list[HealthFacility]:
    from sqlalchemy import select

    result = await db.execute(select(HealthFacility).limit(limit))
    return list(result.scalars().all())


async def health_national_stats(db: AsyncSession) -> dict[str, Any]:
    """Aggregated anonymized health indicators (no PII)."""
    from sqlalchemy import func, select

    births = await db.scalar(select(func.count()).select_from(BirthNotification)) or 0
    deaths = await db.scalar(select(func.count()).select_from(DeathNotification)) or 0
    facilities = await db.scalar(select(func.count()).select_from(HealthFacility)) or 0
    forwarded_births = (
        await db.scalar(
            select(func.count()).select_from(BirthNotification).where(
                BirthNotification.status == NotificationStatus.FORWARDED_CIVIL.value
            )
        )
        or 0
    )
    forwarded_deaths = (
        await db.scalar(
            select(func.count()).select_from(DeathNotification).where(
                DeathNotification.status == NotificationStatus.FORWARDED_CIVIL.value
            )
        )
        or 0
    )
    return {
        "pii_policy": "anonymized_aggregates_only",
        "facilities_count": int(facilities),
        "birth_notifications": int(births),
        "death_notifications": int(deaths),
        "births_forwarded_to_civil": int(forwarded_births),
        "deaths_forwarded_to_civil": int(forwarded_deaths),
        "metrics": [
            {"key": "health.facilities", "value": int(facilities)},
            {"key": "health.birth_notifications", "value": int(births)},
            {"key": "health.death_notifications", "value": int(deaths)},
            {"key": "health.births_forwarded_civil", "value": int(forwarded_births)},
            {"key": "health.deaths_forwarded_civil", "value": int(forwarded_deaths)},
        ],
    }
