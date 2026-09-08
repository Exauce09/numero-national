"""Document create / hash / signature services."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import get_settings
from apps.api.domains.documents.enums import DocumentStatus
from apps.api.domains.documents.models import Document


def _hash_content(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _sign_hash(content_hash: str, document_id: uuid.UUID) -> str:
    key = get_settings().secret_key.encode("utf-8")
    msg = f"{document_id}:{content_hash}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def _doc_qr(document_id: uuid.UUID, content_hash: str, version: int) -> dict[str, Any]:
    body = {
        "document_id": str(document_id),
        "version": version,
        "content_hash": content_hash,
    }
    canonical = json.dumps(body, separators=(",", ":"), sort_keys=True)
    sig = hmac.new(
        get_settings().secret_key.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {**body, "sig": sig}


async def create_document(
    db: AsyncSession,
    *,
    document_type: str,
    content: bytes,
    institution_id: uuid.UUID | None = None,
    citizen_id: uuid.UUID | None = None,
    version: int = 1,
    storage_uri: str | None = None,
    status: str = DocumentStatus.ISSUED.value,
    extra_meta: dict[str, Any] | None = None,
) -> Document:
    document_id = uuid.uuid4()
    content_hash = _hash_content(content)
    signature = _sign_hash(content_hash, document_id)
    qr = _doc_qr(document_id, content_hash, version)
    uri = storage_uri or f"memory://documents/{document_id}"
    doc = Document(
        document_id=document_id,
        type=document_type,
        version=version,
        institution_id=institution_id,
        citizen_id=citizen_id,
        status=status,
        content_hash=content_hash,
        signature=signature,
        qr_payload=qr,
        storage_uri=uri,
        meta=extra_meta,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def get_document(db: AsyncSession, document_id: uuid.UUID) -> Document | None:
    return await db.get(Document, document_id)


async def list_documents(
    db: AsyncSession,
    *,
    citizen_id: uuid.UUID | None = None,
    document_type: str | None = None,
    limit: int = 50,
) -> list[Document]:
    stmt = select(Document).order_by(Document.created_at.desc()).limit(limit)
    if citizen_id:
        stmt = stmt.where(Document.citizen_id == citizen_id)
    if document_type:
        stmt = stmt.where(Document.type == document_type)
    return list((await db.execute(stmt)).scalars().all())


async def update_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    *,
    status: str | None = None,
    storage_uri: str | None = None,
    meta: dict[str, Any] | None = None,
) -> Document:
    doc = await get_document(db, document_id)
    if doc is None:
        raise ValueError("Document not found")
    if status is not None:
        doc.status = status
    if storage_uri is not None:
        doc.storage_uri = storage_uri
    if meta is not None:
        doc.meta = meta
    await db.commit()
    await db.refresh(doc)
    return doc


async def delete_document(db: AsyncSession, document_id: uuid.UUID) -> bool:
    """Soft-delete via REVOKED status (preserve audit trail)."""
    doc = await get_document(db, document_id)
    if doc is None:
        return False
    doc.status = DocumentStatus.REVOKED.value
    await db.commit()
    return True


def verify_content_hash(content: bytes, expected_hash: str) -> tuple[bool, str]:
    computed = _hash_content(content)
    return hmac.compare_digest(computed, expected_hash), computed


async def verify_document_hash(
    db: AsyncSession,
    *,
    content_base64: str,
    expected_hash: str | None = None,
    document_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    content = base64.b64decode(content_base64)
    computed = _hash_content(content)
    expected = expected_hash
    if document_id is not None:
        doc = await get_document(db, document_id)
        if doc is None:
            raise ValueError("Document not found")
        expected = doc.content_hash
        # Also check signature integrity
        expected_sig = _sign_hash(doc.content_hash, doc.document_id)
        if not hmac.compare_digest(expected_sig, doc.signature):
            return {
                "match": False,
                "computed_hash": computed,
                "expected_hash": expected,
                "document_id": document_id,
                "signature_valid": False,
            }
    if expected is None:
        raise ValueError("expected_hash or document_id required")
    match = hmac.compare_digest(computed, expected)
    return {
        "match": match,
        "computed_hash": computed,
        "expected_hash": expected,
        "document_id": document_id,
    }
