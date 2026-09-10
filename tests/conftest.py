"""Pytest fixtures for Phase 1 foundation tests."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from apps.api.core.config import get_settings
from apps.api.core.redis_client import InMemoryRateLimiter
from apps.api.main import app


@pytest.fixture
async def client():
    """HTTP client bound to the FastAPI application.

    Recreate the async SQLAlchemy engine for the current event loop and force
    an in-memory rate limiter (avoid Redis asyncio loop binding under
    BaseHTTPMiddleware + pytest-asyncio).
    """
    from apps.api.core import redis_client
    from apps.api.db import session as db_session

    settings = get_settings()

    try:
        await db_session.engine.dispose()
    except Exception:  # noqa: BLE001
        pass
    try:
        await redis_client.close_redis()
    except Exception:  # noqa: BLE001
        pass

    db_session.engine = create_async_engine(
        settings.async_database_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    db_session.AsyncSessionLocal = async_sessionmaker(
        bind=db_session.engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    # Never bind Redis to the pytest loop during ASGI middleware.
    async def _no_redis():
        return None

    redis_client.get_redis = _no_redis  # type: ignore[assignment]
    redis_client._limiter = InMemoryRateLimiter()
    redis_client._redis = None

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    try:
        await db_session.engine.dispose()
    except Exception:  # noqa: BLE001
        pass
