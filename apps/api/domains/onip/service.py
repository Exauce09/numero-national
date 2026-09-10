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


async def list_map_points(db: AsyncSession, limit: int = 5000) -> dict[str, Any]:
    """Un point GPS par personne recensée (pas seulement par ménage).

    Si plusieurs personnes partagent le même ménage / GPS, un léger décalage
    déterministe sépare les marqueurs pour que N personnes = N endroits visibles.
    """
    points: list[dict[str, Any]] = []
    try:
        result = await db.execute(
            text(
                """
                SELECT r.id::text AS id,
                       r.local_id,
                       r.campaign_id::text AS campaign_id,
                       r.given_names,
                       r.family_name,
                       r.sex,
                       r.date_of_birth,
                       r.status AS record_status,
                       h.address_line,
                       h.latitude,
                       h.longitude,
                       h.local_id AS household_local_id,
                       COALESCE(
                         NULLIF(trim(h.address_line), ''),
                         'Sans adresse'
                       ) AS milieu,
                       r.updated_at
                FROM recensement.census_records r
                INNER JOIN recensement.households h ON h.id = r.household_id
                WHERE h.latitude IS NOT NULL
                  AND h.longitude IS NOT NULL
                ORDER BY r.updated_at DESC NULLS LAST
                LIMIT :lim
                """
            ),
            {"lim": limit},
        )
        for idx, row in enumerate(result.mappings()):
            # Décalage ~8–25 m pour distinguer les personnes d'un même ménage
            offset = ((idx % 17) - 8) * 0.00008
            offset2 = ((idx % 13) - 6) * 0.00008
            lat = float(row["latitude"]) + offset
            lng = float(row["longitude"]) + offset2
            name = " ".join(
                p for p in [row["family_name"], row["given_names"]] if p
            ).strip() or "Personne"
            points.append(
                {
                    "id": row["id"],
                    "local_id": row["local_id"],
                    "campaign_id": row["campaign_id"],
                    "household_local_id": row["household_local_id"],
                    "label": name,
                    "sex": row["sex"],
                    "date_of_birth": row["date_of_birth"],
                    "record_status": row["record_status"],
                    "address_line": row["address_line"],
                    "milieu": row["milieu"],
                    "latitude": lat,
                    "longitude": lng,
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
        "mode": "persons",
        "points": points,
    }


async def list_map_by_milieu(db: AsyncSession, limit: int = 5000) -> dict[str, Any]:
    """Agrège les points par milieu (adresse / zone) avec statistiques."""
    raw = await list_map_points(db, limit=limit)
    buckets: dict[str, dict[str, Any]] = {}
    for p in raw["points"]:
        key = (p.get("milieu") or "Sans adresse").strip() or "Sans adresse"
        b = buckets.get(key)
        if b is None:
            b = {
                "milieu": key,
                "count": 0,
                "male": 0,
                "female": 0,
                "other": 0,
                "latitude": p["latitude"],
                "longitude": p["longitude"],
                "address_line": p.get("address_line"),
            }
            buckets[key] = b
        b["count"] += 1
        sex = (p.get("sex") or "").upper()
        if sex in {"M", "MALE", "H"}:
            b["male"] += 1
        elif sex in {"F", "FEMALE"}:
            b["female"] += 1
        else:
            b["other"] += 1
        # barycentre approximatif
        n = b["count"]
        b["latitude"] = (b["latitude"] * (n - 1) + p["latitude"]) / n
        b["longitude"] = (b["longitude"] * (n - 1) + p["longitude"]) / n

    milieux = sorted(buckets.values(), key=lambda x: x["count"], reverse=True)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(milieux),
        "persons": raw["count"],
        "mode": "milieu",
        "milieux": milieux,
    }
