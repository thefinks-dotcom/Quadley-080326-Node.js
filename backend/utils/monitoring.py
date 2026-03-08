"""Application Monitoring and Alerting System

Provides:
1. Health check endpoints with detailed diagnostics
2. Metrics collection and reporting
3. Error tracking and alerting
4. Performance monitoring
"""
import os
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from collections import defaultdict
from functools import wraps
import traceback

logger = logging.getLogger(__name__)

# Metrics storage (in-memory, use Redis/Prometheus in production)
_metrics = {
    "requests": defaultdict(int),  # endpoint -> count
    "errors": defaultdict(int),  # endpoint -> error_count
    "latencies": defaultdict(list),  # endpoint -> [latencies]
    "start_time": datetime.now(timezone.utc),
    "last_errors": [],  # Last 100 errors
}

# Alert thresholds
ALERT_THRESHOLDS = {
    "error_rate": float(os.environ.get("ALERT_ERROR_RATE", "0.1")),  # 10%
    "latency_p95": float(os.environ.get("ALERT_LATENCY_P95", "2.0")),  # 2 seconds
    "db_response_time": float(os.environ.get("ALERT_DB_RESPONSE", "1.0")),  # 1 second
}

# Webhook URL for alerts (Slack, Discord, etc.)
ALERT_WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL")


def record_request(endpoint: str, latency: float, is_error: bool = False):
    """Record a request for metrics collection"""
    _metrics["requests"][endpoint] += 1
    _metrics["latencies"][endpoint].append(latency)
    
    # Keep only last 1000 latencies per endpoint
    if len(_metrics["latencies"][endpoint]) > 1000:
        _metrics["latencies"][endpoint] = _metrics["latencies"][endpoint][-1000:]
    
    if is_error:
        _metrics["errors"][endpoint] += 1


def record_error(endpoint: str, error: Exception, request_info: Optional[Dict] = None):
    """Record an error for monitoring"""
    error_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "error_type": type(error).__name__,
        "error_message": str(error),
        "traceback": traceback.format_exc(),
        "request_info": request_info or {}
    }
    
    _metrics["last_errors"].append(error_entry)
    
    # Keep only last 100 errors
    if len(_metrics["last_errors"]) > 100:
        _metrics["last_errors"] = _metrics["last_errors"][-100:]
    
    # Check if we should alert
    asyncio.create_task(check_and_alert(endpoint, error_entry))


async def check_and_alert(endpoint: str, error_entry: Dict):
    """Check if alerts should be sent based on thresholds"""
    if not ALERT_WEBHOOK_URL:
        return
    
    # Calculate error rate for this endpoint
    requests = _metrics["requests"].get(endpoint, 1)
    errors = _metrics["errors"].get(endpoint, 0)
    error_rate = errors / max(requests, 1)
    
    if error_rate > ALERT_THRESHOLDS["error_rate"]:
        await send_alert(
            title=f"🚨 High Error Rate: {endpoint}",
            message=f"Error rate: {error_rate:.1%} ({errors}/{requests} requests)\n"
                   f"Latest error: {error_entry['error_type']}: {error_entry['error_message']}"
        )


async def send_alert(title: str, message: str):
    """Send alert to configured webhook"""
    if not ALERT_WEBHOOK_URL:
        logger.warning(f"Alert (no webhook configured): {title} - {message}")
        return
    
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            # Supports Slack-style webhooks
            payload = {
                "text": f"*{title}*\n{message}",
                "username": "Quadley Monitor",
            }
            await client.post(ALERT_WEBHOOK_URL, json=payload, timeout=5)
            logger.info(f"Alert sent: {title}")
    except Exception as e:
        logger.error(f"Failed to send alert: {e}")


def calculate_percentile(values: List[float], percentile: int) -> float:
    """Calculate percentile from a list of values"""
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = int(len(sorted_values) * percentile / 100)
    return sorted_values[min(index, len(sorted_values) - 1)]


def get_metrics_summary() -> Dict[str, Any]:
    """Get summary of all collected metrics"""
    uptime = datetime.now(timezone.utc) - _metrics["start_time"]
    
    endpoint_stats = {}
    for endpoint in set(list(_metrics["requests"].keys()) + list(_metrics["errors"].keys())):
        requests = _metrics["requests"].get(endpoint, 0)
        errors = _metrics["errors"].get(endpoint, 0)
        latencies = _metrics["latencies"].get(endpoint, [])
        
        endpoint_stats[endpoint] = {
            "requests": requests,
            "errors": errors,
            "error_rate": errors / max(requests, 1),
            "latency_avg": sum(latencies) / len(latencies) if latencies else 0,
            "latency_p50": calculate_percentile(latencies, 50),
            "latency_p95": calculate_percentile(latencies, 95),
            "latency_p99": calculate_percentile(latencies, 99),
        }
    
    total_requests = sum(_metrics["requests"].values())
    total_errors = sum(_metrics["errors"].values())
    
    return {
        "uptime_seconds": int(uptime.total_seconds()),
        "uptime_human": str(uptime).split(".")[0],
        "start_time": _metrics["start_time"].isoformat(),
        "total_requests": total_requests,
        "total_errors": total_errors,
        "overall_error_rate": total_errors / max(total_requests, 1),
        "endpoints": endpoint_stats,
        "recent_errors_count": len(_metrics["last_errors"]),
    }


def get_recent_errors(limit: int = 20) -> List[Dict]:
    """Get recent errors for debugging"""
    return _metrics["last_errors"][-limit:]


def reset_metrics():
    """Reset all metrics (for testing)"""
    global _metrics
    _metrics = {
        "requests": defaultdict(int),
        "errors": defaultdict(int),
        "latencies": defaultdict(list),
        "start_time": datetime.now(timezone.utc),
        "last_errors": [],
    }


class MetricsMiddleware:
    """FastAPI middleware for automatic metrics collection"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        is_error = False
        
        async def send_wrapper(message):
            nonlocal is_error
            if message["type"] == "http.response.start":
                status_code = message["status"]
                if status_code >= 400:
                    is_error = True
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            is_error = True
            raise
        finally:
            latency = time.time() - start_time
            path = scope.get("path", "unknown")
            
            # Skip static files and health checks
            if not path.startswith("/static") and path != "/health":
                record_request(path, latency, is_error)


# Decorator for tracking function performance
def track_performance(name: Optional[str] = None):
    """Decorator to track function execution time"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                record_request(name or func.__name__, time.time() - start, False)
                return result
            except Exception:
                record_request(name or func.__name__, time.time() - start, True)
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                record_request(name or func.__name__, time.time() - start, False)
                return result
            except Exception:
                record_request(name or func.__name__, time.time() - start, True)
                raise
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator
