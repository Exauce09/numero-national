"""Biometric enrollment + 1:N dedup — unit coverage (LocalHashProvider + schemas)."""

from __future__ import annotations

import base64
from uuid import uuid4

from apps.api.domains.biometric.provider import LocalHashProvider
from apps.api.domains.biometric.schemas import CaptureFingerResponse, TemplateOut


def test_local_provider_same_sample_scores_one():
    p = LocalHashProvider()
    raw = b"FINGERPRINT|demo-print-A|INDEX_DROIT|v1"
    t = p.generate_template(p.extract_features(raw))
    h = p.template_hash(t)
    assert p.compare(h, h) == 1.0


def test_local_provider_different_samples_below_strong():
    p = LocalHashProvider()
    a = p.template_hash(p.generate_template(b"FINGERPRINT|demo-print-A|INDEX_DROIT|v1"))
    b = p.template_hash(p.generate_template(b"FINGERPRINT|demo-print-B|INDEX_DROIT|v1"))
    assert a != b
    assert p.compare(a, b) < 0.90


def test_encrypt_roundtrip_never_plain_equality_required():
    p = LocalHashProvider()
    plain = b"FINGERPRINT|demo-print-A|POUCE_DROIT|v1"
    enc = p.encrypt_template(plain)
    assert enc != plain
    assert p.decrypt_template(enc) == plain


def test_template_out_has_no_encrypted_field():
    fields = set(TemplateOut.model_fields.keys())
    assert "template_encrypted" not in fields
    assert "template_b64" not in fields
    assert "template_hash" not in fields


def test_capture_response_blocks_without_storing_hint():
    """Contract: blocked capture exposes match metadata, not templates."""
    from datetime import UTC, datetime

    from apps.api.domains.biometric.models import DedupDecision, MatchDecision
    from apps.api.domains.biometric.schemas import MatchOut

    cid = uuid4()
    mid = uuid4()
    res = CaptureFingerResponse(
        accepted=False,
        blocked=True,
        decision=DedupDecision.MATCH_CONFIRMED,
        finger_position="INDEX_DROIT",
        quality_score=95,
        message="Correspondance biométrique trouvée.",
        enrollment_id=uuid4(),
        fingerprints_count=0,
        required_fingers=3,
        candidates=[],
        match=MatchOut(
            id=mid,
            matched_citizen_id=cid,
            match_score=0.987,
            threshold_used=0.9,
            decision=MatchDecision.STRONG_MATCH,
            review_status="PENDING",
            created_at=datetime.now(UTC),
        ),
    )
    dumped = res.model_dump()
    assert "template_encrypted" not in dumped
    assert dumped["blocked"] is True
    assert dumped["accepted"] is False
    assert dumped["match"]["match_score"] == 0.987


def test_demo_sample_encoding_stable():
    """Same DEMO sample key + finger → same probe bytes (dedup demonstrable)."""
    text = "FINGERPRINT|demo-print-A|INDEX_DROIT|v1"
    b64 = base64.b64encode(text.encode()).decode()
    assert base64.b64decode(b64) == text.encode()
