"""Module 12 — catalogue, garde-fous NIN, transitions, MAJ FGP conditionnelle."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.population_movements.schemas import (
    MovementApproveIn,
    MovementCreate,
    MovementReviewIn,
)
from apps.api.domains.population_movements.service import (
    MovementError,
    _apply_fgp_residence,
    approve_movement,
    create_movement,
    movements_catalog,
    review_movement,
    submit_movement,
)


def test_catalog_forbids_nin_and_gps():
    cat = movements_catalog()
    assert cat["module"] == 12
    assert cat["invent_nin_forbidden"] is True
    assert cat["modify_nin_forbidden"] is True
    assert cat["parallel_identity_forbidden"] is True
    assert cat["gps_tracking_forbidden"] is True
    assert cat["auto_pdi_inference_forbidden"] is True
    assert cat["fgp_residence_only_after_validation"] is True
    assert "create" in cat["endpoints"]
    assert any(t["code"] == "CHANGE_OF_RESIDENCE" for t in cat["movement_types"])


def test_nin_payload_forbidden():
    from apps.api.domains.population_movements.service import _forbid_nin_payload

    with pytest.raises(MovementError) as exc:
        _forbid_nin_payload({"nin": "12345678901234"})
    assert exc.value.code == "nin_forbidden"

    with pytest.raises(MovementError) as exc2:
        _forbid_nin_payload({"national_id": "X"})
    assert exc2.value.code == "nin_forbidden"

    _forbid_nin_payload({"destination_city": "Kinshasa"})


@pytest.mark.asyncio
async def test_create_rejects_missing_citizen():
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    with pytest.raises(MovementError) as exc:
        await create_movement(
            db,
            MovementCreate(
                citizen_id=uuid4(),
                movement_type="CHANGE_OF_RESIDENCE",
            ),
            actor_id=uuid4(),
        )
    assert exc.value.code == "citizen_not_found"


@pytest.mark.asyncio
async def test_create_and_submit_happy_path():
    citizen_id = uuid4()
    actor = uuid4()
    citizen = SimpleNamespace(id=citizen_id, status="ACTIVE")

    added: list = []

    class _DB:
        def __init__(self):
            self._row = None

        async def get(self, model, pk):
            if model.__name__ == "Citizen":
                return citizen
            return self._row

        def add(self, obj):
            added.append(obj)
            if hasattr(obj, "citizen_id") and hasattr(obj, "movement_type"):
                if getattr(obj, "id", None) is None:
                    obj.id = uuid4()
                self._row = obj

        async def flush(self):
            return None

        async def scalar(self, *_a, **_k):
            return None

        async def scalars(self, *_a, **_k):
            m = MagicMock()
            m.all = MagicMock(return_value=[])
            return m

    db = _DB()
    out = await create_movement(
        db,
        MovementCreate(
            citizen_id=citizen_id,
            movement_type="CHANGE_OF_RESIDENCE",
            destination_city="Kinshasa",
            destination_line1="Av. Liberation 12",
            destination_province_code="KIN",
            update_fgp_residence=True,
            submit=False,
            idempotency_key="mv-test-1",
        ),
        actor_id=actor,
    )
    assert out.status == "DRAFT"
    assert out.update_fgp_residence is True
    assert out.fgp_residence_applied is False

    # Attach row for submit
    db._row.status = "DRAFT"
    submitted = await submit_movement(db, db._row.id, actor_id=actor)
    assert submitted.status == "SUBMITTED"


@pytest.mark.asyncio
async def test_temporary_mobility_never_updates_fgp_flag():
    citizen_id = uuid4()
    citizen = SimpleNamespace(id=citizen_id, status="ACTIVE")

    class _DB:
        def __init__(self):
            self._row = None

        async def get(self, model, pk):
            if model.__name__ == "Citizen":
                return citizen
            return self._row

        def add(self, obj):
            if hasattr(obj, "movement_type"):
                obj.id = uuid4()
                self._row = obj

        async def flush(self):
            return None

        async def scalar(self, *_a, **_k):
            return None

        async def scalars(self, *_a, **_k):
            m = MagicMock()
            m.all = MagicMock(return_value=[])
            return m

    db = _DB()
    out = await create_movement(
        db,
        MovementCreate(
            citizen_id=citizen_id,
            movement_type="TEMPORARY_MOBILITY",
            update_fgp_residence=True,
        ),
        actor_id=uuid4(),
    )
    assert out.update_fgp_residence is False


@pytest.mark.asyncio
async def test_forced_displacement_blocks_fgp_on_approve():
    movement_id = uuid4()
    actor = uuid4()
    row = SimpleNamespace(
        id=movement_id,
        citizen_id=uuid4(),
        movement_type="FORCED_DISPLACEMENT",
        status="IN_REVIEW",
        created_by=uuid4(),
        sensitivity_class="RESTRICTED",
        update_fgp_residence=False,
        fgp_residence_applied=False,
        version=1,
        validated_by=None,
        verified_at=None,
        decision_reason=None,
        reviewed_by=None,
        updated_at=None,
        notes_minimal=None,
        declared_at=datetime.now(UTC),
        observed_date=None,
        effective_date=None,
        source_type="AGENT",
        source_reference=None,
        reason_code=None,
        origin_province_code=None,
        origin_commune_code=None,
        origin_label=None,
        destination_province_code=None,
        destination_commune_code=None,
        destination_city="Goma",
        destination_line1="Camp X",
        destination_label=None,
        created_at=datetime.now(UTC),
    )

    class _DB:
        async def get(self, model, pk):
            return row

        def add(self, obj):
            return None

        async def scalars(self, *_a, **_k):
            m = MagicMock()
            m.all = MagicMock(return_value=[])
            return m

    db = _DB()
    with pytest.raises(MovementError) as exc:
        await approve_movement(
            db,
            movement_id,
            MovementApproveIn(apply_fgp_residence=True, reason="essai PDI"),
            actor_id=actor,
        )
    assert exc.value.code == "fgp_update_forbidden_for_type"


@pytest.mark.asyncio
async def test_review_reject_from_in_review():
    movement_id = uuid4()
    row = SimpleNamespace(
        id=movement_id,
        status="IN_REVIEW",
        version=1,
        decision_reason=None,
        reviewed_by=None,
        verified_at=None,
        updated_at=None,
        citizen_id=uuid4(),
        movement_type="INTERNAL_MIGRATION",
        declared_at=datetime.now(UTC),
        observed_date=None,
        effective_date=None,
        source_type="AGENT",
        source_reference=None,
        reason_code=None,
        notes_minimal=None,
        origin_province_code=None,
        origin_commune_code=None,
        origin_label=None,
        destination_province_code=None,
        destination_commune_code=None,
        destination_city=None,
        destination_line1=None,
        destination_label=None,
        sensitivity_class="STANDARD",
        update_fgp_residence=False,
        fgp_residence_applied=False,
        created_by=None,
        validated_by=None,
        created_at=datetime.now(UTC),
    )

    class _DB:
        async def get(self, model, pk):
            return row

        def add(self, obj):
            return None

        async def scalars(self, *_a, **_k):
            m = MagicMock()
            m.all = MagicMock(return_value=[])
            return m

    out = await review_movement(
        _DB(),
        movement_id,
        MovementReviewIn(decision="REJECTED", reason="Dossier incomplet et incohérent"),
        actor_id=uuid4(),
    )
    assert out.status == "REJECTED"
    assert row.decision_reason is not None


@pytest.mark.asyncio
async def test_apply_fgp_requires_destination():
    row = SimpleNamespace(
        id=uuid4(),
        citizen_id=uuid4(),
        destination_line1=None,
        destination_city=None,
        destination_label=None,
        destination_commune_code=None,
        destination_province_code=None,
        effective_date=None,
        fgp_residence_applied=False,
    )
    with pytest.raises(MovementError) as exc:
        await _apply_fgp_residence(AsyncMock(), row, actor_id=uuid4())
    assert exc.value.code == "destination_incomplete"
