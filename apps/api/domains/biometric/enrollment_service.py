"""Biometric enrollment: 3 distinct fingers + mandatory 1:N before store."""

from __future__ import annotations

import base64
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import get_settings
from apps.api.domains.audit.services import write_audit
from apps.api.domains.biometric.models import (
    FINGER_POSITIONS,
    BiometricEnrollment,
    BiometricMatch,
    BiometricModality,
    BiometricTemplate,
    BiometricThreshold,
    DedupDecision,
    DedupSession,
    EnrollmentStatus,
    FingerprintStatus,
    MatchDecision,
)
from apps.api.domains.biometric.provider import get_biometric_provider
from apps.api.domains.biometric.schemas import (
    CaptureFingerRequest,
    CaptureFingerResponse,
    EnrollmentCreate,
    EnrollmentOut,
    FingerprintListItem,
    IdentifyCandidate,
    IdentifyRequest,
    IdentifyResponse,
    MatchReviewRequest,
    MatchOut,
    StatsOut,
)

HAND_BY_FINGER = {
    "POUCE_DROIT": "DROITE",
    "INDEX_DROIT": "DROITE",
    "MAJEUR_DROIT": "DROITE",
    "ANNULAIRE_DROIT": "DROITE",
    "AURICULAIRE_DROIT": "DROITE",
    "POUCE_GAUCHE": "GAUCHE",
    "INDEX_GAUCHE": "GAUCHE",
    "MAJEUR_GAUCHE": "GAUCHE",
    "ANNULAIRE_GAUCHE": "GAUCHE",
    "AURICULAIRE_GAUCHE": "GAUCHE",
}

FINGER_LABELS_FR = {
    "POUCE_DROIT": "Pouce droit",
    "INDEX_DROIT": "Index droit",
    "MAJEUR_DROIT": "Majeur droit",
    "ANNULAIRE_DROIT": "Annulaire droit",
    "AURICULAIRE_DROIT": "Auriculaire droit",
    "POUCE_GAUCHE": "Pouce gauche",
    "INDEX_GAUCHE": "Index gauche",
    "MAJEUR_GAUCHE": "Majeur gauche",
    "ANNULAIRE_GAUCHE": "Annulaire gauche",
    "AURICULAIRE_GAUCHE": "Auriculaire gauche",
}


async def _threshold(db: AsyncSession, name: str, default: float) -> float:
    row = (
        await db.execute(
            select(BiometricThreshold).where(
                BiometricThreshold.name == name,
                BiometricThreshold.active.is_(True),
            )
        )
    ).scalar_one_or_none()
    return float(row.value) if row else default


async def get_thresholds(db: AsyncSession) -> dict[str, float]:
    return {
        "strong": await _threshold(db, "fingerprint_strong", 0.90),
        "review": await _threshold(db, "fingerprint_review", 0.70),
        "min_quality": await _threshold(db, "fingerprint_min_quality", 60.0),
    }


