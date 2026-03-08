"""Account lockout mechanism for brute force protection"""
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# Constants
MAX_LOGIN_ATTEMPTS = 3
LOCKOUT_DURATION_MINUTES = 15

async def check_account_lockout(db, email: str) -> Tuple[bool, Optional[int]]:
    """
    Check if account is locked out.
    Returns (is_locked, minutes_remaining)
    Gracefully handles MongoDB authorization errors for deployment compatibility.
    """
    try:
        lockout = await db.login_attempts.find_one({"email": email.lower()})
        
        if not lockout:
            return False, None
        
        if lockout.get('locked_until'):
            locked_until = datetime.fromisoformat(lockout['locked_until'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            
            # Make both timezone aware for comparison
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            
            if now < locked_until:
                remaining = (locked_until - now).seconds // 60
                return True, remaining + 1
            else:
                # Lockout expired, reset
                await db.login_attempts.delete_one({"email": email.lower()})
                return False, None
        
        return False, None
    except Exception as e:
        # Log the error but don't block login - graceful degradation
        logger.warning(f"Account lockout check failed (non-blocking): {e}")
        return False, None

async def record_failed_login(db, email: str) -> int:
    """
    Record failed login attempt and lock if threshold reached.
    Returns current attempt count.
    Gracefully handles MongoDB authorization errors for deployment compatibility.
    """
    try:
        email = email.lower()
        now = datetime.now(timezone.utc)
        
        result = await db.login_attempts.find_one_and_update(
            {"email": email},
            {
                "$inc": {"attempts": 1},
                "$set": {"last_attempt": now.isoformat()},
                "$setOnInsert": {"email": email, "first_attempt": now.isoformat()}
            },
            upsert=True,
            return_document=True
        )
        
        attempts = result.get('attempts', 1) if result else 1
        
        if attempts >= MAX_LOGIN_ATTEMPTS:
            locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            await db.login_attempts.update_one(
                {"email": email},
                {"$set": {"locked_until": locked_until.isoformat()}}
            )
        
        return attempts
    except Exception as e:
        # Log the error but don't block login tracking - graceful degradation
        logger.warning(f"Failed login recording failed (non-blocking): {e}")
        return 1

async def clear_login_attempts(db, email: str):
    """Clear login attempts on successful login"""
    try:
        await db.login_attempts.delete_one({"email": email.lower()})
    except Exception as e:
        # Log but don't fail - graceful degradation
        logger.warning(f"Clear login attempts failed (non-blocking): {e}")
