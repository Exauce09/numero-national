"""Lot 3 — gates CIN : NIC + dossier ACTIVE."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from apps.api.domains.cards.services import CardEligibilityError, assert_cin_eligibility


@pytest.mark.asyncio
async def test_cin_refused_without_nic():
    citizen = SimpleNamespace(id=uuid4(), nic=None, status="ACTIVE")
    with pytest.raises(CardEligibilityError) as exc:
        await assert_cin_eligibility(citizen)
    assert exc.value.code == "nic_required"


@pytest.mark.asyncio
async def test_cin_refused_if_not_active():
    citizen = SimpleNamespace(id=uuid4(), nic="15001119900042", status="DRAFT")
    with pytest.raises(CardEligibilityError) as exc:
        await assert_cin_eligibility(citizen)
    assert exc.value.code == "dossier_not_validated"


@pytest.mark.asyncio
async def test_cin_ok_active_with_nic():
    citizen = SimpleNamespace(id=uuid4(), nic="15001119900042", status="ACTIVE")
    out = await assert_cin_eligibility(citizen)
    assert out is citizen


@pytest.mark.asyncio
async def test_cin_refused_missing_citizen():
    with pytest.raises(CardEligibilityError) as exc:
        await assert_cin_eligibility(None)
    assert exc.value.code == "citizen_not_found"