async def start_enrollment(
    db: AsyncSession,
    data: EnrollmentCreate,
    *,
    actor_id: uuid.UUID | None,
) -> BiometricEnrollment:
    row = BiometricEnrollment(
        citizen_id=data.citizen_id,
        status=EnrollmentStatus.OPEN,
        enrolled_by=actor_id,
        device_id=data.device_id,
        location_id=data.location_id,
        required_fingers=3,
    )
    db.add(row)
    await write_audit(
        db,
        action="BIOMETRIC_ENROLLMENT_STARTED",
        actor_id=actor_id,
        resource_type="biometric_enrollment",
        resource_id=str(data.citizen_id),
        new_value={"citizen_id": str(data.citizen_id)},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def list_citizen_fingerprints(
    db: AsyncSession, citizen_id: uuid.UUID
) -> list[FingerprintListItem]:
    rows = list(
        (
            await db.execute(
                select(BiometricTemplate)
                .where(
                    BiometricTemplate.citizen_id == citizen_id,
                    BiometricTemplate.modality == BiometricModality.FINGERPRINT,
                    BiometricTemplate.status == FingerprintStatus.ACTIVE,
                )
                .order_by(BiometricTemplate.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    return [
        FingerprintListItem(
            id=r.id,
            finger_position=r.finger_position or "UNKNOWN",
            finger_label=FINGER_LABELS_FR.get(r.finger_position or "", r.finger_position or "—"),
            hand=r.hand,
            quality_score=r.quality_score,
            status=r.status.value if r.status else "ACTIVE",
            created_at=r.created_at,
        )
        for r in rows
    ]


async def _engx_verify_score(probe: bytes, gallery: bytes) -> float:
    """1:1 via pont ZKFPEngX (VerFingerFromStr). 1.0 = match, 0.0 sinon."""
    settings = get_settings()
    base = (settings.zkteco_bridge_url or "").rstrip("/")
    if not base:
        return 0.0
    try:
        import urllib.request

        payload = json.dumps(
            {
                "probe_b64": base64.b64encode(probe).decode(),
                "gallery_b64": [base64.b64encode(gallery).decode()],
            }
        ).encode()
        req = urllib.request.Request(
            f"{base}/verify",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        if data.get("matched"):
            return 1.0
        scores = data.get("scores") or []
        return float(scores[0]) if scores else 0.0
    except Exception:
        return 0.0


def _looks_engx_template(raw: bytes) -> bool:
    if not raw or len(raw) < 16:
        return False
    try:
        s = raw.decode("utf-8")
    except Exception:
        return False
    # EngX EncodeTemplate1 → chaîne ASCII/base64-like
    return all(32 <= ord(c) < 127 for c in s[:40]) and len(s) >= 32


async def _search_gallery(
    db: AsyncSession,
    *,
    probe_hash: str,
    exclude_citizen_id: uuid.UUID | None,
    max_candidates: int,
    probe_raw: bytes | None = None,
) -> list[IdentifyCandidate]:
    provider = get_biometric_provider()
    stmt = select(BiometricTemplate).where(
        BiometricTemplate.modality == BiometricModality.FINGERPRINT,
        BiometricTemplate.status == FingerprintStatus.ACTIVE,
    )
    if exclude_citizen_id:
        stmt = stmt.where(BiometricTemplate.citizen_id != exclude_citizen_id)
    gallery = list((await db.execute(stmt)).scalars().all())
    scored: list[IdentifyCandidate] = []
    for t in gallery:
        gallery_hash = t.template_hash
        plain: bytes | None = None
        try:
            plain = provider.decrypt_template(bytes(t.template_encrypted))
            if not gallery_hash:
                gallery_hash = provider.template_hash(plain)
        except Exception:
            if not gallery_hash:
                continue
        score = provider.compare(probe_hash, gallery_hash) if gallery_hash else 0.0
        # Empreintes ZK EngX : hash exact insuffisant → VerFinger 1:1
        if (
            score < 0.99
            and probe_raw is not None
            and plain is not None
            and (
                (t.algorithm_version or "").startswith("zkfinger")
                or (_looks_engx_template(probe_raw) and _looks_engx_template(plain))
            )
        ):
            score = max(score, await _engx_verify_score(probe_raw, plain))
        if score >= 0.5:
            scored.append(
                IdentifyCandidate(
                    citizen_id=t.citizen_id,
                    template_id=t.id,
                    score=score,
                    finger_position=t.finger_position,
                    finger_label=FINGER_LABELS_FR.get(t.finger_position or "", None),
                )
            )
    scored.sort(key=lambda c: c.score, reverse=True)
    return scored[:max_candidates]


async def capture_finger(
    db: AsyncSession,
    enrollment_id: uuid.UUID,
    data: CaptureFingerRequest,
    *,
    actor_id: uuid.UUID | None,
) -> CaptureFingerResponse:
    enrollment = await db.get(BiometricEnrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.status not in {EnrollmentStatus.OPEN, EnrollmentStatus.BLOCKED}:
        raise HTTPException(status_code=400, detail="Enrollment is closed")

    finger = data.finger_position.upper()
    if finger not in FINGER_POSITIONS:
        raise HTTPException(status_code=400, detail="Invalid finger_position")

    thresholds = await get_thresholds(db)
    provider = get_biometric_provider()
    if not provider.validate_quality(data.quality_score, thresholds["min_quality"]):
        await write_audit(
            db,
            action="BIOMETRIC_CAPTURE",
            result="rejected",
            actor_id=actor_id,
            resource_type="biometric_enrollment",
            resource_id=str(enrollment_id),
            new_value={"reason": "quality_below_threshold", "quality": data.quality_score},
            commit=False,
        )
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Quality score below threshold ({thresholds['min_quality']})",
        )

    # Same finger already active on this citizen
    existing_finger = (
        await db.execute(
            select(BiometricTemplate).where(
                BiometricTemplate.citizen_id == enrollment.citizen_id,
                BiometricTemplate.finger_position == finger,
                BiometricTemplate.status == FingerprintStatus.ACTIVE,
            )
        )
    ).scalar_one_or_none()
    if existing_finger:
        raise HTTPException(
            status_code=409,
            detail="This finger is already enrolled for this population dossier",
        )

    # Distinct fingers within open enrollment captures
    enrollment_fingers = list(
        (
            await db.execute(
                select(BiometricTemplate).where(
                    BiometricTemplate.enrollment_id == enrollment_id,
                    BiometricTemplate.status == FingerprintStatus.ACTIVE,
                )
            )
        )
        .scalars()
        .all()
    )
    if any(f.finger_position == finger for f in enrollment_fingers):
        raise HTTPException(status_code=409, detail="Duplicate finger in this enrollment")
    if len(enrollment_fingers) >= enrollment.required_fingers:
        raise HTTPException(status_code=400, detail="Enrollment already has required fingers")

    raw = base64.b64decode(data.template_b64)
    features = provider.extract_features(raw)
    template = provider.generate_template(features)
    probe_hash = provider.template_hash(template)
    encrypted = provider.encrypt_template(template)

    await write_audit(
        db,
        action="BIOMETRIC_TEMPLATE_CREATED",
        actor_id=actor_id,
        resource_type="biometric_enrollment",
        resource_id=str(enrollment_id),
        new_value={"finger": finger, "quality": data.quality_score},
        commit=False,
    )

    candidates = await _search_gallery(
        db,
        probe_hash=probe_hash,
        exclude_citizen_id=enrollment.citizen_id,
        max_candidates=5,
        probe_raw=raw,
    )

    strong = thresholds["strong"]
    review = thresholds["review"]
    if candidates and candidates[0].score >= strong:
        decision = DedupDecision.MATCH_CONFIRMED
        match_decision = MatchDecision.STRONG_MATCH
    elif candidates and candidates[0].score >= review:
        decision = DedupDecision.MANUAL_REVIEW
        match_decision = MatchDecision.REVIEW
    else:
        decision = DedupDecision.NO_MATCH
        match_decision = MatchDecision.NO_MATCH

    session = DedupSession(
        probe_citizen_id=enrollment.citizen_id,
        modality=BiometricModality.FINGERPRINT,
        candidates=[c.model_dump(mode="json") for c in candidates],
        scores=[c.score for c in candidates],
        decision=decision,
    )
    db.add(session)
    await db.flush()

    await write_audit(
        db,
        action="BIOMETRIC_MATCH_SEARCH",
        actor_id=actor_id,
        resource_type="biometric_dedup",
        resource_id=str(session.id),
        new_value={
            "decision": decision.value,
            "top_score": candidates[0].score if candidates else 0,
            "candidates": len(candidates),
        },
        commit=False,
    )

    if decision in {DedupDecision.MATCH_CONFIRMED, DedupDecision.MANUAL_REVIEW}:
        top = candidates[0]
        match = BiometricMatch(
            source_citizen_id=enrollment.citizen_id,
            matched_citizen_id=top.citizen_id,
            matched_fingerprint_id=top.template_id,
            match_score=top.score,
            threshold_used=strong if decision == DedupDecision.MATCH_CONFIRMED else review,
            decision=match_decision,
            review_status="PENDING",
            finger_position=finger,
            enrollment_id=enrollment.id,
        )
        db.add(match)
        enrollment.status = EnrollmentStatus.BLOCKED
        await write_audit(
            db,
            action="BIOMETRIC_MATCH_FOUND",
            result="blocked",
            actor_id=actor_id,
            resource_type="biometric_match",
            resource_id=str(top.citizen_id),
            new_value={
                "score": top.score,
                "matched_citizen_id": str(top.citizen_id),
                "finger": top.finger_position,
                "decision": match_decision.value,
            },
            commit=False,
        )
        await write_audit(
            db,
            action="BIOMETRIC_ENROLLMENT_BLOCKED",
            result="blocked",
            actor_id=actor_id,
            resource_type="biometric_enrollment",
            resource_id=str(enrollment.id),
            commit=False,
        )
        await db.commit()
        await db.refresh(match)
        return CaptureFingerResponse(
            accepted=False,
            blocked=True,
            decision=decision,
            finger_position=finger,
            quality_score=data.quality_score,
            match=MatchOut(
                id=match.id,
                matched_citizen_id=match.matched_citizen_id,
                match_score=match.match_score,
                threshold_used=match.threshold_used,
                decision=match.decision,
                finger_position=match.finger_position,
                matched_finger_label=FINGER_LABELS_FR.get(top.finger_position or "", None),
                review_status=match.review_status,
                created_at=match.created_at,
            ),
            candidates=candidates,
            message=(
                "Correspondance biométrique trouvée. "
                "Cette empreinte semble déjà appartenir à un dossier de population existant. "
                "L'enrôlement est bloqué."
            ),
            enrollment_id=enrollment.id,
            fingerprints_count=len(enrollment_fingers),
            required_fingers=enrollment.required_fingers,
        )

    # No conflict — store fingerprint (never return template bytes)
    algo = provider.ALGORITHM if hasattr(provider, "ALGORITHM") else "mvp-hash-v1"
    if data.capture_device and "ZK" in str(data.capture_device).upper():
        algo = "zkfinger-engx-v9"
    elif _looks_engx_template(raw):
        algo = "zkfinger-engx-v9"
    row = BiometricTemplate(
        citizen_id=enrollment.citizen_id,
        modality=BiometricModality.FINGERPRINT,
        template_encrypted=encrypted,
        quality_score=data.quality_score,
        algorithm_version=algo,
        enrollment_id=enrollment.id,
        finger_position=finger,
        hand=HAND_BY_FINGER.get(finger),
        status=FingerprintStatus.ACTIVE,
        template_hash=probe_hash,
        capture_device=data.capture_device,
    )
    db.add(row)
    enrollment.status = EnrollmentStatus.OPEN
    enrollment.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(row)

    count = len(enrollment_fingers) + 1
    return CaptureFingerResponse(
        accepted=True,
        blocked=False,
        decision=DedupDecision.NO_MATCH,
        finger_position=finger,
        fingerprint_id=row.id,
        quality_score=data.quality_score,
        candidates=[],
        message="Empreinte capturée — aucune correspondance détectée.",
        enrollment_id=enrollment.id,
        fingerprints_count=count,
        required_fingers=enrollment.required_fingers,
    )


async def finalize_enrollment(
    db: AsyncSession,
    enrollment_id: uuid.UUID,
    *,
    actor_id: uuid.UUID | None,
) -> BiometricEnrollment:
    enrollment = await db.get(BiometricEnrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.status == EnrollmentStatus.BLOCKED:
        raise HTTPException(
            status_code=409,
            detail="Enrollment blocked by biometric match — verification required",
        )
    count = await db.scalar(
        select(func.count())
        .select_from(BiometricTemplate)
        .where(
            BiometricTemplate.enrollment_id == enrollment_id,
            BiometricTemplate.status == FingerprintStatus.ACTIVE,
        )
    )
    if int(count or 0) < enrollment.required_fingers:
        raise HTTPException(
            status_code=400,
            detail=f"Need {enrollment.required_fingers} distinct fingers, have {count}",
        )
    enrollment.status = EnrollmentStatus.COMPLETED
    enrollment.updated_at = datetime.now(UTC)
    await write_audit(
        db,
        action="BIOMETRIC_ENROLLMENT_COMPLETED",
        actor_id=actor_id,
        resource_type="biometric_enrollment",
        resource_id=str(enrollment.id),
        new_value={"fingers": int(count or 0)},
        commit=False,
    )
    await db.commit()
    await db.refresh(enrollment)
    return enrollment


async def identify(
    db: AsyncSession,
    req: IdentifyRequest,
    *,
    actor_id: uuid.UUID | None,
) -> IdentifyResponse:
    provider = get_biometric_provider()
    raw = base64.b64decode(req.template_b64)
    probe_hash = provider.template_hash(provider.generate_template(provider.extract_features(raw)))
    thresholds = await get_thresholds(db)
    candidates = await _search_gallery(
        db,
        probe_hash=probe_hash,
        exclude_citizen_id=None,
        max_candidates=req.max_candidates,
        probe_raw=raw,
    )
    if candidates and candidates[0].score >= thresholds["strong"]:
        decision = DedupDecision.MATCH_CONFIRMED
    elif candidates and candidates[0].score >= thresholds["review"]:
        decision = DedupDecision.MANUAL_REVIEW
    else:
        decision = DedupDecision.NO_MATCH

    session = DedupSession(
        probe_citizen_id=None,
        modality=req.modality,
        candidates=[c.model_dump(mode="json") for c in candidates],
        scores=[c.score for c in candidates],
        decision=decision,
    )
    db.add(session)
    await write_audit(
        db,
        action="BIOMETRIC_MATCH_SEARCH",
        actor_id=actor_id,
        resource_type="biometric_identify",
        resource_id="1N",
        new_value={"decision": decision.value, "candidates": len(candidates)},
        commit=False,
    )
    await db.commit()
    await db.refresh(session)
    return IdentifyResponse(
        candidates=candidates,
        decision=decision,
        session_id=session.id,
        thresholds=thresholds,
    )


async def review_match(
    db: AsyncSession,
    match_id: uuid.UUID,
    body: MatchReviewRequest,
    *,
    actor_id: uuid.UUID,
) -> BiometricMatch:
    match = await db.get(BiometricMatch, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if body.approve_exception:
        if not body.reason or len(body.reason.strip()) < 10:
            raise HTTPException(status_code=400, detail="Justification required (min 10 chars)")
        match.decision = MatchDecision.EXCEPTION_APPROVED
        match.review_status = "APPROVED"
        match.reason = body.reason.strip()
        action = "BIOMETRIC_EXCEPTION_APPROVED"
    else:
        match.decision = MatchDecision.REJECTED
        match.review_status = "REJECTED"
        match.reason = (body.reason or "").strip() or None
        action = "BIOMETRIC_REVIEW_COMPLETED"
    match.reviewed_by = actor_id
    match.reviewed_at = datetime.now(UTC)
    await write_audit(
        db,
        action=action,
        actor_id=actor_id,
        resource_type="biometric_match",
        resource_id=str(match.id),
        justification=match.reason,
        new_value={"review_status": match.review_status, "decision": match.decision.value},
        commit=False,
    )
    await db.commit()
    await db.refresh(match)
    return match


async def revoke_fingerprint(
    db: AsyncSession,
    fingerprint_id: uuid.UUID,
    *,
    actor_id: uuid.UUID,
    reason: str,
) -> BiometricTemplate:
    row = await db.get(BiometricTemplate, fingerprint_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Fingerprint not found")
    if not reason or len(reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="Reason required")
    row.status = FingerprintStatus.REVOKED
    row.updated_at = datetime.now(UTC)
    await write_audit(
        db,
        action="BIOMETRIC_TEMPLATE_REVOKED",
        actor_id=actor_id,
        resource_type="biometric_template",
        resource_id=str(row.id),
        justification=reason.strip(),
        new_value={"citizen_id": str(row.citizen_id), "finger": row.finger_position},
        commit=False,
    )
    await db.commit()
    await db.refresh(row)
    return row


async def biometric_stats(db: AsyncSession) -> StatsOut:
    enrollments = await db.scalar(select(func.count()).select_from(BiometricEnrollment)) or 0
    fingerprints = (
        await db.scalar(
            select(func.count())
            .select_from(BiometricTemplate)
            .where(
                BiometricTemplate.modality == BiometricModality.FINGERPRINT,
                BiometricTemplate.status == FingerprintStatus.ACTIVE,
            )
        )
        or 0
    )
    matches = await db.scalar(select(func.count()).select_from(BiometricMatch)) or 0
    strong = (
        await db.scalar(
            select(func.count())
            .select_from(BiometricMatch)
            .where(BiometricMatch.decision == MatchDecision.STRONG_MATCH)
        )
        or 0
    )
    review = (
        await db.scalar(
            select(func.count())
            .select_from(BiometricMatch)
            .where(BiometricMatch.review_status == "PENDING")
        )
        or 0
    )
    blocked = (
        await db.scalar(
            select(func.count())
            .select_from(BiometricEnrollment)
            .where(BiometricEnrollment.status == EnrollmentStatus.BLOCKED)
        )
        or 0
    )
    avg_q = await db.scalar(
        select(func.avg(BiometricTemplate.quality_score)).where(
            BiometricTemplate.status == FingerprintStatus.ACTIVE
        )
    )
    return StatsOut(
        enrollments=int(enrollments),
        fingerprints_active=int(fingerprints),
        matches_total=int(matches),
        strong_matches=int(strong),
        pending_reviews=int(review),
        blocked_enrollments=int(blocked),
        average_quality=round(float(avg_q), 1) if avg_q is not None else None,
        note="Statistiques réelles de la base biométrique (pas des chiffres nationaux inventés).",
    )


def enrollment_to_out(row: BiometricEnrollment, fingerprints_count: int = 0) -> EnrollmentOut:
    return EnrollmentOut(
        id=row.id,
        citizen_id=row.citizen_id,
        status=row.status,
        required_fingers=row.required_fingers,
        fingerprints_count=fingerprints_count,
        enrolled_by=row.enrolled_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
