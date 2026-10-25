"""ONIP dashboard aggregations — uses SQL counts when tables exist, else placeholders."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DashboardFilters:
    """Filtres Module 1 — agrégats uniquement, pas de PII."""

    period_from: date | None = None
    period_to: date | None = None
    province_code: str | None = None
    commune_code: str | None = None
    campaign_id: UUID | None = None
    citizen_status: str | None = None
    card_status: str | None = None


def normalize_dashboard_filters(
    *,
    period_from: date | None = None,
    period_to: date | None = None,
    province_code: str | None = None,
    commune_code: str | None = None,
    campaign_id: UUID | None = None,
    citizen_status: str | None = None,
    card_status: str | None = None,
) -> DashboardFilters:
    prov = (province_code or "").strip().upper() or None
    com = (commune_code or "").strip().upper() or None
    cst = (citizen_status or "").strip().upper() or None
    card = (card_status or "").strip().upper() or None
    if period_from and period_to and period_from > period_to:
        period_from, period_to = period_to, period_from
    return DashboardFilters(
        period_from=period_from,
        period_to=period_to,
        province_code=prov,
        commune_code=com,
        campaign_id=campaign_id,
        citizen_status=cst,
        card_status=card,
    )


async def _safe_count(db: AsyncSession, sql: str, params: dict[str, Any] | None = None) -> int:
    metric = await _safe_metric(db, sql, params)
    return int(metric["value"] or 0) if metric["status"] == "ok" else 0


async def _safe_metric(
    db: AsyncSession, sql: str, params: dict[str, Any] | None = None, *, source: str = "sql"
) -> dict[str, Any]:
    """Compte avec distinction zéro réel vs source indisponible (cahier §10)."""
    try:
        result = await db.execute(text(sql), params or {})
        return {
            "source": source,
            "status": "ok",
            "value": int(result.scalar_one() or 0),
        }
    except Exception as exc:
        logger.debug("onip metric unavailable: %s — %s", sql[:60], exc)
        await db.rollback()
        return {
            "source": source,
            "status": "unavailable",
            "value": None,
            "reason": "source_or_schema_unavailable",
        }


async def _safe_rows(
    db: AsyncSession, sql: str, params: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    try:
        result = await db.execute(text(sql), params or {})
        return [dict(r) for r in result.mappings().all()]
    except Exception as exc:
        logger.debug("onip rows unavailable: %s — %s", sql[:60], exc)
        await db.rollback()
        return []


def _citizen_where(filters: DashboardFilters, *, status: str | None = None) -> tuple[str, dict[str, Any]]:
    """Clauses WHERE citoyens + params (agrégats)."""
    clauses = ["1=1"]
    params: dict[str, Any] = {}
    st = status or filters.citizen_status
    if st:
        clauses.append("c.status = :citizen_status")
        params["citizen_status"] = st
    if filters.period_from:
        clauses.append("c.created_at >= :period_from")
        params["period_from"] = datetime.combine(filters.period_from, datetime.min.time(), tzinfo=timezone.utc)
    if filters.period_to:
        clauses.append("c.created_at < :period_to_excl")
        params["period_to_excl"] = datetime.combine(
            filters.period_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
        )
    if filters.province_code or filters.commune_code:
        addr = ["a.citizen_id = c.id"]
        if filters.province_code:
            addr.append("UPPER(COALESCE(a.province_code, '')) = :province_code")
            params["province_code"] = filters.province_code
        if filters.commune_code:
            addr.append("UPPER(COALESCE(a.commune_code, '')) = :commune_code")
            params["commune_code"] = filters.commune_code
        clauses.append(
            f"EXISTS (SELECT 1 FROM core_registry.citizen_addresses a WHERE {' AND '.join(addr)})"
        )
    return " AND ".join(clauses), params


def _card_where(filters: DashboardFilters, *, status_in: list[str] | None = None) -> tuple[str, dict[str, Any]]:
    clauses = ["1=1"]
    params: dict[str, Any] = {}
    if filters.card_status:
        clauses.append("nc.status = :card_status")
        params["card_status"] = filters.card_status
    elif status_in:
        placeholders = []
        for i, s in enumerate(status_in):
            key = f"card_st_{i}"
            placeholders.append(f":{key}")
            params[key] = s
        clauses.append(f"nc.status IN ({', '.join(placeholders)})")
    if filters.commune_code:
        clauses.append("UPPER(COALESCE(nc.commune_code, '')) = :card_commune")
        params["card_commune"] = filters.commune_code
    if filters.period_from:
        clauses.append("nc.created_at >= :card_from")
        params["card_from"] = datetime.combine(filters.period_from, datetime.min.time(), tzinfo=timezone.utc)
    if filters.period_to:
        clauses.append("nc.created_at < :card_to")
        params["card_to"] = datetime.combine(
            filters.period_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
        )
    return " AND ".join(clauses), params


async def build_dashboard(
    db: AsyncSession, filters: DashboardFilters | None = None
) -> dict[str, Any]:
    """Module 1 — tableau de bord national (agrégats datés, filtrables, sans PII)."""
    f = filters or DashboardFilters()

    where_all, p_all = _citizen_where(f)
    where_active, p_active = _citizen_where(f, status="ACTIVE")
    where_pending, p_pending = _citizen_where(f)
    # dossiers en attente : DRAFT + PENDING_VALIDATION (sauf si statut forcé)
    if f.citizen_status:
        where_pending_sql = where_all
        p_pending_use = p_all
        pending_count = await _safe_count(
            db,
            f"SELECT COUNT(*) FROM core_registry.citizens c WHERE {where_pending_sql}",
            p_pending_use,
        ) if f.citizen_status in {"DRAFT", "PENDING_VALIDATION"} else 0
    else:
        pending_count = await _safe_count(
            db,
            f"""
            SELECT COUNT(*) FROM core_registry.citizens c
            WHERE {where_pending} AND c.status IN ('DRAFT', 'PENDING_VALIDATION')
            """,
            p_pending,
        )

    population_total = await _safe_count(
        db, f"SELECT COUNT(*) FROM core_registry.citizens c WHERE {where_all}", p_all
    )
    population_active = await _safe_count(
        db, f"SELECT COUNT(*) FROM core_registry.citizens c WHERE {where_active}", p_active
    )
    nin_assigned = await _safe_count(
        db,
        f"SELECT COUNT(*) FROM core_registry.citizens c WHERE {where_all} AND c.nic IS NOT NULL",
        p_all,
    )

    campaigns_active = await _safe_count(
        db,
        "SELECT COUNT(*) FROM recensement.campaigns WHERE status = 'ACTIVE'",
    )
    campaigns_total = await _safe_count(db, "SELECT COUNT(*) FROM recensement.campaigns")

    census_params: dict[str, Any] = {}
    census_extra = "1=1"
    if f.campaign_id:
        census_extra = "r.campaign_id = :campaign_id"
        census_params["campaign_id"] = str(f.campaign_id)
    if f.period_from:
        census_extra += " AND r.updated_at >= :c_from"
        census_params["c_from"] = datetime.combine(f.period_from, datetime.min.time(), tzinfo=timezone.utc)
    if f.period_to:
        census_extra += " AND r.updated_at < :c_to"
        census_params["c_to"] = datetime.combine(
            f.period_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
        )

    records_total = await _safe_count(
        db,
        f"SELECT COUNT(*) FROM recensement.census_records r WHERE {census_extra}",
        census_params,
    )
    records_synced = await _safe_count(
        db,
        f"""
        SELECT COUNT(*) FROM recensement.census_records r
        WHERE {census_extra} AND r.status IN ('SYNCED', 'APPROVED', 'PROMOTED')
        """,
        census_params,
    )
    records_promoted = await _safe_count(
        db,
        f"SELECT COUNT(*) FROM recensement.census_records r WHERE {census_extra} AND r.status = 'PROMOTED'",
        census_params,
    )
    sync_rate = round(100.0 * records_synced / records_total, 2) if records_total else 0.0

    duplicates_open = await _safe_count(
        db,
        "SELECT COUNT(*) FROM core_registry.duplicate_candidates WHERE status = 'OPEN'",
    )
    biometric_dedup_review = await _safe_count(
        db,
        "SELECT COUNT(*) FROM biometric.dedup_sessions WHERE decision = 'MANUAL_REVIEW'",
    )
    biometric_match_pending = await _safe_count(
        db,
        "SELECT COUNT(*) FROM biometric.biometric_matches WHERE review_status = 'PENDING'",
    )

    cw_active, cp_active = _card_where(f, status_in=["ACTIVE"] if not f.card_status else None)
    if f.card_status:
        cards_active = await _safe_count(
            db,
            f"SELECT COUNT(*) FROM cards.national_cards nc WHERE {cw_active}",
            cp_active,
        ) if f.card_status == "ACTIVE" else 0
    else:
        cards_active = await _safe_count(
            db,
            f"SELECT COUNT(*) FROM cards.national_cards nc WHERE {cw_active}",
            cp_active,
        )

    cw_pending, cp_pending = _card_where(
        f, status_in=["PENDING", "SENT_TO_COMMUNE"] if not f.card_status else None
    )
    if f.card_status:
        cards_pending = await _safe_count(
            db,
            f"SELECT COUNT(*) FROM cards.national_cards nc WHERE {cw_pending}",
            cp_pending,
        ) if f.card_status in {"PENDING", "SENT_TO_COMMUNE"} else 0
    else:
        cards_pending = await _safe_count(
            db,
            f"SELECT COUNT(*) FROM cards.national_cards nc WHERE {cw_pending}",
            cp_pending,
        )

    cw_del, cp_del = _card_where(f, status_in=["DELIVERED"] if not f.card_status else None)
    if f.card_status == "DELIVERED" or not f.card_status:
        if f.card_status == "DELIVERED":
            cards_delivered = await _safe_count(
                db,
                f"SELECT COUNT(*) FROM cards.national_cards nc WHERE {cw_del}",
                cp_del,
            )
        else:
            # DELIVERED ou delivered_at renseigné
            cards_delivered = await _safe_count(
                db,
                """
                SELECT COUNT(*) FROM cards.national_cards nc
                WHERE nc.status = 'DELIVERED' OR nc.delivered_at IS NOT NULL
                """,
            )
    else:
        cards_delivered = 0

    cards_produced = await _safe_count(
        db,
        f"SELECT COUNT(*) FROM cards.national_cards nc WHERE {_card_where(f)[0]}",
        _card_where(f)[1],
    )

    civil_pending = await _safe_count(
        db,
        "SELECT COUNT(*) FROM etat_civil.civil_declarations WHERE status = 'PENDING_OFFICER'",
    )
    sync_batches_pending = await _safe_count(
        db,
        "SELECT COUNT(*) FROM recensement.sync_batches WHERE status IN ('PENDING', 'PROCESSING')",
    )
    sync_failures = await _safe_count(
        db,
        "SELECT COUNT(*) FROM recensement.sync_batches WHERE status IN ('REJECTED', 'PARTIAL')",
    )
    pending_draft = await _safe_count(
        db,
        f"SELECT COUNT(*) FROM core_registry.citizens c WHERE {where_all} AND c.status = 'DRAFT'",
        p_all,
    )
    pending_validation = await _safe_count(
        db,
        f"""
        SELECT COUNT(*) FROM core_registry.citizens c
        WHERE {where_all} AND c.status = 'PENDING_VALIDATION'
        """,
        p_all,
    )
    cards_expired = await _safe_count(
        db,
        """
        SELECT COUNT(*) FROM cards.national_cards nc
        WHERE nc.status = 'EXPIRED'
           OR (
             nc.expires_at IS NOT NULL
             AND nc.expires_at < NOW()
             AND nc.status NOT IN ('REVOKED', 'REPLACED', 'EXPIRED')
           )
        """,
    )
    citizens_probe = await _safe_metric(
        db, "SELECT COUNT(*) FROM core_registry.citizens", source="core_registry.citizens"
    )
    cards_probe = await _safe_metric(
        db, "SELECT COUNT(*) FROM cards.national_cards", source="cards.national_cards"
    )
    census_probe = await _safe_metric(
        db, "SELECT COUNT(*) FROM recensement.campaigns", source="recensement.campaigns"
    )

    denom_validation = population_active + pending_count
    validation_rate: float | None = (
        round(100.0 * population_active / denom_validation, 1) if denom_validation else None
    )
    coverage_pct = (
        round(100.0 * population_active / population_total, 2) if population_total else 0.0
    )
    nin_coverage = (
        round(100.0 * nin_assigned / population_total, 2) if population_total else 0.0
    )
    sources = [citizens_probe, cards_probe, census_probe]
    unavailable = sum(1 for s in sources if s["status"] != "ok")
    freshness = "degraded" if unavailable else "current"
    pending_by_status = {
        "DRAFT": pending_draft,
        "PENDING_VALIDATION": pending_validation,
    }

    anomalies: list[dict[str, Any]] = []
    if duplicates_open:
        anomalies.append(
            {
                "id": "dup-open",
                "code": "DUPLICATES_OPEN",
                "severity": "high",
                "status": "open",
                "count": duplicates_open,
                "message": "Doublons démographiques ouverts à examiner",
                "module": "fgp",
                "link": "/anomalies",
            }
        )
    if biometric_dedup_review or biometric_match_pending:
        anomalies.append(
            {
                "id": "bio-review",
                "code": "BIOMETRIC_MANUAL_REVIEW",
                "severity": "high",
                "status": "open",
                "count": biometric_dedup_review + biometric_match_pending,
                "message": "Correspondances biométriques en revue humaine",
                "module": "biometric",
                "link": "/biometrie",
            }
        )
    if civil_pending:
        anomalies.append(
            {
                "id": "civil-pending",
                "code": "CIVIL_PENDING",
                "severity": "medium",
                "status": "open",
                "count": civil_pending,
                "message": "Déclarations d'état civil en attente",
                "module": "civil",
                "link": "/etat-civil",
            }
        )
    if sync_batches_pending:
        anomalies.append(
            {
                "id": "sync-backlog",
                "code": "SYNC_BACKLOG",
                "severity": "medium",
                "status": "open",
                "count": sync_batches_pending,
                "message": "Lots de synchronisation terrain en attente",
                "module": "census",
                "link": "/campaigns",
            }
        )
    if sync_failures:
        anomalies.append(
            {
                "id": "sync-fail",
                "code": "SYNC_FAILURES",
                "severity": "high",
                "status": "open",
                "count": sync_failures,
                "message": "Lots de synchronisation rejetés ou partiels",
                "module": "census",
                "link": "/campaigns",
            }
        )
    if pending_count:
        anomalies.append(
            {
                "id": "dossiers-pending",
                "code": "DOSSIERS_PENDING",
                "severity": "low",
                "status": "open",
                "count": pending_count,
                "message": "Dossiers FGP en brouillon / validation",
                "module": "fgp",
                "link": "/population",
            }
        )

    empty = population_total == 0 and records_total == 0 and cards_produced == 0
    generated_at = datetime.now(timezone.utc).isoformat()
    filters_applied = {
        "period_from": f.period_from.isoformat() if f.period_from else None,
        "period_to": f.period_to.isoformat() if f.period_to else None,
        "province_code": f.province_code,
        "commune_code": f.commune_code,
        "campaign_id": str(f.campaign_id) if f.campaign_id else None,
        "citizen_status": f.citizen_status,
        "card_status": f.card_status,
    }

    kpis = {
        "registered_records": population_total,
        "validated_records": population_active,
        "pending_records": pending_count,
        "pending_by_status": pending_by_status,
        "assigned_nins": nin_assigned,
        "duplicate_reviews_open": duplicates_open,
        "cards_produced": cards_produced,
        "cards_delivered": cards_delivered,
        "cards_expired": cards_expired,
        "cards_pending": cards_pending,
        "validation_rate_percent": validation_rate,
        "sync_rate_percent": sync_rate if records_total else None,
        "sync_failures": sync_failures,
        "campaigns_active": campaigns_active,
    }

    alerts_summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for a in anomalies:
        sev = (a.get("severity") or "info").lower()
        if sev in alerts_summary:
            alerts_summary[sev] += 1

    from apps.api.domains.core_registry.national_identity_number_service import (
        OFFICIAL_NIN_FORMAT_CONFIRMED,
    )

    return {
        "module": 1,
        "title": "Tableau de bord national",
        "generated_at": generated_at,
        "meta": {
            "generated_at": generated_at,
            "period": {
                "from": filters_applied["period_from"],
                "to": filters_applied["period_to"],
            },
            "scope": {
                "province_code": f.province_code,
                "commune_code": f.commune_code,
                "campaign_id": filters_applied["campaign_id"],
            },
            "freshness": freshness,
            "timezone": "UTC",
            "official_nin_format_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
            "kpi_dictionary": "docs/legal/onip/MODULE_1_DICTIONNAIRE_KPI.md",
        },
        "filters_applied": filters_applied,
        "empty": empty,
        "kpis": kpis,
        "alerts": alerts_summary,
        "sources": sources,
        "population": {
            "total": population_total,
            "active": population_active,
            "pending": pending_count,
            "pending_by_status": pending_by_status,
            "nin_assigned": nin_assigned,
            "coverage_percent": coverage_pct,
            "nin_coverage_percent": nin_coverage,
            "validation_rate_percent": validation_rate,
        },
        "campaigns": {
            "total": campaigns_total,
            "active": campaigns_active,
            "records_total": records_total,
            "records_synced": records_synced,
            "records_promoted": records_promoted,
            "sync_rate_percent": sync_rate if records_total else None,
            "sync_failures": sync_failures,
        },
        "duplicates_open": duplicates_open,
        "biometric_reviews_pending": biometric_match_pending + biometric_dedup_review,
        "cards": {
            "produced": cards_produced,
            "active": cards_active,
            "pending": cards_pending,
            "delivered": cards_delivered,
            "expired": cards_expired,
        },
        "services": {
            "api": "up",
            "onip_dashboard": "ok",
            "sync_batches_pending": sync_batches_pending,
            "civil_pending": civil_pending,
            "sync_failures": sync_failures,
        },
        "anomalies": anomalies,
        "export": {
            "format": "aggregate_csv",
            "pii": False,
            "note": "Export contrôlé : indicateurs agrégés uniquement",
        },
        "drilldown": {
            "duplicates": "/anomalies",
            "biometric": "/biometrie",
            "cards": "/cards",
            "campaigns": "/campaigns",
            "population": "/population",
            "nin": "/nic",
            "civil": "/etat-civil",
            "admin": "/admin",
        },
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


async def build_dashboard_trends(
    db: AsyncSession, filters: DashboardFilters | None = None, *, days: int = 30
) -> dict[str, Any]:
    """Séries temporelles dossiers créés / validés (agrégats, cahier §7.2)."""
    f = filters or DashboardFilters()
    days = max(1, min(days, 180))
    end = f.period_to or date.today()
    start = f.period_from or (end - timedelta(days=days - 1))
    where, params = _citizen_where(
        DashboardFilters(
            period_from=start,
            period_to=end,
            province_code=f.province_code,
            commune_code=f.commune_code,
            campaign_id=f.campaign_id,
        )
    )
    created_rows = await _safe_rows(
        db,
        f"""
        SELECT DATE(c.created_at) AS day, COUNT(*)::int AS count
        FROM core_registry.citizens c
        WHERE {where}
        GROUP BY DATE(c.created_at)
        ORDER BY day
        """,
        params,
    )
    validated_rows = await _safe_rows(
        db,
        f"""
        SELECT DATE(COALESCE(c.validated_at, c.created_at)) AS day, COUNT(*)::int AS count
        FROM core_registry.citizens c
        WHERE {where} AND c.status = 'ACTIVE'
        GROUP BY DATE(COALESCE(c.validated_at, c.created_at))
        ORDER BY day
        """,
        params,
    )
    created_map = {str(r["day"]): int(r["count"]) for r in created_rows if r.get("day") is not None}
    validated_map = {
        str(r["day"]): int(r["count"]) for r in validated_rows if r.get("day") is not None
    }
    series: list[dict[str, Any]] = []
    cur = start
    while cur <= end:
        key = cur.isoformat()
        series.append(
            {
                "day": key,
                "registered": created_map.get(key, 0),
                "validated": validated_map.get(key, 0),
            }
        )
        cur += timedelta(days=1)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "unit": "day",
        "series": series,
        "definitions": {
            "registered": "citizens.created_at",
            "validated": "citizens ACTIVE by validated_at/created_at",
        },
    }


async def build_dashboard_territories(
    db: AsyncSession, filters: DashboardFilters | None = None, *, limit: int = 30
) -> dict[str, Any]:
    """Répartition territoriale agrégée (cahier §7.3) — province_code."""
    f = filters or DashboardFilters()
    where, params = _citizen_where(f)
    params = {**params, "lim": max(1, min(limit, 100))}
    rows = await _safe_rows(
        db,
        f"""
        SELECT UPPER(COALESCE(NULLIF(a.province_code, ''), 'INCONNU')) AS zone,
               COUNT(DISTINCT c.id)::int AS registered,
               COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ACTIVE')::int AS validated,
               COUNT(DISTINCT c.id) FILTER (WHERE c.nic IS NOT NULL)::int AS nin_assigned
        FROM core_registry.citizens c
        LEFT JOIN core_registry.citizen_addresses a ON a.citizen_id = c.id
        WHERE {where}
        GROUP BY UPPER(COALESCE(NULLIF(a.province_code, ''), 'INCONNU'))
        ORDER BY registered DESC
        LIMIT :lim
        """,
        params,
    )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "level": "province",
        "count": len(rows),
        "zones": [
            {
                "zone": r.get("zone") or "INCONNU",
                "registered": int(r.get("registered") or 0),
                "validated": int(r.get("validated") or 0),
                "nin_assigned": int(r.get("nin_assigned") or 0),
            }
            for r in rows
        ],
        "note": "Agrégats uniquement — pas de liste nominative",
    }


async def build_dashboard_alerts(
    db: AsyncSession, filters: DashboardFilters | None = None
) -> dict[str, Any]:
    """Centre d'alertes synthétique (cahier §8) — sans PII."""
    dash = await build_dashboard(db, filters)
    items = list(dash.get("anomalies") or [])
    items.sort(
        key=lambda a: {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}.get(
            str(a.get("severity", "info")).lower(), 9
        )
    )
    return {
        "generated_at": dash.get("generated_at"),
        "summary": dash.get("alerts") or {},
        "items": items,
        "freshness": (dash.get("meta") or {}).get("freshness"),
    }


async def build_dashboard_health(db: AsyncSession) -> dict[str, Any]:
    """Santé services surveillés (cahier §7.6) — inconnu ≠ opérationnel."""
    now = datetime.now(timezone.utc).isoformat()
    probes = [
        await _safe_metric(db, "SELECT 1", source="api_db"),
        await _safe_metric(
            db, "SELECT COUNT(*) FROM core_registry.citizens", source="core_registry"
        ),
        await _safe_metric(
            db, "SELECT COUNT(*) FROM recensement.sync_batches", source="sync"
        ),
        await _safe_metric(
            db,
            "SELECT COUNT(*) FROM biometric.biometric_matches",
            source="biometric",
        ),
    ]
    services = []
    for p in probes:
        if p["status"] == "ok":
            state = "operational"
        else:
            state = "unknown"
        services.append(
            {
                "service": p["source"],
                "state": state,
                "checked_at": now,
                "detail": None if state == "operational" else p.get("reason"),
            }
        )
    return {
        "generated_at": now,
        "services": services,
        "note": "Seules les sondes réellement exécutées sont listées ; unknown ≠ operational",
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
