"""Redis client with in-memory fallback (rate-limit / ephemeral counters)."""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Protocol

from apps.api.core.config import get_settings

logger = logging.getLogger(__name__)


class RateLimiterBackend(Protocol):
    async def hit(self, key: str, *, limit: int, window_seconds: int = 60) -> bool:
        """Return True if allowed, False if over limit."""


class InMemoryRateLimiter:
    """Single-process sliding window (dev / fallback)."""

    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    async def hit(self, key: str, *, limit: int, window_seconds: int = 60) -> bool:
        now = time.monotonic()
        bucket = self._buckets[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True


class RedisRateLimiter:
    """Distributed fixed-window counter via Redis INCR + EXPIRE."""

    def __init__(self, redis) -> None:
        self._redis = redis

    async def hit(self, key: str, *, limit: int, window_seconds: int = 60) -> bool:
        full = f"rl:{key}"
        count = await self._redis.incr(full)
        if count == 1:
            await self._redis.expire(full, window_seconds)
        return int(count) <= limit


_limiter: RateLimiterBackend | None = None
_redis = None


async def get_redis():
    """Lazy Redis connection; None if unavailable."""
    global _redis
    settings = get_settings()
    if not settings.redis_url:
        return None
    if _redis is not None:
        return _redis
    try:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.redis_url, decode_responses=True)
        await client.ping()
        _redis = client
        logger.info("Redis connected (%s)", settings.redis_url.split("@")[-1])
        return _redis
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable, using in-memory fallback: %s", exc)
        return None


async def get_rate_limiter() -> RateLimiterBackend:
    global _limiter
    if _limiter is not None:
        return _limiter
    redis = await get_redis()
    if redis is not None:
        _limiter = RedisRateLimiter(redis)
    else:
        _limiter = InMemoryRateLimiter()
    return _limiter


async def close_redis() -> None:
    global _redis, _limiter
    if _redis is not None:
        await _redis.aclose()
    _redis = None
    _limiter = None


async def reset_rate_limiter_state() -> None:
    """Clear counters used by tests (in-memory + Redis ``rl:*`` keys)."""
    global _limiter
    if isinstance(_limiter, InMemoryRateLimiter):
        _limiter._buckets.clear()
    redis = await get_redis()
    if redis is not None:
        try:
            async for key in redis.scan_iter(match="rl:*", count=200):
                await redis.delete(key)
        except Exception:  # noqa: BLE001 — best-effort for pytest
            logger.warning("Could not clear Redis rate-limit keys", exc_info=True)
    # Force re-resolve so a fresh InMemory limiter is used if Redis was down.
    if _limiter is None or isinstance(_limiter, InMemoryRateLimiter):
        _limiter = InMemoryRateLimiter()


# --- Login failure counters (lockout) ---------------------------------------

_fail_memory: dict[str, tuple[int, float]] = {}


async def record_login_failure(key: str, *, window: int = 900) -> int:
    """Increment failure count; return current count."""
    redis = await get_redis()
    rk = f"login_fail:{key}"
    if redis is not None:
        count = await redis.incr(rk)
        if count == 1:
            await redis.expire(rk, window)
        return int(count)
    now = time.monotonic()
    count, exp = _fail_memory.get(key, (0, now + window))
    if now > exp:
        count, exp = 0, now + window
    count += 1
    _fail_memory[key] = (count, exp)
    return count


async def clear_login_failures(key: str) -> None:
    redis = await get_redis()
    if redis is not None:
        await redis.delete(f"login_fail:{key}")
    _fail_memory.pop(key, None)


async def is_login_locked(key: str, *, max_failures: int = 8) -> bool:
    redis = await get_redis()
    if redis is not None:
        raw = await redis.get(f"login_fail:{key}")
        return raw is not None and int(raw) >= max_failures
    count, exp = _fail_memory.get(key, (0, 0.0))
    if time.monotonic() > exp:
        return False
    return count >= max_failures
