"""Contrats conformité NIN côté domaine ONIP (sans DB)."""

from __future__ import annotations

from apps.api.domains.core_registry.national_identity_number_service import (
    OFFICIAL_BLOCK_REASON,
    OFFICIAL_NIN_FORMAT_CONFIRMED,
    OfficialNinFormatUnresolvedError,
    assign_official_nin,
)


def test_official_flag_blocks_production_generator():
    assert OFFICIAL_NIN_FORMAT_CONFIRMED is False
    assert "bloqué" in OFFICIAL_BLOCK_REASON.lower() or "bloque" in OFFICIAL_BLOCK_REASON.lower()


import pytest


@pytest.mark.asyncio
async def test_official_assign_raises():
    class C:
        id = None
        nic = None

    with pytest.raises(OfficialNinFormatUnresolvedError):
        await assign_official_nin(None, citizen=C())  # type: ignore[arg-type]
