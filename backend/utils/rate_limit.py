"""Distributed rate limiting utility backed by Redis with in-memory fallback.

Uses the same cache backend as redis_cache.py — automatically uses Redis in
production and falls back to in-memory for development.  This makes rate limits
consistent across multiple server processes/containers (OWASP A04).
"""
from fastapi import HTTPException, status
from utils.redis_cache import cache


def check_rate_limit(
    user_id: str,
    action: str = "default",
    max_requests: int = 10,
    window_minutes: int = 1,
):
    """
    Sliding-window rate limiter backed by the shared cache (Redis / in-memory).

    Args:
        user_id:        User identifier (or IP for unauthenticated endpoints).
        action:         Label for the action being limited (e.g. "shoutout").
        max_requests:   Maximum requests allowed within the window.
        window_minutes: Length of the sliding window in minutes.

    Raises:
        HTTPException 429 if the limit is exceeded.
    """
    window_seconds = window_minutes * 60
    key = f"rl:{action}:{user_id}"

    count = cache.incr(key)

    if count == 1:
        cache.expire(key, window_seconds)

    if count > max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Rate limit exceeded. Maximum {max_requests} {action}s per "
                f"{window_minutes} minute(s). Please try again later."
            ),
        )

    return True
