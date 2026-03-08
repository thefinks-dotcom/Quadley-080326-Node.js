"""Performance Profiling Utilities

Provides:
1. Database query profiling
2. API endpoint profiling
3. Memory usage tracking
4. Slow query detection
"""
import os
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from functools import wraps
from collections import defaultdict

logger = logging.getLogger(__name__)

# Configuration
SLOW_QUERY_THRESHOLD_MS = float(os.environ.get('SLOW_QUERY_THRESHOLD_MS', '100'))
PROFILE_ENABLED = os.environ.get('PROFILE_ENABLED', 'true').lower() == 'true'

# Storage for profiling data
_profile_data = {
    "queries": defaultdict(list),  # collection -> [query_times]
    "endpoints": defaultdict(list),  # endpoint -> [response_times]
    "slow_queries": [],  # List of slow queries
    "memory_snapshots": [],  # Memory usage over time
}


class QueryProfiler:
    """Context manager for profiling database queries"""
    
    def __init__(self, collection: str, operation: str, query: Optional[Dict] = None):
        self.collection = collection
        self.operation = operation
        self.query = query
        self.start_time = None
        self.duration_ms = None
    
    def __enter__(self):
        if PROFILE_ENABLED:
            self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if PROFILE_ENABLED and self.start_time:
            self.duration_ms = (time.time() - self.start_time) * 1000
            
            # Record the query time
            key = f"{self.collection}.{self.operation}"
            _profile_data["queries"][key].append(self.duration_ms)
            
            # Keep only last 1000 entries per collection
            if len(_profile_data["queries"][key]) > 1000:
                _profile_data["queries"][key] = _profile_data["queries"][key][-1000:]
            
            # Log slow queries
            if self.duration_ms > SLOW_QUERY_THRESHOLD_MS:
                slow_query = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "collection": self.collection,
                    "operation": self.operation,
                    "duration_ms": round(self.duration_ms, 2),
                    "query": str(self.query)[:500] if self.query else None
                }
                _profile_data["slow_queries"].append(slow_query)
                
                # Keep only last 100 slow queries
                if len(_profile_data["slow_queries"]) > 100:
                    _profile_data["slow_queries"] = _profile_data["slow_queries"][-100:]
                
                logger.warning(
                    f"Slow query detected: {self.collection}.{self.operation} "
                    f"took {self.duration_ms:.2f}ms"
                )
        
        return False  # Don't suppress exceptions


def profile_endpoint(name: Optional[str] = None):
    """Decorator to profile API endpoint performance"""
    def decorator(func):
        endpoint_name = name or func.__name__
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not PROFILE_ENABLED:
                return await func(*args, **kwargs)
            
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.time() - start) * 1000
                _profile_data["endpoints"][endpoint_name].append(duration_ms)
                
                # Keep only last 1000 entries
                if len(_profile_data["endpoints"][endpoint_name]) > 1000:
                    _profile_data["endpoints"][endpoint_name] = \
                        _profile_data["endpoints"][endpoint_name][-1000:]
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not PROFILE_ENABLED:
                return func(*args, **kwargs)
            
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.time() - start) * 1000
                _profile_data["endpoints"][endpoint_name].append(duration_ms)
                
                if len(_profile_data["endpoints"][endpoint_name]) > 1000:
                    _profile_data["endpoints"][endpoint_name] = \
                        _profile_data["endpoints"][endpoint_name][-1000:]
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


def get_memory_usage() -> Dict[str, Any]:
    """Get current memory usage"""
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_SELF)
        return {
            "max_rss_mb": usage.ru_maxrss / 1024,  # Convert to MB
            "user_time_s": usage.ru_utime,
            "system_time_s": usage.ru_stime,
        }
    except ImportError:
        return {"error": "resource module not available"}


def take_memory_snapshot():
    """Take a memory usage snapshot"""
    if not PROFILE_ENABLED:
        return
    
    snapshot = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **get_memory_usage()
    }
    _profile_data["memory_snapshots"].append(snapshot)
    
    # Keep only last 100 snapshots
    if len(_profile_data["memory_snapshots"]) > 100:
        _profile_data["memory_snapshots"] = _profile_data["memory_snapshots"][-100:]


def calculate_percentile(values: List[float], percentile: int) -> float:
    """Calculate percentile from a list of values"""
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = int(len(sorted_values) * percentile / 100)
    return sorted_values[min(index, len(sorted_values) - 1)]


def get_profile_report() -> Dict[str, Any]:
    """Generate a comprehensive profiling report"""
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "profiling_enabled": PROFILE_ENABLED,
        "slow_query_threshold_ms": SLOW_QUERY_THRESHOLD_MS,
        "queries": {},
        "endpoints": {},
        "slow_queries": _profile_data["slow_queries"][-20:],  # Last 20
        "memory": {
            "current": get_memory_usage(),
            "snapshots": _profile_data["memory_snapshots"][-10:]  # Last 10
        }
    }
    
    # Query statistics
    for key, times in _profile_data["queries"].items():
        if times:
            report["queries"][key] = {
                "count": len(times),
                "avg_ms": round(sum(times) / len(times), 2),
                "min_ms": round(min(times), 2),
                "max_ms": round(max(times), 2),
                "p50_ms": round(calculate_percentile(times, 50), 2),
                "p95_ms": round(calculate_percentile(times, 95), 2),
                "p99_ms": round(calculate_percentile(times, 99), 2),
            }
    
    # Endpoint statistics
    for endpoint, times in _profile_data["endpoints"].items():
        if times:
            report["endpoints"][endpoint] = {
                "count": len(times),
                "avg_ms": round(sum(times) / len(times), 2),
                "min_ms": round(min(times), 2),
                "max_ms": round(max(times), 2),
                "p50_ms": round(calculate_percentile(times, 50), 2),
                "p95_ms": round(calculate_percentile(times, 95), 2),
                "p99_ms": round(calculate_percentile(times, 99), 2),
            }
    
    return report


def reset_profile_data():
    """Reset all profiling data"""
    global _profile_data
    _profile_data = {
        "queries": defaultdict(list),
        "endpoints": defaultdict(list),
        "slow_queries": [],
        "memory_snapshots": [],
    }


# Background task to take periodic memory snapshots
async def memory_snapshot_task(interval_seconds: int = 60):
    """Background task to take periodic memory snapshots"""
    while True:
        take_memory_snapshot()
        await asyncio.sleep(interval_seconds)
