"""Dashboard route - aggregate data for home screen - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import asyncio
import logging

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all dashboard data in one call - optimized with parallel queries - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    # Run independent queries in parallel
    upcoming_events_task = tenant_db.events.find(
        {"date": {"$gte": now_iso}},
        {"_id": 0}
    ).sort("date", 1).limit(5).to_list(5)
    
    is_admin_role = current_user.role in ['ra', 'admin', 'super_admin', 'college_admin']
    ann_audience = [
        {"target_audience": "all"},
        {"target_audience": "students"},
        {"target_audience": "everyone"},
        {"target_audience": {"$exists": False}},
        {"target_audience": None},
        {"target_audience": ""},
        {"target_audience": "specific_house", "house": current_user.floor}
    ]
    if is_admin_role:
        ann_audience += [{"target_audience": "ra"}, {"target_audience": "staff"}]

    recent_announcements_task = tenant_db.announcements.find(
        {"$or": ann_audience},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    unread_direct_task = tenant_db.messages.count_documents(
        {"receiver_id": current_user.id, "read": False, "sender_id": {"$ne": current_user.id}}
    )
    
    user_groups_task = tenant_db.message_groups.find(
        {"members": current_user.id},
        {"_id": 0, "id": 1}
    ).to_list(100)
    
    pending_maintenance_task = tenant_db.maintenance.count_documents(
        {"student_id": current_user.id, "status": "pending"}
    )
    
    streak_task = tenant_db.study_streaks.find_one({"student_id": current_user.id}, {"_id": 0})
    
    shoutouts_task = tenant_db.shoutouts.find(
        {
            "$or": [
                {"broadcast": True},
                {"from_user_id": current_user.id},
                {"to_user_id": current_user.id}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    unread_notifications_task = tenant_db.notification_history.count_documents(
        {"user_id": current_user.id, "read": False}
    )
    
    # Execute all independent queries in parallel
    results = await asyncio.gather(
        upcoming_events_task,
        recent_announcements_task,
        unread_direct_task,
        user_groups_task,
        pending_maintenance_task,
        streak_task,
        shoutouts_task,
        unread_notifications_task,
        return_exceptions=True
    )
    
    upcoming_events = results[0] if not isinstance(results[0], Exception) else []
    recent_announcements = results[1] if not isinstance(results[1], Exception) else []
    unread_direct = results[2] if not isinstance(results[2], Exception) else 0
    user_groups = results[3] if not isinstance(results[3], Exception) else []
    pending_maintenance = results[4] if not isinstance(results[4], Exception) else 0
    streak = results[5] if not isinstance(results[5], Exception) else None
    shoutouts = results[6] if not isinstance(results[6], Exception) else []
    unread_notifications = results[7] if not isinstance(results[7], Exception) else 0
    
    user_group_ids = [g['id'] for g in user_groups]
    
    # Count unread group messages (depends on user_groups result)
    unread_group = 0
    if user_group_ids:
        unread_group = await tenant_db.messages.count_documents({
            "$and": [
                {"group_id": {"$in": user_group_ids}},
                {"sender_id": {"$ne": current_user.id}},
                {"read_by": {"$nin": [current_user.id]}}
            ]
        })
    
    unread_messages = unread_direct + unread_group
    
    # Get recent unread message previews (keep limited for performance)
    query_conditions = [
        {"receiver_id": current_user.id, "read": False, "sender_id": {"$ne": current_user.id}}
    ]
    
    if user_group_ids:
        query_conditions.append({
            "group_id": {"$in": user_group_ids},
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$nin": [current_user.id]}
        })
    
    recent_unread = await tenant_db.messages.find(
        {"$or": query_conditions},
        {"_id": 0}
    ).sort("timestamp", -1).limit(5).to_list(5)
    
    for msg in recent_unread:
        if isinstance(msg.get('timestamp'), str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    # Upcoming birthdays (optimized with limit)
    today = datetime.now()
    week_from_now = today + timedelta(days=7)
    
    users_with_birthdays = await tenant_db.users.find(
        {
            "birthday": {"$exists": True, "$ne": None},
            "birthday_notifications": True
        },
        {"_id": 0, "password": 0}
    ).limit(200).to_list(200)
    
    upcoming_birthdays = []
    for user_doc in users_with_birthdays:
        if user_doc.get('birthday'):
            try:
                bday_str = user_doc['birthday']
                if len(bday_str.split('-')) == 3:
                    bday = datetime.strptime(bday_str, '%Y-%m-%d')
                else:
                    bday = datetime.strptime(f"{today.year}-{bday_str}", '%Y-%m-%d')
                
                bday_this_year = bday.replace(year=today.year)
                if bday_this_year < today:
                    bday_this_year = bday_this_year.replace(year=today.year + 1)
                
                if today <= bday_this_year <= week_from_now:
                    user_doc['birthday_date'] = bday_this_year.strftime('%Y-%m-%d')
                    user_doc['days_until'] = (bday_this_year - today).days
                    upcoming_birthdays.append(user_doc)
            except Exception:
                continue
    
    upcoming_birthdays.sort(key=lambda x: x.get('days_until', 999))
    
    return {
        "upcoming_events": upcoming_events,
        "recent_announcements": recent_announcements,
        "unread_messages_count": unread_messages,
        "unread_message_preview": recent_unread,
        "unread_notifications": unread_notifications,
        "pending_maintenance": pending_maintenance,
        "study_streak": streak.get('current_streak', 0) if streak else 0,
        "shoutouts": shoutouts,
        "upcoming_birthdays": upcoming_birthdays[:5]
    }


@router.get("/reports")
async def get_reports_data(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get comprehensive reports data for admin dashboard - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # ===== ENGAGEMENT HEATMAP (Activity by hour and day) =====
    # Get all messages from last 30 days with timestamps
    messages = await tenant_db.messages.find(
        {"timestamp": {"$gte": month_ago.isoformat()}},
        {"_id": 0, "timestamp": 1}
    ).to_list(10000)
    
    # Initialize heatmap grid (7 days x 24 hours)
    heatmap = [[0 for _ in range(24)] for _ in range(7)]
    
    for msg in messages:
        try:
            ts = msg.get('timestamp')
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            if ts:
                day = ts.weekday()  # 0=Monday, 6=Sunday
                hour = ts.hour
                heatmap[day][hour] += 1
        except Exception:
            continue
    
    # ===== WEEKLY DIGEST DATA =====
    # New users this week
    new_users = await tenant_db.users.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # Events this week
    week_events = await tenant_db.events.find(
        {"date": {"$gte": week_ago.isoformat(), "$lte": (now + timedelta(days=7)).isoformat()}},
        {"_id": 0}
    ).sort("date", 1).to_list(10)
    
    # Top recognitions this week
    top_recognized = await tenant_db.shoutouts.aggregate([
        {"$match": {"created_at": {"$gte": week_ago.isoformat()}}},
        {"$group": {"_id": "$to_user_id", "count": {"$sum": 1}, "name": {"$first": "$to_user_name"}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]).to_list(5)
    
    # Announcements this week
    week_announcements = await tenant_db.announcements.find(
        {"created_at": {"$gte": week_ago.isoformat()}},
        {"_id": 0, "title": 1, "target_audience": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(10)
    
    # Service requests resolved
    resolved_requests = await tenant_db.maintenance.count_documents({
        "status": "resolved",
        "updated_at": {"$gte": week_ago.isoformat()}
    })
    
    # Total messages this week
    week_messages = await tenant_db.messages.count_documents({
        "timestamp": {"$gte": week_ago.isoformat()}
    })
    
    # Total recognitions this week
    week_recognitions = await tenant_db.shoutouts.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # ===== EXPORT DATA COUNTS =====
    total_users = await tenant_db.users.count_documents({})
    total_events = await tenant_db.events.count_documents({})
    total_announcements = await tenant_db.announcements.count_documents({})
    total_groups = await tenant_db.cocurricular_groups.count_documents({})
    total_maintenance = await tenant_db.maintenance.count_documents({})
    total_recognitions = await tenant_db.shoutouts.count_documents({})
    
    return {
        "heatmap": {
            "data": heatmap,
            "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "max_value": max(max(row) for row in heatmap) if heatmap else 1
        },
        "weekly_digest": {
            "period": f"{week_ago.strftime('%b %d')} - {now.strftime('%b %d, %Y')}",
            "new_users": new_users,
            "messages_sent": week_messages,
            "recognitions_given": week_recognitions,
            "events_upcoming": week_events,
            "top_recognized": top_recognized,
            "announcements": week_announcements,
            "requests_resolved": resolved_requests
        },
        "export_counts": {
            "users": total_users,
            "events": total_events,
            "announcements": total_announcements,
            "groups": total_groups,
            "service_requests": total_maintenance,
            "recognitions": total_recognitions
        }
    }


@router.get("/export/{module}")
async def export_module_data(
    module: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Export module data as JSON (frontend converts to CSV) - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Audit log for data export (security-sensitive operation)
    logging.warning(f"DATA_EXPORT: User {current_user.email} (role: {current_user.role}) exported {module} data")
    
    data = []
    
    if module == "users":
        # Exclude sensitive fields - only export necessary user info
        data = await tenant_db.users.find({}, {
            "_id": 0, 
            "password": 0,
            "refresh_token": 0,
            "reset_token": 0,
            "api_key": 0
        }).to_list(10000)
        # Mask email for privacy (show only domain)
        for user in data:
            if user.get('email'):
                parts = user['email'].split('@')
                if len(parts) == 2:
                    user['email_domain'] = parts[1]
                    user['email'] = parts[0][:3] + '***@' + parts[1]
    elif module == "events":
        data = await tenant_db.events.find({}, {"_id": 0}).to_list(10000)
    elif module == "announcements":
        data = await tenant_db.announcements.find({}, {"_id": 0}).to_list(10000)
    elif module == "groups":
        data = await tenant_db.cocurricular_groups.find({}, {"_id": 0}).to_list(10000)
    elif module == "service_requests":
        data = await tenant_db.maintenance.find({}, {"_id": 0}).to_list(10000)
    elif module == "recognitions":
        data = await tenant_db.shoutouts.find({}, {"_id": 0}).to_list(10000)
    else:
        raise HTTPException(status_code=400, detail="Invalid module")
    
    return {"module": module, "count": len(data), "data": data}


@router.get("/admin")
async def get_admin_dashboard(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get admin dashboard data with activity feed, needs attention, and stats comparison - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    
    # ===== ACTIVITY FEED (Recent 20 items) =====
    activity_feed = []
    
    # Recent recognitions/shoutouts
    recent_shoutouts = await tenant_db.shoutouts.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    for s in recent_shoutouts:
        activity_feed.append({
            "type": "recognition",
            "icon": "award",
            "title": f"{s.get('from_user_name', 'Someone')} recognized {s.get('to_user_name', 'someone')}",
            "subtitle": s.get('category', 'Shoutout'),
            "timestamp": s.get('created_at'),
            "color": "amber"
        })
    
    # Recent service requests
    recent_maintenance = await tenant_db.maintenance.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    for m in recent_maintenance:
        activity_feed.append({
            "type": "service_request",
            "icon": "wrench",
            "title": f"New service request: {m.get('title', 'Maintenance')[:40]}",
            "subtitle": f"Priority: {m.get('priority', 'normal').title()}",
            "timestamp": m.get('created_at'),
            "color": "orange"
        })
    
    # Recent safety reports (only count, no details for privacy)
    safety_today = await tenant_db.safe_disclosures.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    if safety_today > 0:
        activity_feed.append({
            "type": "safety",
            "icon": "shield",
            "title": f"{safety_today} new safety report(s) today",
            "subtitle": "Requires review",
            "timestamp": now.isoformat(),
            "color": "red"
        })
    
    # Recent events created
    recent_events = await tenant_db.events.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(3).to_list(3)
    
    for e in recent_events:
        activity_feed.append({
            "type": "event",
            "icon": "calendar",
            "title": f"Event created: {e.get('title', 'New Event')[:40]}",
            "subtitle": f"Date: {e.get('date', '')[:10] if e.get('date') else 'TBD'}",
            "timestamp": e.get('created_at'),
            "color": "blue"
        })
    
    # Recent announcements
    recent_announcements = await tenant_db.announcements.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(3).to_list(3)
    
    for a in recent_announcements:
        activity_feed.append({
            "type": "announcement",
            "icon": "megaphone",
            "title": f"Announcement: {a.get('title', 'New Announcement')[:40]}",
            "subtitle": a.get('target_audience', 'all').replace('_', ' ').title(),
            "timestamp": a.get('created_at'),
            "color": "purple"
        })
    
    # Sort activity feed by timestamp
    def get_sort_key(item):
        ts = item.get('timestamp')
        if ts is None:
            return ''
        if isinstance(ts, datetime):
            return ts.isoformat()
        return str(ts)
    
    activity_feed.sort(key=get_sort_key, reverse=True)
    activity_feed = activity_feed[:15]  # Keep top 15
    
    # ===== NEEDS ATTENTION =====
    needs_attention = []
    
    # Pending service requests
    pending_service = await tenant_db.maintenance.count_documents({"status": "pending"})
    if pending_service > 0:
        needs_attention.append({
            "type": "service_requests",
            "title": "Pending Service Requests",
            "count": pending_service,
            "priority": "medium" if pending_service < 5 else "high",
            "action": "/college-admin/service-requests",
            "icon": "wrench",
            "color": "orange"
        })
    
    # Unreviewed safety reports
    safety_pending = await tenant_db.safe_disclosures.count_documents({
        "$or": [
            {"status": "pending"},
            {"status": "submitted"},
            {"risk_assessment": None}
        ]
    })
    if safety_pending > 0:
        needs_attention.append({
            "type": "safety",
            "title": "Safety Reports Pending Review",
            "count": safety_pending,
            "priority": "critical",
            "action": "/college-admin/safety-support",
            "icon": "shield",
            "color": "red"
        })
    
    # Urgent wellbeing requests
    wellbeing_urgent = await tenant_db.wellbeing_requests.count_documents({
        "priority": "urgent",
        "status": {"$ne": "resolved"}
    })
    if wellbeing_urgent > 0:
        needs_attention.append({
            "type": "wellbeing",
            "title": "Urgent Wellbeing Requests",
            "count": wellbeing_urgent,
            "priority": "critical",
            "action": "/college-admin/wellbeing",
            "icon": "heart",
            "color": "pink"
        })
    
    # Scheduled announcements (going out soon)
    scheduled_soon = await tenant_db.announcements.count_documents({
        "status": "scheduled",
        "scheduled_date": {"$lte": (now + timedelta(days=1)).isoformat()}
    })
    if scheduled_soon > 0:
        needs_attention.append({
            "type": "announcements",
            "title": "Announcements Going Live Soon",
            "count": scheduled_soon,
            "priority": "low",
            "action": "/college-admin/announcements",
            "icon": "megaphone",
            "color": "purple"
        })
    
    # Sort by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    needs_attention.sort(key=lambda x: priority_order.get(x['priority'], 99))
    
    # ===== STATS COMPARISON (Week over Week) =====
    this_week_messages = await tenant_db.messages.count_documents({
        "timestamp": {"$gte": week_ago.isoformat()}
    })
    last_week_messages = await tenant_db.messages.count_documents({
        "timestamp": {"$gte": two_weeks_ago.isoformat(), "$lt": week_ago.isoformat()}
    })
    
    this_week_shoutouts = await tenant_db.shoutouts.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    last_week_shoutouts = await tenant_db.shoutouts.count_documents({
        "created_at": {"$gte": two_weeks_ago.isoformat(), "$lt": week_ago.isoformat()}
    })
    
    this_week_events = await tenant_db.events.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    last_week_events = await tenant_db.events.count_documents({
        "created_at": {"$gte": two_weeks_ago.isoformat(), "$lt": week_ago.isoformat()}
    })
    
    this_week_service = await tenant_db.maintenance.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    last_week_service = await tenant_db.maintenance.count_documents({
        "created_at": {"$gte": two_weeks_ago.isoformat(), "$lt": week_ago.isoformat()}
    })
    
    def calc_trend(current, previous):
        if previous == 0:
            return {"direction": "up" if current > 0 else "neutral", "percent": 100 if current > 0 else 0}
        change = ((current - previous) / previous) * 100
        return {
            "direction": "up" if change > 5 else "down" if change < -5 else "neutral",
            "percent": abs(round(change))
        }
    
    stats_comparison = {
        "messages": {
            "current": this_week_messages,
            "previous": last_week_messages,
            "trend": calc_trend(this_week_messages, last_week_messages),
            "label": "Messages"
        },
        "recognitions": {
            "current": this_week_shoutouts,
            "previous": last_week_shoutouts,
            "trend": calc_trend(this_week_shoutouts, last_week_shoutouts),
            "label": "Recognitions"
        },
        "events": {
            "current": this_week_events,
            "previous": last_week_events,
            "trend": calc_trend(this_week_events, last_week_events),
            "label": "Events Created"
        },
        "service_requests": {
            "current": this_week_service,
            "previous": last_week_service,
            "trend": calc_trend(this_week_service, last_week_service),
            "label": "Service Requests"
        }
    }
    
    # Total counts
    total_users = await tenant_db.users.count_documents({})
    total_groups = await tenant_db.cocurricular_groups.count_documents({})
    
    return {
        "activity_feed": activity_feed,
        "needs_attention": needs_attention,
        "stats_comparison": stats_comparison,
        "totals": {
            "users": total_users,
            "groups": total_groups
        }
    }
