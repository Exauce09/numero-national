"""Module 1 — conformité cahier des charges (KPI, fraîcheur, endpoints)."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from apps.api.domains.onip.service import (
    DashboardFilters,
    build_dashboard,
    build_dashboard_alerts,
    build_dashboard_health,
    build_dashboard_trends,
    build_dashboard_territories,
    normalize_dashboard_filters,
)


@pytest.mark.asyncio
async def test_dashboard_kpi_contract_and_freshness():
    db = AsyncMock()
    with patch("apps.api.domains.onip.service._safe_count", new_callable=AsyncMock) as mc, patch(
        "apps.api.domains.onip.service._safe_metric", new_callable=AsyncMock
    ) as mm:
        mc.return_value = 0
        mm.return_value = {"source": "t", "status": "ok", "value": 0}
        out = await build_dashboard(db, DashboardFilters())
    assert out["module"] == 1
    assert "meta" in out and out["meta"]["freshness"] in {"current", "degraded"}
    k = out["kpis"]
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
    ):
        assert key in k
    assert "expired" in out["cards"]
    assert out["export"]["pii"] is False
    assert "drilldown" in out


@pytest.mark.asyncio
async def test_validation_rate_na_when_denominator_zero():
    db = AsyncMock()
    with patch("apps.api.domains.onip.service._safe_count", new_callable=AsyncMock) as mc, patch(
        "apps.api.domains.onip.service._safe_metric", new_callable=AsyncMock
    ) as mm:
        mc.return_value = 0
        mm.return_value = {"source": "t", "status": "ok", "value": 0}
        out = await build_dashboard(db)
    assert out["kpis"]["validation_rate_percent"] is None
    assert out["kpis"]["sync_rate_percent"] is None


@pytest.mark.asyncio
async def test_trends_series_days():
    db = AsyncMock()
    with patch("apps.api.domains.onip.service._safe_rows", new_callable=AsyncMock) as mr:
        mr.return_value = []
        out = await build_dashboard_trends(
            db,
            normalize_dashboard_filters(period_from=date(2026, 10, 1), period_to=date(2026, 10, 3)),
        )
    assert len(out["series"]) == 3
    assert out["series"][0]["day"] == "2026-10-01"
    assert out["series"][0]["registered"] == 0


@pytest.mark.asyncio
async def test_territories_and_alerts_and_health():
    db = AsyncMock()
    with patch("apps.api.domains.onip.service._safe_rows", new_callable=AsyncMock) as mr, patch(
        "apps.api.domains.onip.service.build_dashboard", new_callable=AsyncMock
    ) as bd, patch(
        "apps.api.domains.onip.service._safe_metric", new_callable=AsyncMock
    ) as mm:
        mr.return_value = [{"zone": "KIN", "registered": 10, "validated": 4, "nin_assigned": 3}]
        bd.return_value = {
            "generated_at": "t",
            "alerts": {"high": 1},
            "anomalies": [{"code": "X", "severity": "high", "count": 1, "message": "m"}],
            "meta": {"freshness": "current"},
        }
        mm.return_value = {"source": "api_db", "status": "ok", "value": 1}
        ter = await build_dashboard_territories(db)
        al = await build_dashboard_alerts(db)
        he = await build_dashboard_health(db)
    assert ter["zones"][0]["zone"] == "KIN"
    assert al["summary"]["high"] == 1
    assert he["services"][0]["state"] == "operational"


@pytest.mark.asyncio
async def test_health_unknown_when_probe_fails():
    db = AsyncMock()
    with patch("apps.api.domains.onip.service._safe_metric", new_callable=AsyncMock) as mm:
        mm.return_value = {
            "source": "api_db",
            "status": "unavailable",
            "value": None,
            "reason": "query_failed",
        }
        he = await build_dashboard_health(db)
    assert all(s["state"] == "unknown" for s in he["services"])
