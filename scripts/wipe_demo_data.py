"""Supprime les données métier (citoyens, recensement, mouvements, etc.).

Conserve IAM (comptes), géographie et structure Alembic.
Usage: .venv\\Scripts\\python.exe scripts\\wipe_demo_data.py
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


# Ordre : enfants avant parents (TRUNCATE CASCADE quand possible)
TABLES = (
    "population_movements.movement_event_history",
    "population_movements.population_movements",
    "core_registry.citizen_history",
    "core_registry.citizen_addresses",
    "core_registry.family_relations",
    "core_registry.citizen_zd_memberships",
    "core_registry.duplicate_candidates",
    "core_registry.citizens",
    "recensement.household_members",
    "recensement.households",
    "recensement.sync_batches",
    "recensement.form_drafts",
    "etat_civil.correction_requests",
    "etat_civil.civil_declarations",
    "etat_civil.civil_acts",
    "cards.card_requests",
    "cards.identity_cards",
    "biometric.biometric_templates",
    "biometric.biometric_enrollments",
    "biometric.match_candidates",
    "health.health_declarations",
    "analytics.identity_verifications",
)


async def wipe() -> None:
    import asyncpg

    conn = await asyncpg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "nic_admin"),
        password=os.environ.get("POSTGRES_PASSWORD", ""),
        database=os.environ.get("POSTGRES_DB", "nic_core"),
    )
    try:
        for table in TABLES:
            schema, name = table.split(".", 1)
            exists = await conn.fetchval(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = $2
                """,
                schema,
                name,
            )
            if not exists:
                print("skip (absent):", table)
                continue
            print("TRUNCATE", table)
            try:
                await conn.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
            except Exception as exc:  # noqa: BLE001
                print("  fail:", exc)
        n = await conn.fetchval("SELECT COUNT(*) FROM core_registry.citizens")
        print("citizens remaining:", n)
    finally:
        await conn.close()


def main() -> int:
    load_env()
    print("=== WIPE DONNÉES MÉTIER (pas IAM / géo) ===")
    asyncio.run(wipe())
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
