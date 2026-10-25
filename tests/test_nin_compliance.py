"""Garde-fous conformité NIN / FGP — sans prétendre un format officiel."""

from __future__ import annotations

import pytest

from apps.api.domains.core_registry.national_identity_number_service import (
    OFFICIAL_BLOCK_REASON,
    OFFICIAL_NIN_FORMAT_CONFIRMED,
    OfficialNinFormatUnresolvedError,
    NationalIdentityNumberService,
    assign_official_nin,
)
from apps.api.domains.core_registry.nic_service import ALGORITHM_VERSION, is_valid_nic_format


def test_official_format_not_confirmed():
    assert OFFICIAL_NIN_FORMAT_CONFIRMED is False
    assert NationalIdentityNumberService.official_format_ready() is False


@pytest.mark.asyncio
async def test_assign_official_nin_is_blocked():
    class _FakeCitizen:
        id = None
        nic = None

    with pytest.raises(OfficialNinFormatUnresolvedError) as exc:
        await assign_official_nin(None, citizen=_FakeCitizen(), actor_id=None)  # type: ignore[arg-type]
    assert "bloqué" in str(exc.value).lower() or "BLOCK" in OFFICIAL_BLOCK_REASON


def test_provisional_algorithm_explicitly_marked():
    assert "PROVISIONAL" in ALGORITHM_VERSION
    assert "NOT-OFFICIAL" in ALGORITHM_VERSION


def test_provisional_format_rules_unchanged():
    assert is_valid_nic_format("15001119900042")
    assert not is_valid_nic_format("CD-2026-000000001")
    assert not is_valid_nic_format("1" * 12)
