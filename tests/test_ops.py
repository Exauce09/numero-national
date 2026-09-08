"""Unit tests for refresh jti hashing and rate-limiter fallback."""

from apps.api.core.redis_client import InMemoryRateLimiter
from apps.api.domains.identity.refresh_store import hash_jti
import asyncio
import hashlib


def test_hash_jti_sha256():
    jti = "abc-123-jti"
    assert hash_jti(jti) == hashlib.sha256(jti.encode()).hexdigest()


def test_in_memory_rate_limiter():
    async def _run():
        lim = InMemoryRateLimiter()
        assert await lim.hit("k", limit=2) is True
        assert await lim.hit("k", limit=2) is True
        assert await lim.hit("k", limit=2) is False

    asyncio.run(_run())
