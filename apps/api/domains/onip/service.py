"""ONIP dashboard aggregations — uses SQL counts when tables exist, else placeholders."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def _safe_count(db: AsyncSession, sql: str, params: dict[str, Any] | None = None) -> int:
    try:
        result = await db.execute(text(sql), params or {})
        return int(result.scalar_one() or 0)
    except Exception as exc:
        logger.debug("onip aggregate fallback: %s — %s", sql[:60], exc)
        await db.rollback()
        return 0


async def build_dashboard(db: AsyncSession) -> dict[str, Any]:
    population_active = await _safe_count(
        db,
        "SELECT COUNT(*) FROM core_registry.citizens WHERE status = 'ACTIVE'",
    )
    population_total = await _safe_count(db, "SELECT COUNT(*) FROM core_registry.citizens")
    campaigns_active = await _safe_count(
        db,
        "SELECT COUNT(*) FROM recensement.campaigns WHERE status = 'ACTIVE'",
    )
    campaigns_total = await _safe_count(db, "SELECT COUNT(*) FROM recensement.campaigns")
    duplicates_open = await _safe_count(
        db,
        "SELECT COUNT(*) FROM core_registry.duplicate_candidates WHERE status = 'OPEN'",
    )
    biometric_dedup_review = await _safe_count(
        db,
        "SELECT COUNT(*) FROM biometric.dedup_sessions WHERE decision = 'MANUAL_REVIEW'",
    )
    cards_active = await _safe_count(
        db,
        "SELECT COUNT(*) FROM cards.national_cards WHERE status = 'ACTIVE'",
    )
    cards_pending = await _safe_count(
        db,
        "SELECT COUNT(*) FROM cards.national_cards WHERE status = 'PENDING'",
    )
    civil_pending = await _safe_count(
        db,
        "SELECT COUNT(*) FROM etat_civil.civil_declarations WHERE status = 'PENDING_OFFICER'",
    )

    coverage_pct = (
        round(100.0 * population_active / population_total, 2) if population_total else 0.0
    )

    anomalies: list[dict[str, Any]] = []
    if duplicates_open:
        anomalies.append(
            {
                "code": "DUPLICATES_OPEN",
                "severity": "high",
                "count": duplicates_open,
                "message": "Demographic duplicate candidates awaiting review",
            }
        )
    if biometric_dedup_review:
        anomalies.append(
            {
                "code": "BIOMETRIC_MANUAL_REVIEW",
                "severity": "high",
                "count": biometric_dedup_review,
                "message": "Biometric dedup sessions require manual review",
            }
        )
    if civil_pending:
        anomalies.append(
            {
                "code": "CIVIL_PENDING",
                "severity": "medium",
                "count": civil_pending,
                "message": "Civil declarations pending officer validation",
            }
        )
    if not anomalies:
        anomalies.append(
            {
                "code": "NONE",
                "severity": "info",
                "count": 0,
                "message": "No anomalies detected (or dependent tables not yet migrated)",
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "population": {
            "total": population_total,
            "active": population_active,
            "coverage_percent": coverage_pct,
        },
        "campaigns": {
            "total": campaigns_total,
            "active": campaigns_active,
        },
        "duplicates_open": duplicates_open,
        "cards": {
            "active": cards_active,
            "pending": cards_pending,
        },
        "anomalies": anomalies,
    }


async def list_map_points(db: AsyncSession, limit: int = 2000) -> dict[str, Any]:
    """Household GPS points for national cartography (filled on save/sync)."""
    points: list[dict[str, Any]] = []
    try:
        result = await db.execute(
            text(
                """
                SELECT h.id::text AS id,
                       h.local_id,
                       h.campaign_id::text AS campaign_id,
                       h.address_line,
                       h.latitude,
                       h.longitude,
                       h.updated_at
                FROM recensement.households h
                WHERE h.latitude IS NOT NULL
                  AND h.longitude IS NOT NULL
                ORDER BY h.updated_at DESC NULLS LAST
                LIMIT :lim
                """
            ),
            {"lim": limit},
        )
        for row in result.mappings():
            points.append(
                {
                    "id": row["id"],
                    "local_id": row["local_id"],
                    "campaign_id": row["campaign_id"],
                    "address_line": row["address_line"],
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "updated_at": row["updated_at"].isoformat()
                    if row["updated_at"] is not None
                    else None,
                }
            )
    except Exception as exc:
        logger.debug("onip map points fallback: %s", exc)
        await db.rollback()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(points),
        "points": points,
    }
