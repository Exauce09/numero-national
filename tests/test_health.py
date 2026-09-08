"""Startup / health endpoint tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.main import app


@pytest.mark.asyncio
async def test_health_endpoint_shape():
    """
    /health must always return a JSON body with status, api and database keys.

    When PostgreSQL is reachable: HTTP 200, status=ok, database=up.
    When PostgreSQL is unreachable: HTTP 503, status=degraded, database=down.
    The API process itself must always report api=up.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code in {200, 503}
    payload = response.json()
    assert set(payload.keys()) >= {"status", "api", "database"}
    assert payload["api"] == "up"
    assert payload["database"] in {"up", "down"}
    assert payload["status"] in {"ok", "degraded"}

    if response.status_code == 200:
        assert payload["status"] == "ok"
        assert payload["database"] == "up"
    else:
        assert payload["status"] == "degraded"
        assert payload["database"] == "down"


@pytest.mark.asyncio
async def test_openapi_docs_available_in_development():
    """OpenAPI docs must be exposed outside production."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/openapi.json")
    assert response.status_code == 200
    body = response.json()
    assert "openapi" in body
    assert "/health" in body.get("paths", {})


@pytest.mark.asyncio
async def test_app_factory_creates_routes():
    """Application factory must register the health route."""
    assert "/health" in app.openapi()["paths"]
