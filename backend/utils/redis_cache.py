"""Redis-compatible caching utility with in-memory fallback.

This module provides a unified interface for caching that can work with:
1. Redis (production) - when REDIS_URL is set
2. In-memory (development/fallback) - when Redis is unavailable

OWASP A04 Compliance: Provides distributed rate limiting for production deployments.
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from collections import defaultdict

logger = logging.getLogger(__name__)

# Check for Redis availability
REDIS_URL = os.environ.get('REDIS_URL')
redis_client = None

if REDIS_URL:
    try:
        import redis
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        logger.info("Redis connection established for distributed caching")
    except ImportError:
        logger.warning("Redis package not installed. Using in-memory cache.")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Using in-memory cache.")
        redis_client = None


class CacheBackend:
    """Abstract cache backend interface"""
    
    def get(self, key: str) -> Optional[str]:
        raise NotImplementedError
    
    def set(self, key: str, value: str, ttl_seconds: int = None) -> bool:
        raise NotImplementedError
    
    def delete(self, key: str) -> bool:
        raise NotImplementedError
    
    def incr(self, key: str) -> int:
        raise NotImplementedError
    
    def expire(self, key: str, ttl_seconds: int) -> bool:
        raise NotImplementedError
    
    def get_list(self, key: str) -> List[str]:
        raise NotImplementedError
    
    def rpush(self, key: str, value: str) -> int:
        raise NotImplementedError
    
    def ltrim(self, key: str, start: int, end: int) -> bool:
        raise NotImplementedError


class RedisBackend(CacheBackend):
    """Redis-based cache backend"""
    
    def __init__(self, client):
        self.client = client
    
    def get(self, key: str) -> Optional[str]:
        try:
            return self.client.get(key)
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None
    
    def set(self, key: str, value: str, ttl_seconds: int = None) -> bool:
        try:
            if ttl_seconds:
                return self.client.setex(key, ttl_seconds, value)
            return self.client.set(key, value)
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        try:
            return self.client.delete(key) > 0
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            return False
    
    def incr(self, key: str) -> int:
        try:
            return self.client.incr(key)
        except Exception as e:
            logger.error(f"Redis INCR error: {e}")
            return 0
    
    def expire(self, key: str, ttl_seconds: int) -> bool:
        try:
            return self.client.expire(key, ttl_seconds)
        except Exception as e:
            logger.error(f"Redis EXPIRE error: {e}")
            return False
    
    def get_list(self, key: str) -> List[str]:
        try:
            return self.client.lrange(key, 0, -1)
        except Exception as e:
            logger.error(f"Redis LRANGE error: {e}")
            return []
    
    def rpush(self, key: str, value: str) -> int:
        try:
            return self.client.rpush(key, value)
        except Exception as e:
            logger.error(f"Redis RPUSH error: {e}")
            return 0
    
    def ltrim(self, key: str, start: int, end: int) -> bool:
        try:
            return self.client.ltrim(key, start, end)
        except Exception as e:
            logger.error(f"Redis LTRIM error: {e}")
            return False


class InMemoryBackend(CacheBackend):
    """In-memory cache backend for development/fallback"""
    
    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, datetime] = {}
        self._lists: Dict[str, List[str]] = defaultdict(list)
    
    def _is_expired(self, key: str) -> bool:
        if key in self._expiry:
            if datetime.now(timezone.utc) > self._expiry[key]:
                self.delete(key)
                return True
        return False
    
    def get(self, key: str) -> Optional[str]:
        if self._is_expired(key):
            return None
        return self._store.get(key)
    
    def set(self, key: str, value: str, ttl_seconds: int = None) -> bool:
        self._store[key] = value
        if ttl_seconds:
            self._expiry[key] = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        return True
    
    def delete(self, key: str) -> bool:
        deleted = key in self._store or key in self._lists
        self._store.pop(key, None)
        self._expiry.pop(key, None)
        self._lists.pop(key, None)
        return deleted
    
    def incr(self, key: str) -> int:
        current = int(self._store.get(key, 0))
        self._store[key] = str(current + 1)
        return current + 1
    
    def expire(self, key: str, ttl_seconds: int) -> bool:
        self._expiry[key] = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        return True
    
    def get_list(self, key: str) -> List[str]:
        if self._is_expired(key):
            return []
        return self._lists.get(key, [])
    
    def rpush(self, key: str, value: str) -> int:
        self._lists[key].append(value)
        return len(self._lists[key])
    
    def ltrim(self, key: str, start: int, end: int) -> bool:
        if key in self._lists:
            # Python slice end is exclusive, Redis ltrim end is inclusive
            self._lists[key] = self._lists[key][start:end + 1 if end >= 0 else None]
        return True


# Create the appropriate backend
if redis_client:
    cache = RedisBackend(redis_client)
    CACHE_TYPE = "redis"
else:
    cache = InMemoryBackend()
    CACHE_TYPE = "in-memory"


def get_cache_info() -> dict:
    """Get information about the current cache backend"""
    return {
        "type": CACHE_TYPE,
        "redis_url_configured": bool(REDIS_URL),
        "redis_connected": redis_client is not None
    }
