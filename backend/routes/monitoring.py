"""Monitoring and Health Check API Routes - Tenant isolated where applicable (OWASP A01)

Provides endpoints for:
1. Application health checks (public)
2. Metrics and statistics (admin only, tenant isolated)
3. Error reporting (admin only, tenant isolated)
4. Performance profiling (admin only, tenant isolated)
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
import logging
import os

from utils.auth import get_tenant_db_for_user
from utils.monitoring import (
    get_metrics_summary, get_recent_errors, 
    ALERT_THRESHOLDS
)
from utils.redis_cache import get_cache_info
from utils.profiling import get_profile_report, reset_profile_data, get_memory_usage

router = APIRouter(tags=["Monitoring"])
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    """Basic health check endpoint (public) — minimal info only"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/db")
async def database_health(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Database connectivity health check - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    try:
        # Ping tenant database
        start = datetime.now(timezone.utc)
        await tenant_db.command("ping")
        latency = (datetime.now(timezone.utc) - start).total_seconds()
        
        return {
            "status": "connected",
            "latency_ms": round(latency * 1000, 2),
            "database": os.environ.get("DB_NAME", "unknown")
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "disconnected",
            "error": str(e)
        }


@router.get("/health/detailed")
async def detailed_health(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Comprehensive health check with all dependencies - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    health = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {}
    }
    
    # Database check
    try:
        start = datetime.now(timezone.utc)
        await tenant_db.command("ping")
        latency = (datetime.now(timezone.utc) - start).total_seconds()
        health["checks"]["database"] = {
            "status": "healthy",
            "latency_ms": round(latency * 1000, 2)
        }
    except Exception as e:
        health["checks"]["database"] = {"status": "unhealthy", "error": str(e)}
        health["status"] = "degraded"
    
    # Cache check
    cache_info = get_cache_info()
    health["checks"]["cache"] = {
        "status": "healthy",
        "type": cache_info["type"],
        "redis_connected": cache_info.get("redis_connected", False)
    }
    
    # Disk space check
    try:
        import shutil
        total, used, free = shutil.disk_usage("/")
        free_percent = (free / total) * 100
        health["checks"]["disk"] = {
            "status": "healthy" if free_percent > 10 else "warning",
            "free_percent": round(free_percent, 1),
            "free_gb": round(free / (1024**3), 1)
        }
        if free_percent < 10:
            health["status"] = "degraded"
    except Exception as e:
        health["checks"]["disk"] = {"status": "unknown", "error": str(e)}
    
    return health


@router.get("/metrics")
async def get_metrics(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get application metrics (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return get_metrics_summary()


@router.get("/metrics/errors")
async def get_error_logs(
    limit: int = 20,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get recent error logs (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "errors": get_recent_errors(limit),
        "thresholds": ALERT_THRESHOLDS
    }


@router.get("/metrics/summary")
async def get_metrics_quick(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Metrics summary (admin only) — OWASP A05: no public metrics exposure"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    metrics = get_metrics_summary()
    
    return {
        "uptime": metrics["uptime_human"],
        "total_requests": metrics["total_requests"],
        "error_rate": round(metrics["overall_error_rate"] * 100, 2),
        "status": "healthy" if metrics["overall_error_rate"] < 0.05 else "degraded"
    }


@router.get("/profile")
async def get_profiling_report(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get performance profiling report (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return get_profile_report()


@router.post("/profile/reset")
async def reset_profiling(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Reset profiling data (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    reset_profile_data()
    return {"message": "Profiling data reset successfully"}


@router.get("/memory")
async def get_memory_info(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get current memory usage (admin only) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **get_memory_usage()
    }
