"""
Admin Analytics & Reporting Routes - Tenant isolated (OWASP A01)
==================================

Provides comprehensive analytics and reporting for administrators including:
- Student platform usage statistics
- Gender-based violence reporting (anonymized)
- Engagement metrics
- Activity trends

SECURITY NOTES:
- All endpoints require admin/super_admin role
- GBV reports are rate-limited and audit-logged
- No PII is exposed - only aggregated counts
- All data is tenant-isolated
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

from utils.auth import get_tenant_db_for_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Simple in-memory rate limiter for sensitive endpoints
_rate_limit_cache = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 10  # max requests per window

def check_rate_limit(user_id: str, endpoint: str) -> bool:
    """Check if user has exceeded rate limit for sensitive endpoints"""
    key = f"{user_id}:{endpoint}"
    now = datetime.now(timezone.utc)
    
    if key in _rate_limit_cache:
        requests, window_start = _rate_limit_cache[key]
        if (now - window_start).total_seconds() > RATE_LIMIT_WINDOW:
            # Reset window
            _rate_limit_cache[key] = (1, now)
            return True
        elif requests >= RATE_LIMIT_MAX:
            return False
        else:
            _rate_limit_cache[key] = (requests + 1, window_start)
            return True
    else:
        _rate_limit_cache[key] = (1, now)
        return True

# Helper to check admin role
def require_admin(current_user: User):
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.get("/student-usage")
async def get_student_usage_analytics(
    period: str = Query("30d", description="Period: 7d, 30d, 90d, 365d, all"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Get comprehensive student platform usage statistics - tenant isolated.
    
    Returns aggregated, anonymized data about:
    - Active users over time
    - Feature usage breakdown
    - Engagement by role
    - Peak usage times
    """
    tenant_db, current_user = tenant_data
    require_admin(current_user)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    days_map = {'7d': 7, '30d': 30, '90d': 90, '365d': 365}
    days = days_map.get(period, None)
    
    if days:
        start_date = (now - timedelta(days=days)).isoformat()
    else:
        start_date = None
    
    # Build date filter
    date_filter = {}
    if start_date:
        date_filter = {'created_at': {'$gte': start_date}}
    
    try:
        # Total registered users by role
        users_by_role = await tenant_db.users.aggregate([
            {'$group': {
                '_id': '$role',
                'count': {'$sum': 1}
            }}
        ]).to_list(100)
        
        # Users with floor assignment
        users_with_floor = await tenant_db.users.count_documents({
            'floor': {'$exists': True},
            '$and': [{'floor': {'$ne': None}}, {'floor': {'$ne': ''}}]
        })
        
        # Total users
        total_users = await tenant_db.users.count_documents({})
        
        # Active users (created events, announcements, maintenance requests, etc.)
        active_user_ids = set()
        
        # Get unique contributors from various collections
        for collection in ['events', 'announcements', 'maintenance_requests', 'shoutouts', 'messages']:
            if await tenant_db[collection].estimated_document_count() > 0:
                users = await tenant_db[collection].distinct('created_by', date_filter if date_filter else {})
                active_user_ids.update([u for u in users if u])
                users = await tenant_db[collection].distinct('submitted_by', date_filter if date_filter else {})
                active_user_ids.update([u for u in users if u])
                users = await tenant_db[collection].distinct('from_user_id', date_filter if date_filter else {})
                active_user_ids.update([u for u in users if u])
        
        # Feature usage counts
        feature_usage = {}
        collections_to_count = [
            ('events', 'Events Created'),
            ('event_rsvps', 'Event RSVPs'),
            ('announcements', 'Announcements'),
            ('maintenance_requests', 'Service Requests'),
            ('shoutouts', 'Shoutouts Given'),
            ('messages', 'Messages Sent'),
            ('jobs', 'Jobs Posted'),
            ('job_applications', 'Job Applications'),
            ('study_groups', 'Study Groups'),
            ('bookings', 'Room Bookings'),
            ('parcels', 'Parcels Logged'),
            ('late_meal_requests', 'Late Meal Requests'),
            ('disclosures', 'Safe Disclosures'),
        ]
        
        for collection, label in collections_to_count:
            try:
                count = await tenant_db[collection].count_documents(date_filter if date_filter else {})
                feature_usage[label] = count
            except Exception:
                feature_usage[label] = 0
        
        # Engagement by category
        engagement_summary = {
            'communication': feature_usage.get('Messages Sent', 0) + feature_usage.get('Announcements', 0),
            'events_social': feature_usage.get('Events Created', 0) + feature_usage.get('Event RSVPs', 0),
            'services': feature_usage.get('Service Requests', 0) + feature_usage.get('Room Bookings', 0) + feature_usage.get('Late Meal Requests', 0),
            'academic': feature_usage.get('Study Groups', 0) + feature_usage.get('Job Applications', 0),
            'community': feature_usage.get('Shoutouts Given', 0),
            'safety': feature_usage.get('Safe Disclosures', 0),
        }
        
        # Calculate engagement rate
        engagement_rate = (len(active_user_ids) / total_users * 100) if total_users > 0 else 0
        
        return {
            'period': period,
            'generated_at': now.isoformat(),
            'summary': {
                'total_users': total_users,
                'active_users': len(active_user_ids),
                'engagement_rate': round(engagement_rate, 1),
                'users_with_floor': users_with_floor,
            },
            'users_by_role': {item['_id']: item['count'] for item in users_by_role},
            'feature_usage': feature_usage,
            'engagement_by_category': engagement_summary,
            'top_features': sorted(feature_usage.items(), key=lambda x: x[1], reverse=True)[:5],
        }
        
    except Exception as e:
        logger.error(f"Error generating student usage analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate analytics")

