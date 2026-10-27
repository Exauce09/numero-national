"""Module 8 — catalogue, idempotence, source refusée, quarantaine, matching."""

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from apps.api.domains.civil_interconnect import store
from apps.api.domains.civil_interconnect.schemas import CivilEventIn, MatchingDecisionIn
from apps.api.domains.civil_interconnect.service import (
    CivilInterconnectError,
    civil_catalog,
    decide_matching,
    get_status,
    ingest_event,
)


@pytest.fixture(autouse=True)
def _clean_store():
    store.reset_store()
    yield
    store.reset_store()


def test_catalog_forbids_nin_and_overwrite():
    cat = civil_catalog()
    assert cat["module"] == 8
    assert cat["invent_nin_forbidden"] is True
    assert cat["silent_overwrite_forbidden"] is True
    assert cat["last_message_wins_forbidden"] is True
    assert cat["census_to_act_forbidden"] is True
    assert cat["technical_ack_distinct_from_applied"] is True
    assert "ingest" in cat["endpoints"]


@pytest.mark.asyncio
async def test_unknown_source_refused():
    db = AsyncMock()
    with pytest.raises(CivilInterconnectError) as exc:
        await ingest_event(
            db,
            CivilEventIn(
                source_id="UNKNOWN_X",
                source_event_id="e1",
                event_type="BIRTH",
            ),
        )
    assert exc.value.code == "unknown_source"
    assert exc.value.http_status == 403


@pytest.mark.asyncio
async def test_revoked_source_refused():
    db = AsyncMock()
    with pytest.raises(CivilInterconnectError) as exc:
        await ingest_event(
            db,
            CivilEventIn(
                source_id="EC_REVOKED",
                source_event_id="e1",
                event_type="BIRTH",
            ),
        )
    assert exc.value.code == "revoked_source"


@pytest.mark.asyncio
async def test_client_proposed_nin_forbidden():
    db = AsyncMock()
    with pytest.raises(CivilInterconnectError) as exc:
        await ingest_event(
            db,
            CivilEventIn(
                source_id="EC_KINSHASA",
                source_event_id="e-nin",
                event_type="BIRTH",
                payload={"nin": "12345678901234"},
            ),
        )
    assert exc.value.code == "client_proposed_nin_forbidden"


@pytest.mark.asyncio
async def test_idempotent_replay_same_payload():
    db = AsyncMock()
    body = CivilEventIn(
        source_id="EC_KINSHASA",
        source_event_id="birth-001",
        event_type="BIRTH",
        citizen_id=uuid4(),
        act_reference="ACT-B-1",
        payload={"child_family_name": "Test"},
    )
    a1 = await ingest_event(db, body)
    a2 = await ingest_event(db, body)
    assert a1.already_processed is False
    assert a2.already_processed is True
    assert a1.id == a2.id
    assert a2.business_applied is False
    assert a1.technical_ack is True


@pytest.mark.asyncio
async def test_payload_conflict_quarantines():
    db = AsyncMock()
    cid = uuid4()
    await ingest_event(
        db,
        CivilEventIn(
            source_id="EC_KINSHASA",
            source_event_id="death-9",
            event_type="DEATH",
            citizen_id=cid,
            payload={"a": 1},
        ),
    )
    ack = await ingest_event(
        db,
        CivilEventIn(
            source_id="EC_KINSHASA",
            source_event_id="death-9",
            event_type="DEATH",
            citizen_id=cid,
            payload={"a": 2},
        ),
    )
    assert ack.processing_status == "QUARANTINED"
    st = get_status(ack.id)
    assert st.processing_status == "QUARANTINED"
    assert st.business_applied is False


@pytest.mark.asyncio
async def test_ambiguous_goes_to_match_review():
    db = AsyncMock()
    ack = await ingest_event(
        db,
        CivilEventIn(
            source_id="EC_KINSHASA",
            source_event_id="amb-1",
            event_type="MARRIAGE",
            candidate_citizen_ids=[uuid4(), uuid4()],
            payload={},
        ),
    )
    assert ack.processing_status == "MATCH_REVIEW"
    assert ack.business_applied is False
    cases = store.list_matching()
    assert len(cases) == 1


@pytest.mark.asyncio
async def test_matching_quarantine_decision_no_nin_mutate():
    db = AsyncMock()
    ack = await ingest_event(
        db,
        CivilEventIn(
            source_id="EC_KINSHASA",
            source_event_id="amb-2",
            event_type="DIVORCE",
            payload={},
        ),
    )
    case = store.list_matching()[0]
    out = await decide_matching(
        db,
        case["id"],
        MatchingDecisionIn(decision="QUARANTINE", motif="Revue manuelle requise ONIP"),
        actor_id=uuid4(),
    )
    assert out["nin_mutated"] is False
    assert out["processing_status"] == "QUARANTINED"
    assert get_status(ack.id).processing_status == "QUARANTINED"
