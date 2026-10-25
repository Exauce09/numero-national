"""Module 6 — catalogue, revue dédup, legacy templates, match_to_out."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.biometric.enrollment_service import biometric_catalog, match_to_out
from apps.api.domains.biometric.models import EnrollmentStatus, MatchDecision
from apps.api.domains.biometric.schemas import MatchOut, MatchReviewRequest, TemplateEnroll, TemplateOut


def test_catalog_forbids_auto_merge_fraud_nin():
    cat = biometric_catalog()
    assert cat["module"] == 6
    assert cat["auto_merge_forbidden"] is True
    assert cat["auto_fraud_forbidden"] is True
    assert cat["offline_nin_forbidden"] is True
    assert cat["invent_nin_forbidden"] is True
    assert cat["raw_templates_in_api_forbidden"] is True
    assert "dedup_pending" in cat["endpoints"]


def test_template_out_never_exposes_bytes():
    fields = set(TemplateOut.model_fields.keys())
    assert "template_encrypted" not in fields
    assert "template_b64" not in fields
    assert "template_hash" not in fields


def test_legacy_enroll_requires_ack_fields():
    body = TemplateEnroll(
        citizen_id=uuid4(),
        template_b64="YWJjZGVmZ2g=",  # min length
    )
    assert body.skip_dedup_ack is False


def test_match_to_out_includes_source_context():
    row = MagicMock()
    row.id = uuid4()
    row.matched_citizen_id = uuid4()
    row.source_citizen_id = uuid4()
    row.enrollment_id = uuid4()
    row.match_score = 0.85
    row.threshold_used = 0.7
    row.decision = MatchDecision.REVIEW
    row.finger_position = "INDEX_DROIT"
    row.review_status = "PENDING"
    row.created_at = datetime.now(UTC)
    out = match_to_out(row)
    assert isinstance(out, MatchOut)
    assert out.source_citizen_id == row.source_citizen_id
    assert out.enrollment_id == row.enrollment_id
    assert out.engine_version is not None
    dumped = out.model_dump()
    assert "template" not in str(dumped).lower() or "engine" in dumped


@pytest.mark.asyncio
async def test_review_match_reopens_blocked_enrollment():
    from apps.api.domains.biometric import enrollment_service as svc

    match_id = uuid4()
    enrollment_id = uuid4()
    match = MagicMock()
    match.id = match_id
    match.enrollment_id = enrollment_id
    match.decision = MatchDecision.REVIEW
    match.review_status = "PENDING"

    enrollment = MagicMock()
    enrollment.id = enrollment_id
    enrollment.status = EnrollmentStatus.BLOCKED

    db = AsyncMock()

    async def _get(model, oid):
        if oid == match_id:
            return match
        if oid == enrollment_id:
            return enrollment
        return None

    db.get = AsyncMock(side_effect=_get)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    # patch write_audit
    async def _audit(*_a, **_k):
        return None

    import apps.api.domains.biometric.enrollment_service as mod

    orig = mod.write_audit
    mod.write_audit = _audit  # type: ignore
    try:
        out = await svc.review_match(
            db,
            match_id,
            MatchReviewRequest(approve_exception=True, reason="Personnes distinctes justifiées"),
            actor_id=uuid4(),
        )
    finally:
        mod.write_audit = orig  # type: ignore

    assert out.review_status == "APPROVED"
    assert enrollment.status == EnrollmentStatus.OPEN
