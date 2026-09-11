"""Biometric routes — `/api/v1/biometric` (RBAC + enrollment 3 fingers + 1:N)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_BIOMETRIC_ENROLL,
    PERM_BIOMETRIC_MATCH,
    Principal,
    require_permissions,
)
from apps.api.core.security import get_current_user
from apps.api.db.session import get_db
from apps.api.domains.biometric import enrollment_service as enroll
from apps.api.domains.biometric import service
from apps.api.domains.biometric.models import BiometricEnrollment, BiometricTemplate, FingerprintStatus
from apps.api.domains.biometric.schemas import (
    CaptureFingerRequest,
    CaptureFingerResponse,
    DedupSessionOut,
    EnrollmentCreate,
    EnrollmentOut,
    FingerprintListItem,
    IdentifyRequest,
    IdentifyResponse,
    MatchReviewRequest,
    MatchOut,
    MediaRefCreate,
    MediaRefOut,
    RevokeRequest,
    StatsOut,
    TemplateEnroll,
    TemplateOut,
    ThresholdOut,
    VerifyRequest,
    VerifyResponse,
)
from apps.api.domains.identity.models import User

# Optional review permission (falls back to match for ONIP/admins)
PERM_BIOMETRIC_REVIEW = "biometric:review"

router = APIRouter(prefix="/biometric", tags=["biometric"])


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def enroll_template(
    body: TemplateEnroll,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> TemplateOut:
    """Legacy single-template enroll — prefer /enrollments + capture."""
    row = await service.enroll_template(db, body, actor_id=principal.actor_id)
    return TemplateOut.model_validate(row)


@router.post("/verify", response_model=VerifyResponse)
async def verify_1to1(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_MATCH)),
) -> VerifyResponse:
    return await service.verify_1to1(db, body)


@router.post("/identify", response_model=IdentifyResponse)
@router.post("/search", response_model=IdentifyResponse)
async def identify_1to_n(
    body: IdentifyRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_BIOMETRIC_MATCH)),
) -> IdentifyResponse:
    return await enroll.identify(db, body, actor_id=principal.actor_id)


@router.post("/media", response_model=MediaRefOut, status_code=status.HTTP_201_CREATED)
async def register_media(
    body: MediaRefCreate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> MediaRefOut:
    return await service.register_media(db, body)  # type: ignore[return-value]


@router.get("/dedup/{session_id}", response_model=DedupSessionOut)
async def get_dedup_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_MATCH)),
) -> DedupSessionOut:
    row = await service.get_dedup_session(db, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Dedup session not found")
    return DedupSessionOut.model_validate(row)


@router.post("/enrollments", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
async def create_enrollment(
    body: EnrollmentCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> EnrollmentOut:
    row = await enroll.start_enrollment(db, body, actor_id=principal.actor_id)
    return enroll.enrollment_to_out(row, 0)


@router.get("/enrollments/{enrollment_id}", response_model=EnrollmentOut)
async def get_enrollment(
    enrollment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> EnrollmentOut:
    row = await db.get(BiometricEnrollment, enrollment_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    count = await db.scalar(
        select(func.count())
        .select_from(BiometricTemplate)
        .where(
            BiometricTemplate.enrollment_id == enrollment_id,
            BiometricTemplate.status == FingerprintStatus.ACTIVE,
        )
    )
    return enroll.enrollment_to_out(row, int(count or 0))


@router.post(
    "/enrollments/{enrollment_id}/capture",
    response_model=CaptureFingerResponse,
)
async def capture_enrollment_finger(
    enrollment_id: uuid.UUID,
    body: CaptureFingerRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> CaptureFingerResponse:
    return await enroll.capture_finger(
        db, enrollment_id, body, actor_id=principal.actor_id
    )


@router.post("/enrollments/{enrollment_id}/finalize", response_model=EnrollmentOut)
async def finalize_enrollment(
    enrollment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> EnrollmentOut:
    row = await enroll.finalize_enrollment(db, enrollment_id, actor_id=principal.actor_id)
    return enroll.enrollment_to_out(row, row.required_fingers)


@router.get("/citizens/{citizen_id}/fingerprints", response_model=list[FingerprintListItem])
async def citizen_fingerprints(
    citizen_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> list[FingerprintListItem]:
    return await enroll.list_citizen_fingerprints(db, citizen_id)


@router.post("/matches/{match_id}/review", response_model=MatchOut)
async def review_match(
    match_id: uuid.UUID,
    body: MatchReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MatchOut:
    perms = {p.code for r in user.roles for p in r.permissions}
    if PERM_BIOMETRIC_REVIEW not in perms and PERM_BIOMETRIC_MATCH not in perms:
        if not any(r.code in {"CENTRAL_ADMIN", "SUPER_ADMIN_NATIONAL", "ONIP_OPS"} for r in user.roles):
            raise HTTPException(status_code=403, detail="Missing biometric review permission")
    row = await enroll.review_match(db, match_id, body, actor_id=user.id)
    return MatchOut(
        id=row.id,
        matched_citizen_id=row.matched_citizen_id,
        match_score=row.match_score,
        threshold_used=row.threshold_used,
        decision=row.decision,
        finger_position=row.finger_position,
        review_status=row.review_status,
        created_at=row.created_at,
    )


@router.post("/fingerprints/{fingerprint_id}/revoke", response_model=FingerprintListItem)
async def revoke_fingerprint(
    fingerprint_id: uuid.UUID,
    body: RevokeRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> FingerprintListItem:
    row = await enroll.revoke_fingerprint(
        db, fingerprint_id, actor_id=principal.actor_id, reason=body.reason
    )
    from apps.api.domains.biometric.enrollment_service import FINGER_LABELS_FR

    return FingerprintListItem(
        id=row.id,
        finger_position=row.finger_position or "UNKNOWN",
        finger_label=FINGER_LABELS_FR.get(row.finger_position or "", "—"),
        hand=row.hand,
        quality_score=row.quality_score,
        status=row.status.value if row.status else "REVOKED",
        created_at=row.created_at,
    )


@router.get("/stats", response_model=StatsOut)
async def stats(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_MATCH)),
) -> StatsOut:
    return await enroll.biometric_stats(db)


@router.get("/thresholds", response_model=list[ThresholdOut])
async def list_thresholds(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_MATCH)),
) -> list[ThresholdOut]:
    from apps.api.domains.biometric.models import BiometricThreshold

    rows = list(
        (await db.execute(select(BiometricThreshold).where(BiometricThreshold.active.is_(True))))
        .scalars()
        .all()
    )
    return [ThresholdOut.model_validate(r) for r in rows]


@router.get("/fingers")
async def list_finger_positions(
    _: Principal = Depends(require_permissions(PERM_BIOMETRIC_ENROLL)),
) -> dict:
    from apps.api.domains.biometric.enrollment_service import FINGER_LABELS_FR
    from apps.api.domains.biometric.models import FINGER_POSITIONS

    return {
        "positions": [
            {"code": c, "label": FINGER_LABELS_FR.get(c, c)} for c in FINGER_POSITIONS
        ]
    }
