#!/usr/bin/env python3
"""Inventaire non destructif des NIC/NIN (Phase migration — plan ONIP).

Usage (avec DATABASE_URL sync ou asyncpg URL) :
  python scripts/inventory_nic_nin.py

N'écrit rien en base. Produit un résumé JSON sur stdout et
docs/legal/onip/inventory_nic_latest.json si le dossier est accessible.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "legal" / "onip" / "inventory_nic_latest.json"


def classify(nic: str | None) -> str:
    if nic is None or nic == "":
        return "null"
    s = str(nic).strip()
    if s.startswith("CD-"):
        return "fictif_cd_prefix"
    if re.fullmatch(r"\d{14}", s):
        return "provisional_14_digit"
    if re.fullmatch(r"\d{13}", s):
        return "legacy_13_digit"
    if not s.isdigit():
        return "non_numeric"
    return f"other_len_{len(s)}"


def main() -> int:
    url = os.environ.get("DATABASE_URL") or os.environ.get("SYNC_DATABASE_URL")
    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "official_nin_format_confirmed": False,
        "note": (
            "Inventaire informatif. Aucune conversion. "
            "Les 14 chiffres sont le format PROVISOIRE SIGPOP, pas le NIN officiel."
        ),
        "database_configured": bool(url),
        "counts": {},
        "samples": {},
    }

    if not url:
        report["error"] = "DATABASE_URL / SYNC_DATABASE_URL non défini — inventaire local uniquement."
        report["counts"] = {"skipped": True}
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    # Normalise async URL → sync pour SQLAlchemy synchrone simple
    sync_url = url.replace("postgresql+asyncpg://", "postgresql://")
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        report["error"] = "sqlalchemy manquant"
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 1

    engine = create_engine(sync_url)
    counter: Counter[str] = Counter()
    samples: dict[str, list[str]] = {}
    total = 0
    with_nic = 0

    sql = text(
        "SELECT nic FROM core_registry.citizens ORDER BY created_at NULLS LAST LIMIT 500000"
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql).fetchall()
    except Exception as exc:  # noqa: BLE001
        report["error"] = str(exc)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 1

    for (nic,) in rows:
        total += 1
        kind = classify(nic)
        counter[kind] += 1
        if nic:
            with_nic += 1
            samples.setdefault(kind, [])
            if len(samples[kind]) < 5:
                # Ne pas exposer de NIC complets en clair dans un rapport partagé : masquage
                s = str(nic)
                samples[kind].append(s[:4] + "…" + s[-2:] if len(s) > 6 else "***")

    report["counts"] = {
        "citizens_scanned": total,
        "with_nic": with_nic,
        "without_nic": total - with_nic,
        "by_class": dict(counter),
    }
    report["samples_masked"] = samples

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
