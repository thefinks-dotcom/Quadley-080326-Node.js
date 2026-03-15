"""Shared rate-limiter instance.

Import `limiter` from here in every router that needs @limiter.limit().
server.py registers this with app.state.limiter and adds the RateLimitExceeded
exception handler so all routes share the same counter store.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
