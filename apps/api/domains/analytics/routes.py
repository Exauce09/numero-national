"""Analytics + government portal routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.session import get_db
from apps.api.domains.analytics import service
from apps.api.domains.analytics.schemas import AggregateMetricOut, RefreshResult

router = APIRouter(tags=["analytics"])


@router.get("/analytics/metrics", response_model=list[AggregateMetricOut])
async def list_metrics(
    period: str | None = Query(default=None),
    metric_key: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[AggregateMetricOut]:
    return await service.list_metrics(db, period, metric_key)  # type: ignore[return-value]


@router.post("/analytics/refresh", response_model=RefreshResult)
async def refresh_aggregates(
    period: str | None = None, db: AsyncSession = Depends(get_db)
) -> RefreshResult:
    return await service.refresh_aggregates(db, period)


@router.get("/gov/{org}/{domain}")
async def gov_portal(
    org: str,
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Government dashboards for presidency | primature | interior | ministry.

    Serves AggregateMetric rows only — no citizen PII queries.
    """
    if org not in service.ALLOWED_GOV_ORGS:
        raise HTTPException(status_code=404, detail="Unknown government org path")
    if domain not in service.ALLOWED_GOV_DOMAINS:
        raise HTTPException(status_code=404, detail="Unknown domain")
    return await service.gov_domain_view(db, org, domain)
