"""Contrats conformité NIN côté domaine ONIP (sans DB)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.core_registry.national_identity_number_service import (
    OFFICIAL_NIN_FORMAT_CONFIRMED,
    NationalIdentityNumberService,
    assign_official_nin,
)


def test_official_flag_enabled():
    assert OFFICIAL_NIN_FORMAT_CONFIRMED is True


@pytest.mark.asyncio
async def test_official_assign_returns_existing():
    session = AsyncMock()
    citizen = SimpleNamespace(id=uuid4(), nic="15001119900042", status="ACTIVE")
    out = await assign_official_nin(session, citizen=citizen)
    assert out.nin == "15001119900042"
    assert out.official is True
    assert out.already_assigned is True


@pytest.mark.asyncio
async def test_catalog_generation_enabled():
    cat = NationalIdentityNumberService.catalog()
    assert cat["official_generation_enabled"] is True
