"""Module 5 FGP — catalogue, santé, idempotence événements, rectification."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from apps.api.domains.fgp.schemas import FgpCorrectionIn, FgpEventIn
from apps.api.domains.fgp.service import (
    _idempotency_key,
    fgp_catalog,
    ingest_event,
    request_correction,
)


def test_catalog_forbids_invented_nin():
    cat = fgp_catalog()
    assert cat.module == 5
    assert cat.offline_nin_forbidden is True
    assert cat.invent_nin_forbidden is True
    assert cat.auto_merge_forbidden is True
    assert "health" in cat.endpoints


def test_idempotency_key_stable():
    assert _idempotency_key("Census", "EVT-1") == _idempotency_key("census", "EVT-1")


@pytest.mark.asyncio
async def test_ingest_event_idempotent():
    citizen_id = uuid4()
    existing = MagicMock()
    existing.id = uuid4()
    existing.created_at = None

    db = AsyncMock()
    citizen = MagicMock()
    db.get = AsyncMock(return_value=citizen)

    data = FgpEventIn(
        source="census",
        source_event_id="LOT-42",
        citizen_id=citizen_id,
        event_type="ADDRESS_UPDATE",
        payload={"line1": "Av. test"},
    )

    with patch(
        "apps.api.domains.fgp.service.find_existing_event",
        new=AsyncMock(return_value=existing),
    ):
        out = await ingest_event(db, data, actor_id=None)

    assert out.already_processed is True
    assert "idempotence" in out.message.lower() or "déjà" in out.message.lower()
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_ingest_event_creates_without_nin():
    citizen_id = uuid4()
    db = AsyncMock()
    db.get = AsyncMock(return_value=MagicMock())
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    data = FgpEventIn(
        source="civil",
        source_event_id="ACT-99",
        citizen_id=citizen_id,
        event_type="BIRTH_REF",
        effective_date=date(2020, 1, 1),
    )

    with patch(
        "apps.api.domains.fgp.service.find_existing_event",
        new=AsyncMock(return_value=None),
    ), patch("apps.api.domains.audit.services.write_audit", new=AsyncMock()):
        out = await ingest_event(db, data, actor_id=uuid4())

    assert out.already_processed is False
    assert "NIN" in out.message
    assert db.add.called


@pytest.mark.asyncio
async def test_correction_not_auto_applied():
    citizen_id = uuid4()
    citizen = MagicMock()
    citizen.family_name = "Ancien"
    db = AsyncMock()
    db.get = AsyncMock(return_value=citizen)
    db.commit = AsyncMock()

    async def _refresh(obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid4()

    db.refresh = AsyncMock(side_effect=_refresh)

    out = await request_correction(
        db,
        FgpCorrectionIn(
            citizen_id=citizen_id,
            field_name="family_name",
            proposed_value="Nouveau",
            reason="Erreur orthographe agent",
        ),
    )
    assert out.status == "REQUESTED"
    assert "après" in out.message.lower() or "decision" in out.message.lower() or "décision" in out.message.lower()
    # Ne doit pas muter le citoyen
    assert citizen.family_name == "Ancien"
