"""Module 3 — transitions enrôlement + catalogue (cahier ONIP)."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.recensement.enrollment_status import (
    assert_transition,
    can_transition,
    enrollment_status_catalog,
)
from apps.api.domains.recensement.models import CensusRecordStatus
from apps.api.domains.recensement.schemas import BatchPromoteRequest, PromoteResult


def test_catalog_module3_flags():
    cat = enrollment_status_catalog()
    assert cat["module"] == 3
    assert cat["offline_nin_forbidden"] is True
    assert cat["auto_merge_forbidden"] is True
    assert "promote" in cat["endpoints"]
    assert "transitions" in cat
    assert CensusRecordStatus.APPROVED.value in cat["transitions"]


def test_cannot_promote_from_draft():
    assert not can_transition(
        CensusRecordStatus.DRAFT.value, CensusRecordStatus.PROMOTED.value
    )
    with pytest.raises(ValueError, match="invalid_transition"):
        assert_transition(
            CensusRecordStatus.DRAFT.value, CensusRecordStatus.PROMOTED.value
        )


def test_approve_paths():
    assert can_transition(CensusRecordStatus.SYNCED.value, CensusRecordStatus.APPROVED.value)
    assert can_transition(CensusRecordStatus.CONFLICT.value, CensusRecordStatus.APPROVED.value)
    assert can_transition(CensusRecordStatus.REJECTED.value, CensusRecordStatus.APPROVED.value)


def test_reject_from_approved_before_promote():
    assert can_transition(
        CensusRecordStatus.APPROVED.value, CensusRecordStatus.REJECTED.value
    )


def test_promoted_is_terminal():
    assert not can_transition(
        CensusRecordStatus.PROMOTED.value, CensusRecordStatus.APPROVED.value
    )


@pytest.mark.asyncio
async def test_approve_uses_transition_guard(monkeypatch):
    from apps.api.domains.recensement import service as svc
    from apps.api.domains.recensement.schemas import RecordReviewRequest

    rec = MagicMock()
    rec.status = CensusRecordStatus.DRAFT
    rec.id = uuid4()

    with pytest.raises(ValueError, match="not_reviewable"):
        await svc.approve_record(
            MagicMock(),
            rec,
            uuid4(),
            RecordReviewRequest(note="x"),
        )


def test_batch_promote_schema_defaults():
    body = BatchPromoteRequest()
    assert body.limit == 50
    assert body.assign_nic is True
    assert "already_promoted" in PromoteResult.model_fields
