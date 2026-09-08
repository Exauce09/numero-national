"""HTTP routes for documents — /api/v1/documents."""

from __future__ import annotations

import base64
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import Principal, require_permissions
from apps.api.db.session import get_db
from apps.api.domains.documents.enums import PERM_DOC_READ, PERM_DOC_WRITE
from apps.api.domains.documents.schemas import (
    DocumentCreate,
    DocumentRead,
    DocumentUpdate,
    HashVerifyRequest,
    HashVerifyResponse,
)
from apps.api.domains.documents import services

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_DOC_WRITE)),
) -> DocumentRead:
    try:
        content = base64.b64decode(body.content_base64)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid base64 content") from exc
    doc = await services.create_document(
        db,
        document_type=body.type,
        content=content,
        institution_id=body.institution_id,
        citizen_id=body.citizen_id,
        version=body.version,
        storage_uri=body.storage_uri,
        status=body.status.value,
        extra_meta=body.meta,
    )
    return DocumentRead.model_validate(doc)


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    citizen_id: UUID | None = None,
    document_type: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_DOC_READ)),
) -> list[DocumentRead]:
    rows = await services.list_documents(
        db, citizen_id=citizen_id, document_type=document_type, limit=limit
    )
    return [DocumentRead.model_validate(r) for r in rows]


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_DOC_READ)),
) -> DocumentRead:
    doc = await services.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentRead.model_validate(doc)


@router.patch("/{document_id}", response_model=DocumentRead)
async def update_document(
    document_id: UUID,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_DOC_WRITE)),
) -> DocumentRead:
    try:
        doc = await services.update_document(
            db,
            document_id,
            status=body.status.value if body.status else None,
            storage_uri=body.storage_uri,
            meta=body.meta,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return DocumentRead.model_validate(doc)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_DOC_WRITE)),
) -> None:
    ok = await services.delete_document(db, document_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")


@router.post("/verify-hash", response_model=HashVerifyResponse)
async def verify_hash(
    body: HashVerifyRequest,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_DOC_READ)),
) -> HashVerifyResponse:
    try:
        result = await services.verify_document_hash(
            db,
            content_base64=body.content_base64,
            expected_hash=body.expected_hash,
            document_id=body.document_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid content: {exc}") from exc
    return HashVerifyResponse(
        match=result["match"],
        computed_hash=result["computed_hash"],
        expected_hash=result.get("expected_hash"),
        document_id=result.get("document_id"),
    )
