"""Module 7 — catalogue, statut, idempotence requête, exceptions audit-only."""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.core_registry.enums import CitizenStatus
from apps.api.domains.core_registry.national_identity_number_service import (
    EVENT_NIN_EXCEPTION,
    OFFICIAL_NIN_FORMAT_CONFIRMED,
    NationalIdentityNumberService,
    nin_catalog,
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


def test_catalog_blocks_official_and_invention():
    cat = nin_catalog()
    assert cat["module"] == 7
    assert cat["official_nin_format_confirmed"] is True
    assert cat["official_generation_enabled"] is True
    assert cat["invent_nin_forbidden"] is True
    assert cat["offline_nin_forbidden"] is True
    assert cat["client_proposed_nin_forbidden"] is True
    assert "status" in cat["endpoints"]
    assert "exceptions" in cat["endpoints"]
    assert OFFICIAL_NIN_FORMAT_CONFIRMED is True


@pytest.mark.asyncio
async def test_evaluate_eligibility_incomplete():
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=0)
    citizen = _citizen(given_names="", family_name="X", date_of_birth=None)
    out = await NationalIdentityNumberService.evaluate_eligibility(session, citizen)
    assert out["eligible_provisional"] is False
    assert "incomplete_dossier" in out["block_codes"]
    assert out["official_assign_available"] is False


@pytest.mark.asyncio
async def test_get_national_id_status_official_when_assigned():
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=0)
    citizen = _citizen(nic="15001119900042")
    out = await NationalIdentityNumberService.get_national_id_status(session, citizen)
    assert out["has_nin"] is True
    assert out["nin"] == "15001119900042"
    assert out["nin_status"] == "OFFICIAL"
    assert out["official"] is True
    assert "already_assigned" in out["block_codes"]


@pytest.mark.asyncio
async def test_assign_with_request_official_idempotent_existing():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    citizen = _citizen(nic="15001119900042")
    out = await NationalIdentityNumberService.assign_with_request(
        session, citizen=citizen, mode="official"
    )
    assert out["nin"] == "15001119900042"
    assert out["official"] is True
    assert out["already_assigned"] is True
    assert out["nin_status"] == "OFFICIAL"


@pytest.mark.asyncio
async def test_assign_with_request_idempotency_key_replay():
    session = AsyncMock()
    citizen = _citizen(nic="15001119900042")
    key = "req-abc-001"
    existing = MagicMock()
    existing.id = uuid4()
    existing.citizen_id = citizen.id
    existing.payload = {
        "idempotency_key": key,
        "outcome": "CONFIRMED",
        "nin": "15001119900042",
        "algorithm_version": "PROVISIONAL-v3-rdc-14-NOT-OFFICIAL",
        "official": False,
        "nin_status": "PROVISIONAL",
        "mode": "provisional",
    }

    async def _find(_s, k):
        assert k == key
        return existing

    orig = NationalIdentityNumberService.find_allocation_by_key
    NationalIdentityNumberService.find_allocation_by_key = staticmethod(_find)  # type: ignore
    try:
        out = await NationalIdentityNumberService.assign_with_request(
            session,
            citizen=citizen,
            mode="provisional",
            idempotency_key=key,
        )
    finally:
        NationalIdentityNumberService.find_allocation_by_key = orig  # type: ignore

    assert out["already_processed"] is True
    assert out["nin"] == "15001119900042"
    assert out["request_id"] == str(existing.id)


@pytest.mark.asyncio
async def test_exception_decision_never_mutates_nic():
    session = AsyncMock()
    citizen_id = uuid4()
    exc_id = uuid4()
    row = MagicMock()
    row.id = exc_id
    row.citizen_id = citizen_id
    row.event_type = EVENT_NIN_EXCEPTION
    row.payload = {
        "exception_type": "MERGE_CONFLICT",
        "status": "PENDING",
        "reason": "Deux dossiers liés",
        "decisions": [],
        "nic_mutated": False,
        "nin_snapshot": "15001119900042",
    }

    session.get = AsyncMock(return_value=row)

    out = await NationalIdentityNumberService.decide_exception(
        session,
        exception_id=exc_id,
        decision="CLOSED",
        motif="Clôture après revue manuelle ONIP",
        actor_id=uuid4(),
    )
    assert out["nic_mutated"] is False
    assert out["status"] == "CLOSED"
    assert row.payload["nic_mutated"] is False
    assert row.payload["status"] == "CLOSED"
