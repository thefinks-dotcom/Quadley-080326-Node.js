"""
Cross-Tenant Analytics routes for Super Admin.
Provides aggregated, anonymized analytics across all tenants.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import logging

from utils.auth import get_current_user
from utils.multi_tenant import master_db, get_tenant_db
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics/cross-tenant", tags=["analytics"])


@router.get("/overview")
async def get_cross_tenant_overview(
    current_user: User = Depends(get_current_user)
):
    """
    Get high-level overview analytics across all tenants.
    Super Admin only.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Get all tenants — project only the fields used in this route (no PII)
        tenants = await master_db.tenants.find(
            {},
            {"_id": 0, "code": 1, "status": 1, "subscription_tier": 1}
        ).to_list(1000)
        
        total_tenants = len(tenants)
        active_tenants = sum(1 for t in tenants if t.get('status') == 'active')
        suspended_tenants = sum(1 for t in tenants if t.get('status') == 'suspended')
        pending_tenants = sum(1 for t in tenants if t.get('status') == 'pending')
        
        # Aggregate user counts
        total_users = 0
        users_by_role = {"admin": 0, "ra": 0, "student": 0}
        users_by_tier = {"basic": 0, "pro": 0, "enterprise": 0}
        
        for tenant in tenants:
            tenant_code = tenant.get('code')
            tier = tenant.get('subscription_tier', 'basic')
            
            try:
                tenant_db = get_tenant_db(tenant_code)
                
                # Count users by role
                for role in ['admin', 'ra', 'student']:
                    count = await tenant_db.users.count_documents({"role": role})
                    users_by_role[role] += count
                    total_users += count
                    users_by_tier[tier] = users_by_tier.get(tier, 0) + count
            except Exception as e:
                logger.warning(f"Failed to get stats for tenant {tenant_code}: {e}")
        
        # Get pending invitations count
        pending_invitations = await master_db.invitations.count_documents({"status": "pending"})
        
        # Subscription breakdown
        subscription_breakdown = {
            "basic": sum(1 for t in tenants if t.get('subscription_tier', 'basic') == 'basic'),
            "pro": sum(1 for t in tenants if t.get('subscription_tier') == 'pro'),
            "enterprise": sum(1 for t in tenants if t.get('subscription_tier') == 'enterprise')
        }
        
        # Calculate monthly revenue (based on active subscriptions)
        monthly_revenue = (
            subscription_breakdown['basic'] * 99 +
            subscription_breakdown['pro'] * 299
            # Enterprise is custom pricing
        )
        
        return {
            "tenants": {
                "total": total_tenants,
                "active": active_tenants,
                "suspended": suspended_tenants,
                "pending": pending_tenants
            },
            "users": {
                "total": total_users,
                "by_role": users_by_role,
                "by_tier": users_by_tier,
                "pending_invitations": pending_invitations
            },
            "subscriptions": subscription_breakdown,
            "revenue": {
                "monthly_recurring": monthly_revenue,
                "currency": "USD"
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get cross-tenant overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch analytics")


@router.get("/activity")
async def get_cross_tenant_activity(
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """
    Get activity metrics across all tenants for the specified period.
    Super Admin only.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        tenants = await master_db.tenants.find(
            {"status": "active"},
            {"_id": 0, "code": 1, "name": 1}
        ).to_list(1000)
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_str = cutoff_date.isoformat()
        
        activity_metrics = {
            "events_created": 0,
            "announcements_created": 0,
            "messages_sent": 0,
            "maintenance_requests": 0,
            "bookings_made": 0,
            "shoutouts_given": 0,
            "new_users_registered": 0
        }
        
        tenant_activity = []
        
        for tenant in tenants:
            tenant_code = tenant.get('code')
            tenant_name = tenant.get('name')
            
            try:
                tenant_db = get_tenant_db(tenant_code)
                
                tenant_metrics = {
                    "tenant_code": tenant_code,
                    "tenant_name": tenant_name,
                    "events": 0,
                    "announcements": 0,
                    "messages": 0,
                    "maintenance": 0,
                    "bookings": 0,
                    "shoutouts": 0,
                    "new_users": 0
                }
                
                # Count events
                try:
                    events = await tenant_db.events.count_documents({
                        "created_at": {"$gte": cutoff_str}
                    })
                    tenant_metrics["events"] = events
                    activity_metrics["events_created"] += events
                except Exception:
                    pass
                
                # Count announcements
                try:
                    announcements = await tenant_db.announcements.count_documents({
                        "created_at": {"$gte": cutoff_str}
                    })
                    tenant_metrics["announcements"] = announcements
                    activity_metrics["announcements_created"] += announcements
                except Exception:
                    pass
                
                # Count messages
                try:
                    messages = await tenant_db.messages.count_documents({
                        "timestamp": {"$gte": cutoff_str}
                    })
                    tenant_metrics["messages"] = messages
                    activity_metrics["messages_sent"] += messages
                except Exception:
                    pass
                
                # Count maintenance requests
                try:
                    maintenance = await tenant_db.maintenance_requests.count_documents({
                        "created_at": {"$gte": cutoff_str}
                    })
                    tenant_metrics["maintenance"] = maintenance
                    activity_metrics["maintenance_requests"] += maintenance
                except Exception:
                    pass
                
                # Count bookings
                try:
                    bookings = await tenant_db.bookings.count_documents({
                        "created_at": {"$gte": cutoff_str}
                    })
                    tenant_metrics["bookings"] = bookings
                    activity_metrics["bookings_made"] += bookings
                except Exception:
                    pass
                
                # Count shoutouts
                try:
                    shoutouts = await tenant_db.shoutouts.count_documents({
                        "created_at": {"$gte": cutoff_str}
                    })
                    tenant_metrics["shoutouts"] = shoutouts
                    activity_metrics["shoutouts_given"] += shoutouts
                except Exception:
                    pass
                
                # Count new users
                try:
                    new_users = await tenant_db.users.count_documents({
                        "created_at": {"$gte": cutoff_str}
                    })
                    tenant_metrics["new_users"] = new_users
                    activity_metrics["new_users_registered"] += new_users
                except Exception:
                    pass
                
                tenant_activity.append(tenant_metrics)
                
            except Exception as e:
                logger.warning(f"Failed to get activity for tenant {tenant_code}: {e}")
        
        # Sort by total activity
        tenant_activity.sort(
            key=lambda x: sum([
                x.get("events", 0),
                x.get("announcements", 0),
                x.get("messages", 0),
                x.get("maintenance", 0),
                x.get("bookings", 0),
                x.get("shoutouts", 0)
            ]),
            reverse=True
        )
        
        return {
            "period_days": days,
            "period_start": cutoff_str,
            "period_end": datetime.now(timezone.utc).isoformat(),
            "totals": activity_metrics,
            "by_tenant": tenant_activity[:20],  # Top 20 most active
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get cross-tenant activity: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch activity metrics")


@router.get("/growth")
async def get_growth_metrics(
    current_user: User = Depends(get_current_user)
):
    """
    Get growth metrics (tenants and users over time).
    Super Admin only.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        tenants = await master_db.tenants.find(
            {},
            {"_id": 0, "code": 1, "created_at": 1}
        ).to_list(1000)
        
        # Group tenants by month
        tenants_by_month = {}
        for tenant in tenants:
            created_at = tenant.get('created_at')
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            month_key = created_at.strftime("%Y-%m")
            tenants_by_month[month_key] = tenants_by_month.get(month_key, 0) + 1
        
        # Get user growth (aggregate from all tenants)
        users_by_month = {}
        for tenant in tenants:
            tenant_code = tenant.get('code')
            try:
                tenant_db = get_tenant_db(tenant_code)
                users = await tenant_db.users.find({}, {"_id": 0, "created_at": 1}).to_list(10000)
                
                for user in users:
                    created_at = user.get('created_at')
                    if isinstance(created_at, str):
                        try:
                            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        except Exception:
                            continue
                    
                    if created_at:
                        month_key = created_at.strftime("%Y-%m")
                        users_by_month[month_key] = users_by_month.get(month_key, 0) + 1
            except Exception:
                pass
        
        # Sort and format for chart
        sorted_months = sorted(set(list(tenants_by_month.keys()) + list(users_by_month.keys())))
        
        growth_data = []
        cumulative_tenants = 0
        cumulative_users = 0
        
        for month in sorted_months:
            cumulative_tenants += tenants_by_month.get(month, 0)
            cumulative_users += users_by_month.get(month, 0)
            
            growth_data.append({
                "month": month,
                "new_tenants": tenants_by_month.get(month, 0),
                "cumulative_tenants": cumulative_tenants,
                "new_users": users_by_month.get(month, 0),
                "cumulative_users": cumulative_users
            })
        
        return {
            "growth": growth_data,
            "current_totals": {
                "tenants": cumulative_tenants,
                "users": cumulative_users
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get growth metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch growth metrics")


@router.get("/module-usage")
async def get_module_usage(
    current_user: User = Depends(get_current_user)
):
    """
    Get module usage statistics across all tenants.
    Super Admin only.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        tenants = await master_db.tenants.find(
            {"status": "active"},
            {"_id": 0, "enabled_modules": 1}
        ).to_list(1000)
        
        # Count how many tenants have each module enabled
        module_counts = {}
        all_modules = [
            "events", "announcements", "messages", "jobs", "dining",
            "maintenance", "recognition", "wellbeing", "academics",
            "cocurricular", "floor", "birthdays", "finance",
            "safe_disclosure", "parcels", "bookings"
        ]
        
        for module in all_modules:
            module_counts[module] = {
                "enabled_count": 0,
                "percentage": 0
            }
        
        for tenant in tenants:
            enabled_modules = tenant.get('enabled_modules', [])
            for module in enabled_modules:
                if module in module_counts:
                    module_counts[module]["enabled_count"] += 1
        
        # Calculate percentages
        total_active = len(tenants) if tenants else 1
        for module in module_counts:
            module_counts[module]["percentage"] = round(
                (module_counts[module]["enabled_count"] / total_active) * 100, 1
            )
        
        # Sort by usage
        sorted_modules = sorted(
            module_counts.items(),
            key=lambda x: x[1]["enabled_count"],
            reverse=True
        )
        
        return {
            "total_active_tenants": total_active,
            "module_usage": dict(sorted_modules),
            "most_popular": sorted_modules[:5] if sorted_modules else [],
            "least_used": sorted_modules[-5:] if len(sorted_modules) >= 5 else sorted_modules,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get module usage: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch module usage")