@router.get("/gender-violence-report")
async def get_gender_violence_report(
    year: Optional[int] = Query(None, description="Academic year (e.g., 2025 for 2025-2026)"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Get anonymized gender-based violence reporting statistics - tenant isolated.
    
    PRIVACY NOTE: This report provides aggregated, anonymized data for compliance 
    and safety monitoring. No individual case details, user identities, or personally
    identifiable information (PII) is exposed. Data is aggregated to prevent
    re-identification of individuals.
    
    Data includes:
    - Total disclosures by type
    - Resolution rates
    - Severity distribution
    - Trend analysis
    """
    tenant_db, current_user = tenant_data
    require_admin(current_user)
    
    # Audit log for sensitive report access
    logger.info(f"GBV Report accessed by user_id={current_user.id}, role={current_user.role}")
    
    # Rate limit sensitive GBV reports
    if not check_rate_limit(current_user.id, "gbv_report"):
        raise HTTPException(
            status_code=429, 
            detail="Rate limit exceeded. Please wait before requesting this report again."
        )
    
    now = datetime.now(timezone.utc)
    
    # Academic year runs July 1 to June 30
    if year is None:
        year = now.year if now.month >= 7 else now.year - 1
    
    start_date = datetime(year, 7, 1, tzinfo=timezone.utc)
    end_date = datetime(year + 1, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
    
    date_filter = {
        'created_at': {
            '$gte': start_date.isoformat(),
            '$lte': end_date.isoformat()
        }
    }
    
    try:
        # Gender-based violence related disclosure types
        gbv_types = [
            'sexual_harassment',
            'sexual_assault', 
            'domestic_violence',
            'stalking',
            'gender_discrimination',
            'harassment',  # May include gender-based
            'intimidation',
        ]
        
        gbv_filter = {
            **date_filter,
            'disclosure_type': {'$in': gbv_types}
        }
        
        # Total GBV-related disclosures
        total_gbv = await tenant_db.disclosures.count_documents(gbv_filter)
        
        # Disclosures by type
        by_type = await tenant_db.disclosures.aggregate([
            {'$match': gbv_filter},
            {'$group': {
                '_id': '$disclosure_type',
                'count': {'$sum': 1}
            }},
            {'$sort': {'count': -1}}
        ]).to_list(100)
        
        # By severity
        by_severity = await tenant_db.disclosures.aggregate([
            {'$match': gbv_filter},
            {'$group': {
                '_id': '$severity',
                'count': {'$sum': 1}
            }}
        ]).to_list(10)
        
        # By status (resolution tracking)
        by_status = await tenant_db.disclosures.aggregate([
            {'$match': gbv_filter},
            {'$group': {
                '_id': '$status',
                'count': {'$sum': 1}
            }}
        ]).to_list(10)
        
        # Anonymous vs identified
        anonymous_count = await tenant_db.disclosures.count_documents({**gbv_filter, 'anonymous': True})
        identified_count = await tenant_db.disclosures.count_documents({**gbv_filter, 'anonymous': {'$ne': True}})
        
        # Resolution rate
        resolved_count = await tenant_db.disclosures.count_documents({
            **gbv_filter,
            'status': {'$in': ['resolved', 'closed', 'completed']}
        })
        resolution_rate = (resolved_count / total_gbv * 100) if total_gbv > 0 else 0
        
        # Monthly trend
        monthly_trend = await tenant_db.disclosures.aggregate([
            {'$match': gbv_filter},
            {'$addFields': {
                'month': {'$substr': ['$created_at', 0, 7]}  # YYYY-MM
            }},
            {'$group': {
                '_id': '$month',
                'count': {'$sum': 1}
            }},
            {'$sort': {'_id': 1}}
        ]).to_list(12)
        
        # All disclosures for comparison
        total_all_disclosures = await tenant_db.disclosures.count_documents(date_filter)
        
        # Response time analysis (if we have resolved_at data)
        avg_response_pipeline = [
            {'$match': {
                **gbv_filter,
                'resolved_at': {'$exists': True}
            }},
            {'$project': {
                'response_days': {
                    '$divide': [
                        {'$subtract': [
                            {'$dateFromString': {'dateString': '$resolved_at'}},
                            {'$dateFromString': {'dateString': '$created_at'}}
                        ]},
                        86400000  # Convert ms to days
                    ]
                }
            }},
            {'$group': {
                '_id': None,
                'avg_days': {'$avg': '$response_days'},
                'min_days': {'$min': '$response_days'},
                'max_days': {'$max': '$response_days'}
            }}
        ]
        
        response_stats = await tenant_db.disclosures.aggregate(avg_response_pipeline).to_list(1)
        response_time = response_stats[0] if response_stats else {'avg_days': None, 'min_days': None, 'max_days': None}
        
        return {
            'report_type': 'Gender-Based Violence Annual Report',
            'academic_year': f'{year}-{year + 1}',
            'period': {
                'start': start_date.strftime('%B %d, %Y'),
                'end': end_date.strftime('%B %d, %Y'),
            },
            'generated_at': now.isoformat(),
            'summary': {
                'total_gbv_disclosures': total_gbv,
                'total_all_disclosures': total_all_disclosures,
                'gbv_percentage': round((total_gbv / total_all_disclosures * 100) if total_all_disclosures > 0 else 0, 1),
                'resolution_rate': round(resolution_rate, 1),
                'anonymous_reports': anonymous_count,
                'identified_reports': identified_count,
            },
            'by_type': [{'type': item['_id'], 'count': item['count']} for item in by_type],
            'by_severity': {item['_id']: item['count'] for item in by_severity if item['_id']},
            'by_status': {item['_id']: item['count'] for item in by_status if item['_id']},
            'monthly_trend': [{'month': item['_id'], 'count': item['count']} for item in monthly_trend],
            'response_time': {
                'average_days': round(response_time.get('avg_days', 0) or 0, 1),
                'fastest_days': round(response_time.get('min_days', 0) or 0, 1),
                'slowest_days': round(response_time.get('max_days', 0) or 0, 1),
            },
            'compliance_note': 'This report contains anonymized, aggregated data only. No individual case details are included.',
        }
        
    except Exception as e:
        logger.error(f"Error generating gender violence report: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")

@router.get("/engagement-trends")
async def get_engagement_trends(
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """
    Get engagement trends over time - tenant isolated.
    
    Shows daily/weekly activity patterns across the platform.
    """
    tenant_db, current_user = tenant_data
    require_admin(current_user)
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    try:
        # Aggregate daily activity
        daily_activity = {}
        
        collections = ['events', 'announcements', 'maintenance_requests', 'shoutouts', 'messages']
        
        for collection in collections:
            try:
                pipeline = [
                    {'$match': {'created_at': {'$gte': start_date}}},
                    {'$addFields': {
                        'day': {'$substr': ['$created_at', 0, 10]}
                    }},
                    {'$group': {
                        '_id': '$day',
                        'count': {'$sum': 1}
                    }},
                    {'$sort': {'_id': 1}}
                ]
                
                results = await tenant_db[collection].aggregate(pipeline).to_list(days + 1)
                for item in results:
                    day = item['_id']
                    if day not in daily_activity:
                        daily_activity[day] = {}
                    daily_activity[day][collection] = item['count']
            except Exception:
                pass
        
        # Sort by date
        sorted_days = sorted(daily_activity.keys())
        
        return {
            'period_days': days,
            'start_date': start_date[:10],
            'end_date': now.strftime('%Y-%m-%d'),
            'daily_breakdown': [
                {
                    'date': day,
                    **daily_activity.get(day, {})
                }
                for day in sorted_days
            ],
            'total_by_type': {
                collection: sum(daily_activity.get(day, {}).get(collection, 0) for day in sorted_days)
                for collection in collections
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating engagement trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate trends")
