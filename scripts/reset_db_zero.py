"""Remet la base nic_core à zéro : DROP schemas app + alembic upgrade.

Usage:
  .venv\\Scripts\\python.exe scripts\\reset_db_zero.py
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
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


APP_SCHEMAS = (
    "identity",
    "core_registry",
    "audit",
    "recensement",
    "etat_civil",
    "cards",
    "biometric",
    "health",
    "analytics",
    "geography",
    "notifications",
    "documents",
    "public",  # only drop alembic_version in public, not whole public
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
        rows = await conn.fetch(
            """
            SELECT nspname FROM pg_namespace
            WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND nspname NOT LIKE 'pg_%%'
            ORDER BY 1
            """
        )
        existing = {r["nspname"] for r in rows}
        print("schemas before:", sorted(existing))

        # Drop all non-system schemas except keep public (recreate alembic cleanly)
        for name in sorted(existing):
            if name == "public":
                continue
            print("DROP SCHEMA", name)
            await conn.execute(f'DROP SCHEMA IF EXISTS "{name}" CASCADE')

        await conn.execute("DROP TABLE IF EXISTS public.alembic_version CASCADE")
        print("Dropped alembic_version")
    finally:
        await conn.close()


def migrate() -> None:
    alembic = ROOT / ".venv" / "Scripts" / "alembic.exe"
    cmd = [str(alembic if alembic.exists() else "alembic"), "upgrade", "head"]
    print("Running:", " ".join(cmd))
    subprocess.check_call(cmd, cwd=str(ROOT))


def seed() -> None:
    py = ROOT / ".venv" / "Scripts" / "python.exe"
    script = ROOT / "scripts" / "seed_census_agent.py"
    if script.exists():
        print("Seeding comptes de connexion…")
        print("NOTE: redémarrer uvicorn avant seed si l'API tournait pendant le DROP.")
        rc = subprocess.call([str(py), str(script)], cwd=str(ROOT))
        if rc != 0:
            print(
                "Seed partiel (souvent zone geo absente) — comptes utilisateurs "
                "sont en général OK. Vérifier le login admin."
            )


async def count_citizens() -> int:
    import asyncpg

    conn = await asyncpg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "nic_admin"),
        password=os.environ.get("POSTGRES_PASSWORD", ""),
        database=os.environ.get("POSTGRES_DB", "nic_core"),
    )
    try:
        return int(await conn.fetchval("SELECT COUNT(*) FROM core_registry.citizens") or 0)
    finally:
        await conn.close()


def main() -> int:
    load_env()
    print("=== RESET DB À ZÉRO ===")
    asyncio.run(wipe())
    migrate()
    # comptes login uniquement (pas de population fictive massive)
    seed()
    n = asyncio.run(count_citizens())
    print(f"citizens après reset: {n}")
    print("OK — base réinitialisée.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
