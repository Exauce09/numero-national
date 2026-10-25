"""Prérequis + idempotence attribution NIC provisoire (Lot 1)."""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.core_registry.enums import CitizenStatus
from apps.api.domains.core_registry.national_identity_number_service import (
    NationalIdentityNumberService,
    NinAssignmentResult,
    ProvisionalNinPrerequisitesError,
    assign_provisional_nic,
)


def _citizen(**kwargs):
    base = dict(
        id=uuid4(),
        nic=None,
        status=CitizenStatus.DRAFT.value,
        given_names="Jean",
        family_name="Kabila",
        date_of_birth=date(1990, 1, 15),
        sex="MALE",
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_incomplete_dossier_rejected():
    session = AsyncMock()
    citizen = _citizen(given_names="  ", family_name="Ok")
    with pytest.raises(ProvisionalNinPrerequisitesError) as exc:
        await NationalIdentityNumberService.assert_provisional_prerequisites(session, citizen)
    assert exc.value.code == "incomplete_dossier"
    assert "given_names" in exc.value.details.get("missing", [])


@pytest.mark.asyncio
async def test_open_duplicates_rejected():
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=2)
    citizen = _citizen()
    with pytest.raises(ProvisionalNinPrerequisitesError) as exc:
        await NationalIdentityNumberService.assert_provisional_prerequisites(session, citizen)
    assert exc.value.code == "open_duplicates"
    assert exc.value.details["open_duplicates"] == 2


@pytest.mark.asyncio
async def test_deceased_status_rejected():
    session = AsyncMock()
    citizen = _citizen(status=CitizenStatus.DECEASED.value)
    with pytest.raises(ProvisionalNinPrerequisitesError) as exc:
        await NationalIdentityNumberService.assert_provisional_prerequisites(session, citizen)
    assert exc.value.code == "invalid_status"


@pytest.mark.asyncio
async def test_idempotent_double_assign_returns_same_nic():
    """Double appel : second retourne already_assigned sans regénérer."""
    session = AsyncMock()
    citizen = _citizen(nic="15001119900042")
    r1 = await assign_provisional_nic(session, citizen=citizen)
    r2 = await assign_provisional_nic(session, citizen=citizen)
    assert r1.nin == r2.nin == "15001119900042"
    assert r1.already_assigned is True
    assert r2.already_assigned is True
    assert r1.nin_status == "PROVISIONAL"
    assert r1.official is False


@pytest.mark.asyncio
async def test_nin_status_helper():
    assert NationalIdentityNumberService.nin_status_for(_citizen(nic="15001119900042")) == "PROVISIONAL"
    assert NationalIdentityNumberService.nin_status_for(_citizen(nic=None)) is None
