"""Module 1 — périmètre territorial serveur (DASH-003 / DASH-004)."""

from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from fastapi import HTTPException

from apps.api.core.permissions import Principal
from apps.api.domains.onip.scope import (
    TerritorialBound,
    enforce_dashboard_filters,
)
from apps.api.domains.onip.service import normalize_dashboard_filters


def test_enforce_forces_province_when_bound():
    bound = TerritorialBound(
        province_code="KIN", commune_code=None, forced=True, national_view=False
    )
    req = normalize_dashboard_filters(period_from=date(2026, 1, 1))
    out = enforce_dashboard_filters(req, bound)
    assert out.province_code == "KIN"


def test_enforce_rejects_foreign_province():
    bound = TerritorialBound(
        province_code="KIN", commune_code=None, forced=True, national_view=False
    )
    req = normalize_dashboard_filters(province_code="EQT")
    with pytest.raises(HTTPException) as exc:
        enforce_dashboard_filters(req, bound)
    assert exc.value.status_code == 403
    assert exc.value.detail["allowed_province"] == "KIN"


def test_enforce_rejects_foreign_commune():
    bound = TerritorialBound(
        province_code="KIN",
        commune_code="KIN-GOMBE",
        forced=True,
        national_view=False,
    )
    req = normalize_dashboard_filters(province_code="KIN", commune_code="KIN-LIMETE")
    with pytest.raises(HTTPException) as exc:
        enforce_dashboard_filters(req, bound)
    assert exc.value.status_code == 403


def test_national_view_allows_any_province():
    bound = TerritorialBound(
        province_code=None, commune_code=None, forced=False, national_view=True
    )
    req = normalize_dashboard_filters(province_code="SKV")
    out = enforce_dashboard_filters(req, bound)
    assert out.province_code == "SKV"


def test_principal_carries_territory_fields():
    p = Principal(
        actor_id=uuid4(),
        permissions=frozenset({"onip:dashboard"}),
        province_code="KIN",
        territory_forced=True,
    )
    assert p.territory_forced is True
    assert p.province_code == "KIN"
