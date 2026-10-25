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
        """
        SELECT COUNT(*) FROM cards.national_cards
        WHERE status IN ('PENDING', 'SENT_TO_COMMUNE')
        """,
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


async def list_map_points(
    db: AsyncSession, limit: int = 5000, address_source: str | None = None
) -> dict[str, Any]:
    """Un point GPS par personne recensée (pas seulement par ménage).

    Si plusieurs personnes partagent le même ménage / GPS, un léger décalage
    déterministe sépare les marqueurs pour que N personnes = N endroits visibles.
    Filtre optionnel address_source: gps | online | manual.

    Ménages sans coordonnées : fallback Kinshasa + source manuelle (visibles sur la carte).
    """
    points: list[dict[str, Any]] = []
    try:
        where_src = ""
        params: dict[str, Any] = {"lim": limit}
        if address_source and address_source.lower() not in {"all", "*"}:
            src = address_source.lower()
            params["address_source"] = src
            if (src == "manual"):
                where_src = """
                  AND LOWER(COALESCE(h.address_source, '')) IN
                    ('manual', 'manual_offline', 'cascade', 'offline_manual')
                """
            elif src == "online":
                where_src = " AND LOWER(COALESCE(h.address_source, '')) = 'online'"
            else:  # gps
                where_src = """
                  AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
                  AND LOWER(COALESCE(NULLIF(h.address_source, ''), 'gps')) IN ('gps', 'offline', 'offline_kinshasa')
                """
        result = await db.execute(
            text(
                f"""
                SELECT r.id::text AS id,
                       r.local_id,
                       r.campaign_id::text AS campaign_id,
                       r.given_names,
                       r.family_name,
                       r.sex,
                       r.date_of_birth,
                       r.status AS record_status,
                       r.payload AS payload,
                       h.address_line,
                       COALESCE(h.latitude, -4.3276) AS latitude,
                       COALESCE(h.longitude, 15.3136) AS longitude,
                       CASE
                         WHEN LOWER(COALESCE(h.address_source, '')) IN
                              ('manual', 'manual_offline', 'cascade') THEN 'manual'
                         WHEN h.latitude IS NULL OR h.longitude IS NULL THEN 'manual'
                         WHEN LOWER(COALESCE(h.address_source, '')) = 'online' THEN 'online'
                         WHEN h.address_source IS NULL THEN 'gps'
                         ELSE LOWER(h.address_source)
                       END AS address_source,
                       h.local_id AS household_local_id,
                       COALESCE(
                         NULLIF(trim(h.address_line), ''),
                         'Sans adresse'
                       ) AS milieu,
                       r.updated_at
                FROM recensement.census_records r
                INNER JOIN recensement.households h ON h.id = r.household_id
                WHERE 1=1
                  {where_src}
                ORDER BY r.updated_at DESC NULLS LAST
                LIMIT :lim
                """
            ),
            params,
        )
        from apps.api.domains.recensement.service import _coords_for_province, _jitter

        for idx, row in enumerate(result.mappings()):
            # Décalage ~8–25 m pour distinguer les personnes d'un même ménage
            offset = ((idx % 17) - 8) * 0.00008
            offset2 = ((idx % 13) - 6) * 0.00008
            lat = float(row["latitude"])
            lng = float(row["longitude"])
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            province_hint = (
                (payload or {}).get("province_actuelle")
                or (payload or {}).get("province_origine")
                or (payload or {}).get("province_code")
                or row.get("address_line")
            )
            near_kin = abs(lat - (-4.3276)) < 0.25 and abs(lng - 15.3136) < 0.25
            src = row.get("address_source") or "gps"
            if near_kin and province_hint and str(src).lower() in {
                "manual",
                "manual_offline",
                "cascade",
                "offline_manual",
            }:
                base = _coords_for_province(str(province_hint))
                if base:
                    lat, lng = _jitter(base[0], base[1], str(row.get("local_id") or row["id"]))
            lat = lat + offset
            lng = lng + offset2
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
                    "address_source": src,
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
        "address_source_filter": address_source or "all",
        "points": points,
    }


async def list_map_by_milieu(
    db: AsyncSession, limit: int = 5000, address_source: str | None = None
) -> dict[str, Any]:
    """Agrège les points par milieu (adresse / zone) avec statistiques."""
    raw = await list_map_points(db, limit=limit, address_source=address_source)
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


async def list_civil_conflicts(db: AsyncSession, *, limit: int = 50) -> dict[str, Any]:
    """Corrections / déclarations en tension — exposition ONIP sans écrasement."""
    items: list[dict[str, Any]] = []
    try:
        result = await db.execute(
            text(
                """
                SELECT id::text, status, reason, created_at
                FROM etat_civil.correction_requests
                WHERE status IN ('PENDING', 'PENDING_OFFICER', 'CONFLICT', 'REJECTED', 'OPEN')
                ORDER BY created_at DESC
                LIMIT :lim
                """
            ),
            {"lim": limit},
        )
        for row in result.mappings():
            items.append(
                {
                    "kind": "correction",
                    "id": row["id"],
                    "status": row["status"],
                    "reason": row.get("reason"),
                    "created_at": row["created_at"].isoformat()
                    if row.get("created_at")
                    else None,
                    "resolution": "manual_review_required",
                }
            )
    except Exception as exc:
        logger.debug("civil conflicts fallback: %s", exc)
        await db.rollback()

    return {
        "count": len(items),
        "items": items,
        "policy": "no_silent_overwrite",
        "note": "Les événements EC dupliqués sont refusés côté API (find_duplicate_act) ; "
        "les conflits ouverts restent en file jusqu'à décision humaine.",
    }


async def build_ops_health(db: AsyncSession) -> dict[str, Any]:
    """Santé technique ONIP — agrégats files / versions, sans secrets ni PII."""
    from apps.api.domains.core_registry.national_identity_number_service import (
        OFFICIAL_NIN_FORMAT_CONFIRMED,
    )

    dash = await build_dashboard(db)
    sync_pending = await _safe_count(
        db,
        "SELECT COUNT(*) FROM recensement.sync_batches WHERE status IN ('PENDING', 'PROCESSING')",
    )
    bio_pending = await _safe_count(
        db,
        "SELECT COUNT(*) FROM biometric.biometric_matches WHERE review_status = 'PENDING'",
    )
    civil_conflicts = await _safe_count(
        db,
        """
        SELECT COUNT(*) FROM etat_civil.correction_requests
        WHERE status IN ('PENDING', 'CONFLICT', 'REJECTED')
        """,
    )
    nic_provisional = await _safe_count(
        db,
        "SELECT COUNT(*) FROM core_registry.citizens WHERE nic IS NOT NULL",
    )
    return {
        "api": "up",
        "onip_dashboard": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "official_nin_format_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
        "population_cards": dash.get("cards") if isinstance(dash, dict) else None,
        "anomaly_count": len(dash.get("anomalies") or []) if isinstance(dash, dict) else 0,
        "queues": {
            "sync_batches_pending": sync_pending,
            "biometric_reviews_pending": bio_pending,
            "civil_corrections_open": civil_conflicts,
            "nic_issued_provisional": nic_provisional,
        },
        "versions": {
            "provisional_nic_algorithm": "PROVISIONAL-v3-rdc-14-NOT-OFFICIAL",
            "audit_report": "docs/legal/onip/RAPPORT_AUDIT_ONIP_DETAIL.md",
        },
        "hint": "Biométrie / civil : pages dédiées (permissions séparées). Pas d'accès métier auto.",
    }
