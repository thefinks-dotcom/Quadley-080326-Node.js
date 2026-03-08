"""JWT Token blacklist for secure logout (OWASP A04 compliance)"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import secrets
import logging

logger = logging.getLogger(__name__)

# In-memory blacklist for invalidated tokens (for quick lookup)
# In production, this should be Redis or similar for distributed systems
TOKEN_BLACKLIST = set()

# Password reset tokens storage
PASSWORD_RESET_TOKENS = {}
RESET_TOKEN_EXPIRY_MINUTES = 30


async def blacklist_token(db, token: str, user_id: str, expiry: datetime):
    """
    Add a token to the blacklist.
    Stores in both memory (for quick lookup) and database (for persistence).
    Gracefully handles MongoDB errors for deployment compatibility.
    """
    TOKEN_BLACKLIST.add(token)
    
    try:
        # Also store in database for persistence across restarts
        await db.token_blacklist.insert_one({
            "token": token,
            "user_id": user_id,
            "blacklisted_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expiry.isoformat()
        })
    except Exception as e:
        # Log but don't fail - in-memory blacklist still works
        logger.warning(f"Token blacklist DB storage failed (in-memory still active): {e}")


async def is_token_blacklisted(db, token: str) -> bool:
    """Check if a token has been blacklisted (logged out)"""
    # Quick check in memory first
    if token in TOKEN_BLACKLIST:
        return True
    
    try:
        # Check database (for tokens blacklisted before server restart)
        blacklisted = await db.token_blacklist.find_one({"token": token})
        if blacklisted:
            TOKEN_BLACKLIST.add(token)  # Cache it
            return True
    except Exception as e:
        # Log but don't fail - rely on in-memory check
        logger.warning(f"Token blacklist DB check failed (non-blocking): {e}")
    
    return False


async def cleanup_expired_tokens(db):
    """Remove expired tokens from blacklist (run periodically)"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        # Remove from database
        result = await db.token_blacklist.delete_many({
            "expires_at": {"$lt": now}
        })
        
        # Note: In-memory set will be cleared on restart anyway
        return result.deleted_count
    except Exception as e:
        logger.warning(f"Token cleanup failed (non-blocking): {e}")
        return 0


def generate_password_reset_token(email: str) -> str:
    """Generate a secure password reset token"""
    token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)
    
    PASSWORD_RESET_TOKENS[token] = {
        "email": email.lower(),
        "expires_at": expiry,
        "used": False
    }
    
    return token


async def store_password_reset_token(db, email: str, token: str):
    """Store password reset token in database"""
    try:
        expiry = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)
        
        # Remove any existing reset tokens for this email
        await db.password_reset_tokens.delete_many({"email": email.lower()})
        
        # Store new token
        await db.password_reset_tokens.insert_one({
            "token": token,
            "email": email.lower(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expiry.isoformat(),
            "used": False
        })
    except Exception as e:
        # Log but don't fail - in-memory token storage still works
        logger.warning(f"Password reset token DB storage failed (in-memory still active): {e}")


async def validate_password_reset_token(db, token: str) -> Optional[str]:
    """
    Validate a password reset token.
    Returns the email if valid, None otherwise.
    """
    # Check in-memory first
    if token in PASSWORD_RESET_TOKENS:
        data = PASSWORD_RESET_TOKENS[token]
        if data["used"]:
            return None
        if datetime.now(timezone.utc) > data["expires_at"]:
            del PASSWORD_RESET_TOKENS[token]
            return None
        return data["email"]
    
    try:
        # Check database
        reset_doc = await db.password_reset_tokens.find_one({"token": token})
        if not reset_doc:
            return None
        
        if reset_doc.get("used"):
            return None
        
        expires_at = datetime.fromisoformat(reset_doc["expires_at"].replace('Z', '+00:00'))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) > expires_at:
            await db.password_reset_tokens.delete_one({"token": token})
            return None
        
        return reset_doc["email"]
    except Exception as e:
        logger.warning(f"Password reset token DB validation failed (non-blocking): {e}")
        return None


async def mark_reset_token_used(db, token: str):
    """Mark a password reset token as used"""
    if token in PASSWORD_RESET_TOKENS:
        PASSWORD_RESET_TOKENS[token]["used"] = True
    
    try:
        await db.password_reset_tokens.update_one(
            {"token": token},
            {"$set": {"used": True}}
        )
    except Exception as e:
        logger.warning(f"Mark reset token used failed (non-blocking): {e}")


async def cleanup_expired_reset_tokens(db):
    """Remove expired password reset tokens"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        result = await db.password_reset_tokens.delete_many({
            "$or": [
                {"expires_at": {"$lt": now}},
                {"used": True}
            ]
        })
        
        # Clean in-memory cache
        expired_keys = [
            k for k, v in PASSWORD_RESET_TOKENS.items()
            if v["used"] or datetime.now(timezone.utc) > v["expires_at"]
        ]
        for k in expired_keys:
            del PASSWORD_RESET_TOKENS[k]
        
        return result.deleted_count
    except Exception as e:
        logger.warning(f"Reset token cleanup failed (non-blocking): {e}")
        return 0
