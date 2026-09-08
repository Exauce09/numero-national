#!/bin/sh
set -e

echo "[entrypoint] Waiting for PostgreSQL..."
python - <<'PY'
import os
import time
import sys

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

host = os.getenv("POSTGRES_HOST", "db")
port = os.getenv("POSTGRES_PORT", "5432")
user = os.getenv("POSTGRES_USER", "nic_admin")
password = os.getenv("POSTGRES_PASSWORD", "change-me")
db = os.getenv("POSTGRES_DB", "nic_core")
url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"

async def wait_db(retries: int = 30, delay: float = 2.0) -> None:
    engine = create_async_engine(url, pool_pre_ping=True)
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
            print(f"[entrypoint] PostgreSQL ready (attempt {attempt})")
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(f"[entrypoint] DB not ready ({attempt}/{retries}): {exc}")
            time.sleep(delay)
    await engine.dispose()
    print(f"[entrypoint] PostgreSQL unavailable: {last_error}", file=sys.stderr)
    sys.exit(1)

asyncio.run(wait_db())
PY

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running Alembic migrations..."
  alembic upgrade head
fi

echo "[entrypoint] Starting API..."
exec "$@"
