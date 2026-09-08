"""Smoke tests for Phase 5 QR signing (no DB required)."""

from uuid import uuid4

from apps.api.domains.cards.qr import build_qr_payload, verify_qr_signature
from apps.api.domains.documents.services import _hash_content, _sign_hash


def test_qr_payload_has_no_pii_fields():
    payload = build_qr_payload(uuid4(), 2)
    assert set(payload.keys()) == {"card_id", "version", "nonce", "kid", "sig"}
    assert "nic" not in payload
    assert "name" not in payload
    assert verify_qr_signature(payload) is True


def test_qr_tamper_fails():
    payload = build_qr_payload(uuid4(), 1)
    payload["version"] = 99
    assert verify_qr_signature(payload) is False


def test_document_hash_stable():
    content = b"acte-naissance-demo"
    h1 = _hash_content(content)
    h2 = _hash_content(content)
    assert h1 == h2
    doc_id = uuid4()
    sig = _sign_hash(h1, doc_id)
    assert len(sig) == 64
