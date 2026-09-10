"""Pytest fixtures for Phase 1 foundation tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.main import app


@pytest.fixture
async def client():
    """HTTP client bound to the FastAPI application.

    Dispose the shared async engine after each test so connections are not
    bound to a closed event loop (pytest-asyncio function-scoped loops).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    try:
        from apps.api.db.session import engine

        await engine.dispose()
    except Exception:  # noqa: BLE001 — teardown best-effort
        pass
