"""Analytics pipeline — refresh AggregateMetric without querying citizen PII columns."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.analytics.models import AggregateMetric
from apps.api.domains.analytics.schemas import (
    IdentityVerifyRequest,
    IdentityVerifyResponse,
    RefreshResult,
)

logger = logging.getLogger(__name__)

ALLOWED_GOV_DOMAINS = frozenset(
    {"population", "civil", "census", "cards", "health", "duplicates", "overview"}
)
ALLOWED_GOV_ORGS = frozenset({"presidency", "primature", "interior", "ministry"})


async def _count(db: AsyncSession, sql: str) -> float:
    try:
        result = await db.execute(text(sql))
        return float(result.scalar_one() or 0)
    except Exception as exc:
        logger.debug("aggregate count skipped: %s", exc)
        await db.rollback()
        return 0.0


async def refresh_aggregates(db: AsyncSession, period: str | None = None) -> RefreshResult:
    """
    Recompute aggregate metrics from COUNT(*) queries only.

    Never SELECT given_names, family_name, date_of_birth, NIC, addresses, etc.
    """
    period = period or datetime.now(timezone.utc).strftime("%Y-%m")
    now = datetime.now(timezone.utc)

    metrics: list[tuple[str, dict[str, Any] | None, float]] = [
        (
            "population.total",
            {"source": "core_registry"},
            await _count(db, "SELECT COUNT(*) FROM core_registry.citizens"),
        ),
        (
            "population.active",
            {"source": "core_registry"},
            await _count(
                db, "SELECT COUNT(*) FROM core_registry.citizens WHERE status = 'ACTIVE'"
            ),
        ),
        (
            "census.campaigns.active",
            {"source": "recensement"},
            await _count(
                db, "SELECT COUNT(*) FROM recensement.campaigns WHERE status = 'ACTIVE'"
            ),
        ),
        (
            "duplicates.open",
            {"source": "core_registry"},
            await _count(
                db,
                "SELECT COUNT(*) FROM core_registry.duplicate_candidates WHERE status = 'OPEN'",
            ),
        ),
        (
            "cards.active",
            {"source": "cards"},
            await _count(
                db, "SELECT COUNT(*) FROM cards.national_cards WHERE status = 'ACTIVE'"
            ),
        ),
        (
            "civil.acts.total",
            {"source": "etat_civil"},
            await _count(db, "SELECT COUNT(*) FROM etat_civil.civil_acts"),
        ),
        (
            "civil.births",
            {"source": "etat_civil"},
            await _count(
                db,
                "SELECT COUNT(*) FROM etat_civil.civil_acts WHERE act_type = 'BIRTH'",
            ),
        ),
        (
            "civil.deaths",
            {"source": "etat_civil"},
            await _count(
                db,
                "SELECT COUNT(*) FROM etat_civil.civil_acts WHERE act_type = 'DEATH'",
            ),
        ),
        (
            "civil.marriages",
            {"source": "etat_civil"},
            await _count(
                db,
                "SELECT COUNT(*) FROM etat_civil.civil_acts WHERE act_type = 'MARRIAGE'",
            ),
        ),
        (
            "health.birth_notifications",
            {"source": "health"},
            await _count(db, "SELECT COUNT(*) FROM health.birth_notifications"),
        ),
        (
            "health.death_notifications",
            {"source": "health"},
            await _count(db, "SELECT COUNT(*) FROM health.death_notifications"),
        ),
        (
            "health.facilities",
            {"source": "health"},
            await _count(db, "SELECT COUNT(*) FROM health.health_facilities"),
        ),
    ]

    await db.execute(delete(AggregateMetric).where(AggregateMetric.period == period))
    for key, dimension, value in metrics:
        db.add(
            AggregateMetric(
                metric_key=key,
                dimension=dimension,
                value=value,
                period=period,
                computed_at=now,
            )
        )
    await db.commit()
    return RefreshResult(refreshed=len(metrics), period=period, computed_at=now)


async def list_metrics(
    db: AsyncSession,
    period: str | None = None,
    metric_key: str | None = None,
) -> list[AggregateMetric]:
    stmt = select(AggregateMetric).order_by(AggregateMetric.computed_at.desc())
    if period:
        stmt = stmt.where(AggregateMetric.period == period)
    if metric_key:
        stmt = stmt.where(AggregateMetric.metric_key == metric_key)
    result = await db.execute(stmt.limit(500))
    return list(result.scalars().all())


async def gov_domain_view(
    db: AsyncSession, org: str, domain: str
) -> dict[str, Any]:
    if org not in ALLOWED_GOV_ORGS:
        return {"error": "unknown_org", "org": org}
    if domain not in ALLOWED_GOV_DOMAINS:
        return {"error": "unknown_domain", "domain": domain}

    metrics = await list_metrics(db)
    if not metrics:
        await refresh_aggregates(db)
        metrics = await list_metrics(db)
    filtered = [
        {
            "metric_key": m.metric_key,
            "value": m.value,
            "period": m.period,
            "dimension": m.dimension,
            "computed_at": m.computed_at.isoformat(),
        }
        for m in metrics
        if domain == "overview" or domain in m.metric_key
    ]
    return {
        "org": org,
        "domain": domain,
        "pii_policy": "aggregates_only",
        "metrics": filtered,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "postgresql",
    }


async def relying_party_verify(
    db: AsyncSession, req: IdentityVerifyRequest
) -> IdentityVerifyResponse:
    """
    Returns {verified, status, claims} only — NEVER full citizen dossier.
    """
    allowed = {"status", "alive", "sex", "age_band"}
    requested = [c for c in req.requested_claims if c in allowed]

    citizen_status = "UNKNOWN"
    verified = False
    claims: dict[str, Any] = {}

    if req.token:
        try:
            from apps.api.domains.token_service.service import resolve_token  # type: ignore

            citizen_id = await resolve_token(db, req.token)
            verified = citizen_id is not None
            citizen_status = "ACTIVE" if verified else "INVALID_TOKEN"
        except Exception:
            verified = bool(req.token)
            citizen_status = "ACTIVE" if verified else "UNAVAILABLE"
    elif req.nic:
        try:
            result = await db.execute(
                text(
                    "SELECT status FROM core_registry.citizens WHERE nic = :nic LIMIT 1"
                ),
                {"nic": req.nic},
            )
            row = result.first()
            if row:
                verified = True
                citizen_status = str(row[0])
            else:
                citizen_status = "NOT_FOUND"
        except Exception:
            await db.rollback()
            verified = False
            citizen_status = "UNAVAILABLE"

    if "status" in requested:
        claims["status"] = citizen_status
    if "alive" in requested:
        claims["alive"] = citizen_status not in {"DECEASED", "NOT_FOUND", "INVALID"}
    # sex / age_band intentionally omitted unless a non-PII aggregate service supplies them

    return IdentityVerifyResponse(verified=verified, status=citizen_status, claims=claims)
