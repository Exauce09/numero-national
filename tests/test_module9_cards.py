"""Module 9 — catalogue CIN, demandes, lots bloqués, vol stub."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.cards import request_store as rs
from apps.api.domains.cards.services import (
    CardEligibilityError,
    approve_request_for_production,
    assert_cin_eligibility,
    cards_catalog,
    create_card_request,
    create_production_batch,
    evaluate_cin_eligibility,
)


@pytest.fixture(autouse=True)
def _clean():
    rs.reset_store()
    yield
    rs.reset_store()


def test_catalog_prototype_and_no_nin():
    cat = cards_catalog()
    assert cat["module"] == 9
    assert cat["invent_nin_forbidden"] is True
    assert cat["cin_generates_nin_forbidden"] is True
    assert cat["prototype_template_only"] is True
    assert cat["template_approved"] is False
    assert cat["official_mrz_forbidden"] is True
    assert cat["official_nin_format_confirmed"] is False
    assert "card_requests" in cat["endpoints"]


@pytest.mark.asyncio
async def test_evaluate_eligibility_without_nic():
    db = AsyncMock()
    citizen = SimpleNamespace(
        id=uuid4(),
        nic=None,
        status="ACTIVE",
        addresses=[],
        family_name="X",
        given_names="Y",
        date_of_birth=None,
        sex="MALE",
        place_of_birth=None,
    )

    async def _load(_db, _cid):
        return citizen

    async def _active(_db, _cid):
        return None

    import apps.api.domains.cards.services as svc

    orig_load = svc.load_citizen_with_addresses
    orig_active = svc.get_active_card_for_citizen
    svc.load_citizen_with_addresses = _load  # type: ignore
    svc.get_active_card_for_citizen = _active  # type: ignore
    try:
        out = await evaluate_cin_eligibility(db, citizen.id)
    finally:
        svc.load_citizen_with_addresses = orig_load  # type: ignore
        svc.get_active_card_for_citizen = orig_active  # type: ignore

    assert out["admissible"] is False
    assert "nic_required" in out["codes"] or "NIN_NON_CONFIRME" in out["codes"]
    assert out["production_allowed"] is False
    assert out["official_nin_confirmed"] is False


@pytest.mark.asyncio
async def test_create_request_idempotent():
    db = AsyncMock()
    cid = uuid4()
    citizen = SimpleNamespace(
        id=cid,
        nic="15001119900042",
        status="ACTIVE",
        addresses=[],
        family_name="Kabila",
        given_names="Jean",
        date_of_birth=None,
        sex="MALE",
        place_of_birth=None,
    )

    import apps.api.domains.cards.services as svc

    async def _load(_db, _cid):
        return citizen

    async def _active(_db, _cid):
        return None

    orig_load = svc.load_citizen_with_addresses
    orig_active = svc.get_active_card_for_citizen
    svc.load_citizen_with_addresses = _load  # type: ignore
    svc.get_active_card_for_citizen = _active  # type: ignore
    try:
        r1 = await create_card_request(
            db, citizen_id=cid, request_type="FIRST_ISSUE", idempotency_key="k-1"
        )
        r2 = await create_card_request(
            db, citizen_id=cid, request_type="FIRST_ISSUE", idempotency_key="k-1"
        )
    finally:
        svc.load_citizen_with_addresses = orig_load  # type: ignore
        svc.get_active_card_for_citizen = orig_active  # type: ignore

    assert r1["status"] == "ADMISSIBLE"
    assert r1["nin_generated_by_cin"] is False
    assert r2["already_processed"] is True
    assert r1["id"] == r2["id"]


@pytest.mark.asyncio
async def test_approve_production_blocked_without_template():
    row = rs.save_request(
        {
            "id": rs.new_id(),
            "citizen_id": str(uuid4()),
            "request_type": "FIRST_ISSUE",
            "status": "ADMISSIBLE",
            "idempotency_key": None,
        }
    )
    with pytest.raises(CardEligibilityError) as exc:
        await approve_request_for_production(row["id"], motif="Production test pilote")
    assert exc.value.code == "template_not_approved"


@pytest.mark.asyncio
async def test_batch_creation_blocked():
    with pytest.raises(CardEligibilityError) as exc:
        await create_production_batch(request_ids=["any"])
    assert exc.value.code == "template_not_approved"


@pytest.mark.asyncio
async def test_assert_still_requires_nic():
    with pytest.raises(CardEligibilityError) as exc:
        await assert_cin_eligibility(SimpleNamespace(id=uuid4(), nic=None, status="ACTIVE"))
    assert exc.value.code == "nic_required"
