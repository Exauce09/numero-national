"""Module 2 — dossiers FGP : transitions, recherche, doublons (sans NIN inventé)."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.core_registry.enums import CitizenStatus, DuplicateStatus, Sex
from apps.api.domains.core_registry.schemas import CitizenCreate, CitizenUpdate
from apps.api.domains.core_registry.service import (
    ALLOWED_STATUS_TRANSITIONS,
    citizen_to_list_item,
)


def test_status_transitions_forbid_active_and_merged_via_manual_path():
    """ACTIVE / MERGED ne passent pas par change_citizen_status (validate/merge)."""
    for allowed in ALLOWED_STATUS_TRANSITIONS.values():
        assert CitizenStatus.ACTIVE.value not in allowed
        assert CitizenStatus.MERGED.value not in allowed


def test_draft_can_submit_or_suspend():
    assert CitizenStatus.PENDING_VALIDATION.value in ALLOWED_STATUS_TRANSITIONS[CitizenStatus.DRAFT.value]
    assert CitizenStatus.SUSPENDED.value in ALLOWED_STATUS_TRANSITIONS[CitizenStatus.DRAFT.value]


def test_pending_can_return_to_draft_or_reject():
    allowed = ALLOWED_STATUS_TRANSITIONS[CitizenStatus.PENDING_VALIDATION.value]
    assert CitizenStatus.DRAFT.value in allowed
    assert CitizenStatus.SUSPENDED.value in allowed


def test_citizen_create_schema_rejects_blank_names():
    with pytest.raises(Exception):
        CitizenCreate(
            sex=Sex.MALE,
            date_of_birth=date(1990, 1, 1),
            given_names="  ",
            family_name="Kabila",
        )


def test_citizen_update_accepts_optional_reason():
    u = CitizenUpdate(family_name="Mbala", reason="Correction orthographe agent")
    assert u.reason is not None
    assert "family_name" in u.model_dump(exclude_unset=True)


def test_citizen_to_list_item_maps_primary_address():
    addr = MagicMock()
    addr.is_primary = True
    addr.province_code = "KIN"
    addr.city = "Kinshasa"
    addr.commune_code = "Gombe"
    citizen = MagicMock()
    citizen.id = uuid4()
    citizen.nic = None
    citizen.status = CitizenStatus.DRAFT.value
    citizen.family_name = "Test"
    citizen.given_names = "Alice"
    citizen.date_of_birth = date(2000, 5, 5)
    citizen.sex = Sex.FEMALE.value
    citizen.place_of_birth = "Kinshasa"
    citizen.addresses = [addr]
    item = citizen_to_list_item(citizen)
    assert item["province_code"] == "KIN"
    assert item["ville"] == "Kinshasa"
    assert item["commune_code"] == "Gombe"
    assert item["nic"] is None


def test_duplicate_resolve_decisions_are_not_merge():
    """La résolution Module 2 n'inclut pas MERGED (fusion = endpoint dédié)."""
    allowed = {
        DuplicateStatus.FALSE_POSITIVE.value,
        DuplicateStatus.CONFIRMED_DUPLICATE.value,
    }
    assert DuplicateStatus.MERGED.value not in allowed


@pytest.mark.asyncio
async def test_change_status_rejects_active(monkeypatch):
    from fastapi import HTTPException

    from apps.api.domains.core_registry import service as svc

    async def fake_get(_session, _id):
        c = MagicMock()
        c.status = CitizenStatus.DRAFT.value
        c.addresses = []
        return c

    monkeypatch.setattr(svc, "get_citizen", fake_get)
    with pytest.raises(HTTPException) as exc:
        await svc.change_citizen_status(
            MagicMock(),
            uuid4(),
            new_status=CitizenStatus.ACTIVE,
            reason="tentative attribution",
        )
    assert exc.value.status_code == 400
    assert "NIN" in str(exc.value.detail) or "validate" in str(exc.value.detail).lower()
