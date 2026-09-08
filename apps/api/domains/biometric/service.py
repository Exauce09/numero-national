"""Biometric matching stubs.

IMPORTANT
---------
Production MUST replace this module with a certified ABIS (Automated Biometric
Identification System). The MVP only compares cryptographic hashes of encrypted
template blobs for deterministic demos — it is NOT a biometric matcher.
Biometric templates are stored exclusively in schema `biometric`, never in
`core_registry.citizens` or any citizens table.
"""

from __future__ import annotations

import base64
import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.biometric.models import (
    BiometricModality,
    BiometricTemplate,
    DedupDecision,
    DedupSession,
    IdentityMedia,
)
from apps.api.domains.biometric.schemas import (
    IdentifyCandidate,
    IdentifyRequest,
    IdentifyResponse,
    MediaRefCreate,
    TemplateEnroll,
    VerifyRequest,
    VerifyResponse,
)

ALGORITHM_VERSION = "mvp-hash-v1"


def _decode_template(template_b64: str) -> bytes:
    return base64.b64decode(template_b64)


def _template_hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _score_hashes(a: str, b: str) -> float:
    """Deterministic stub score: 1.0 exact match, else fractional prefix overlap."""
    if a == b:
        return 1.0
    common = 0
    for x, y in zip(a, b):
        if x == y:
            common += 1
        else:
            break
    return round(common / max(len(a), 1), 4)


async def enroll_template(db: AsyncSession, data: TemplateEnroll) -> BiometricTemplate:
    raw = _decode_template(data.template_b64)
    # "Encryption" placeholder: store raw bytes; KMS envelope encryption comes later.
    row = BiometricTemplate(
        citizen_id=data.citizen_id,
        modality=data.modality,
        template_encrypted=raw,
        quality_score=data.quality_score,
        algorithm_version=data.algorithm_version or ALGORITHM_VERSION,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def verify_1to1(db: AsyncSession, req: VerifyRequest) -> VerifyResponse:
    probe_hash = _template_hash(_decode_template(req.template_b64))
    result = await db.execute(
        select(BiometricTemplate).where(
            BiometricTemplate.citizen_id == req.citizen_id,
            BiometricTemplate.modality == req.modality,
        )
    )
    templates = list(result.scalars().all())
    best = 0.0
    for t in templates:
        best = max(best, _score_hashes(probe_hash, _template_hash(bytes(t.template_encrypted))))
    return VerifyResponse(
        matched=best >= 0.99,
        score=best,
        algorithm_version=ALGORITHM_VERSION,
    )


async def identify_1to_n(db: AsyncSession, req: IdentifyRequest) -> IdentifyResponse:
    probe_hash = _template_hash(_decode_template(req.template_b64))
    result = await db.execute(
        select(BiometricTemplate).where(BiometricTemplate.modality == req.modality)
    )
    gallery = list(result.scalars().all())
    scored: list[IdentifyCandidate] = []
    for t in gallery:
        score = _score_hashes(probe_hash, _template_hash(bytes(t.template_encrypted)))
        if score >= 0.5:
            scored.append(
                IdentifyCandidate(citizen_id=t.citizen_id, template_id=t.id, score=score)
            )
    scored.sort(key=lambda c: c.score, reverse=True)
    scored = scored[: req.max_candidates]

    if scored and scored[0].score >= 0.99:
        decision = DedupDecision.MATCH_CONFIRMED
    elif scored and scored[0].score >= 0.7:
        decision = DedupDecision.MANUAL_REVIEW
    else:
        decision = DedupDecision.NO_MATCH

    session = DedupSession(
        probe_citizen_id=None,
        modality=req.modality,
        candidates=[c.model_dump(mode="json") for c in scored],
        scores=[c.score for c in scored],
        decision=decision,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return IdentifyResponse(
        candidates=scored,
        decision=decision,
        session_id=session.id,
    )


async def register_media(db: AsyncSession, data: MediaRefCreate) -> IdentityMedia:
    row = IdentityMedia(
        citizen_id=data.citizen_id,
        media_type=data.media_type,
        storage_uri=data.storage_uri,
        content_hash=data.content_hash,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def get_dedup_session(db: AsyncSession, session_id: uuid.UUID) -> DedupSession | None:
    return await db.get(DedupSession, session_id)
