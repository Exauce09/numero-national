"""Legacy biometric helpers — prefer enrollment_service for 3-finger enroll."""

from __future__ import annotations

import base64
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.audit.services import write_audit
from apps.api.domains.biometric.models import (
    BiometricModality,
    BiometricTemplate,
    DedupDecision,
    DedupSession,
    FingerprintStatus,
    IdentityMedia,
)
from apps.api.domains.biometric.provider import get_biometric_provider
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


async def enroll_template(
    db: AsyncSession,
    data: TemplateEnroll,
    *,
    actor_id: uuid.UUID | None = None,
) -> BiometricTemplate:
    provider = get_biometric_provider()
    raw = base64.b64decode(data.template_b64)
    template = provider.generate_template(provider.extract_features(raw))
    row = BiometricTemplate(
        citizen_id=data.citizen_id,
        modality=data.modality,
        template_encrypted=provider.encrypt_template(template),
        quality_score=data.quality_score,
        algorithm_version=data.algorithm_version or ALGORITHM_VERSION,
        finger_position=data.finger_position,
        status=FingerprintStatus.ACTIVE,
        template_hash=provider.template_hash(template),
    )
    db.add(row)
    await write_audit(
        db,
        action="BIOMETRIC_TEMPLATE_CREATED",
        actor_id=actor_id,
        resource_type="biometric_template",
        resource_id=str(data.citizen_id),
        new_value={"finger": data.finger_position, "modality": data.modality.value},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def verify_1to1(db: AsyncSession, req: VerifyRequest) -> VerifyResponse:
    provider = get_biometric_provider()
    probe_hash = provider.template_hash(
        provider.generate_template(provider.extract_features(base64.b64decode(req.template_b64)))
    )
    result = await db.execute(
        select(BiometricTemplate).where(
            BiometricTemplate.citizen_id == req.citizen_id,
            BiometricTemplate.modality == req.modality,
            BiometricTemplate.status == FingerprintStatus.ACTIVE,
        )
    )
    templates = list(result.scalars().all())
    best = 0.0
    for t in templates:
        gh = t.template_hash or provider.template_hash(
            provider.decrypt_template(bytes(t.template_encrypted))
        )
        best = max(best, provider.compare(probe_hash, gh))
    return VerifyResponse(
        matched=best >= 0.99,
        score=best,
        algorithm_version=ALGORITHM_VERSION,
    )


async def identify_1to_n(db: AsyncSession, req: IdentifyRequest) -> IdentifyResponse:
    from apps.api.domains.biometric import enrollment_service as enroll

    return await enroll.identify(db, req, actor_id=None)


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
