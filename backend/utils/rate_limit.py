"""Simple rate limiting utility"""
from fastapi import HTTPException, status
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict

# Store: {user_id: [(timestamp1, action), (timestamp2, action), ...]}
rate_limit_store: Dict[str, list] = defaultdict(list)

def check_rate_limit(user_id: str, action: str = "default", max_requests: int = 10, window_minutes: int = 1):
    """
    Check if user has exceeded rate limit
    
    Args:
        user_id: User identifier
        action: Action being rate limited (e.g., "shoutout", "message")
        max_requests: Maximum requests allowed in window
        window_minutes: Time window in minutes
    
    Raises:
        HTTPException: 429 if rate limit exceeded
    """
    now = datetime.now()
    cutoff = now - timedelta(minutes=window_minutes)
    
    # Clean old entries and count recent requests
    user_requests = rate_limit_store[user_id]
    recent_requests = [(ts, act) for ts, act in user_requests if ts > cutoff and act == action]
    
    if len(recent_requests) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} {action}s per {window_minutes} minute(s). Please try again later."
        )
    
    # Add current request
    recent_requests.append((now, action))
    rate_limit_store[user_id] = recent_requests
    
    return True
