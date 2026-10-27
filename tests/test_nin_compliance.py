"""Garde-fous conformité NIN / FGP — format opérationnel confirmé."""

from __future__ import annotations

from apps.api.domains.core_registry.national_identity_number_service import (
    OFFICIAL_ALGORITHM_VERSION,
    OFFICIAL_NIN_FORMAT_CONFIRMED,
    NationalIdentityNumberService,
)
from apps.api.domains.core_registry.nic_service import ALGORITHM_VERSION, is_valid_nic_format


def test_official_format_confirmed():
    assert OFFICIAL_NIN_FORMAT_CONFIRMED is True
    assert NationalIdentityNumberService.official_format_ready() is True
    assert "OFFICIAL" in OFFICIAL_ALGORITHM_VERSION


def test_provisional_algorithm_still_labeled_for_legacy():
    assert "PROVISIONAL" in ALGORITHM_VERSION or "v3-rdc-14" in ALGORITHM_VERSION


def test_format_rules_unchanged():
    assert is_valid_nic_format("15001119900042")
    assert not is_valid_nic_format("CD-2026-000000001")
    assert not is_valid_nic_format("123")
