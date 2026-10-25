"""Module 1 — tableau de bord national : filtres + structure agrégats."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from apps.api.domains.onip.service import (
    DashboardFilters,
    build_dashboard,
    normalize_dashboard_filters,
)


def test_normalize_swaps_inverted_period():
    f = normalize_dashboard_filters(
        period_from=date(2026, 10, 20),
        period_to=date(2026, 10, 1),
        province_code=" kin ",
        commune_code="gombe",
    )
    assert f.period_from == date(2026, 10, 1)
    assert f.period_to == date(2026, 10, 20)
    assert f.province_code == "KIN"
    assert f.commune_code == "GOMBE"


def test_normalize_empty_codes_become_none():
    f = normalize_dashboard_filters(province_code="  ", citizen_status="")
    assert f.province_code is None
    assert f.citizen_status is None


@pytest.mark.asyncio
async def test_build_dashboard_structure_without_db_tables():
    """Sans tables : compteurs à 0, structure Module 1 complète, empty=True."""
    db = AsyncMock()
    with patch("apps.api.domains.onip.service._safe_count", new_callable=AsyncMock) as mock_count:
        mock_count.return_value = 0
        out = await build_dashboard(db, DashboardFilters())
    assert out["module"] == 1
    assert out["title"] == "Tableau de bord national"
    assert out["empty"] is True
    assert "generated_at" in out
    assert "population" in out
    assert "nin_assigned" in out["population"]
    assert "pending" in out["population"]
    assert "sync_rate_percent" in out["campaigns"]
    assert "produced" in out["cards"]
    assert "delivered" in out["cards"]
    assert "services" in out
    assert out["export"]["pii"] is False
    assert out["filters_applied"]["province_code"] is None


@pytest.mark.asyncio
async def test_build_dashboard_echoes_filters():
    db = AsyncMock()
    cid = uuid4()
    filters = normalize_dashboard_filters(
        period_from=date(2026, 1, 1),
        period_to=date(2026, 12, 31),
        province_code="KIN",
        campaign_id=cid,
        citizen_status="ACTIVE",
        card_status="PENDING",
    )
    with patch("apps.api.domains.onip.service._safe_count", new_callable=AsyncMock) as mock_count:
        mock_count.return_value = 3
        out = await build_dashboard(db, filters)
    assert out["filters_applied"]["province_code"] == "KIN"
    assert out["filters_applied"]["campaign_id"] == str(cid)
    assert out["filters_applied"]["citizen_status"] == "ACTIVE"
    assert out["filters_applied"]["card_status"] == "PENDING"
    assert out["empty"] is False  # counts > 0
    assert out["population"]["total"] == 3
