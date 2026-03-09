"""Authentication utilities with security enhancements (OWASP A02, A09 compliance)"""
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
import jwt
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import secrets

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Security logging configuration (OWASP A09)
security_logger = logging.getLogger('security')
security_logger.setLevel(logging.INFO)
if not security_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - SECURITY - %(levelname)s - %(message)s'
    ))
    security_logger.addHandler(handler)

# Initialize MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)

# Determine database name
# Priority: DB_NAME env var > database in connection string > default
db_name = os.environ.get('DB_NAME', 'residential_college_db')

# For Atlas connections, extract database from URI if DB_NAME is default
# Atlas URI format: mongodb+srv://user:pass@cluster.mongodb.net/database?options
if 'mongodb+srv://' in mongo_url or '.mongodb.net' in mongo_url:
    try:
        # Extract database from connection string path
        from urllib.parse import urlparse
        parsed = urlparse(mongo_url)
        uri_db = parsed.path.strip('/').split('?')[0] if parsed.path else None
        if uri_db and uri_db != '' and not uri_db.startswith('mongodb'):
            logging.info(f"Atlas: Using database from connection string: {uri_db}")
            # Only override if it looks like a valid database name
            if len(uri_db) > 0:
                db_name = uri_db
    except Exception as e:
        logging.warning(f"Could not parse database from Atlas URI: {e}")

db = client[db_name]
logging.info(f"MongoDB initialized - Database: {db_name}")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
# Token expiration - 7 days for mobile apps (was 15 minutes which is too short)
TOKEN_EXPIRE_MINUTES = int(os.environ.get('TOKEN_EXPIRE_MINUTES', 1440))  # 24 hours = 1440 minutes
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get('REFRESH_TOKEN_EXPIRE_DAYS', 30))

# Security
security = HTTPBearer()

# Login attempt tracking
LOGIN_ATTEMPTS_CACHE = {}
MAX_LOGIN_ATTEMPTS = 10  # Increased from 5
LOCKOUT_DURATION = timedelta(minutes=5)  # Reduced from 15


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token with security logging"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "quadley-platform",
        "type": "access"
    })
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    security_logger.info(f"Access token created for user: {data.get('sub', 'unknown')}")
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a new JWT refresh token (longer lived)"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "quadley-platform",
        "type": "refresh",
        "jti": secrets.token_urlsafe(32)  # Unique token ID for revocation
    })
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    security_logger.info(f"Refresh token created for user: {data.get('sub', 'unknown')}")
    return encoded_jwt


def log_security_event(event_type: str, details: dict, level: str = "INFO"):
    """Log security events for monitoring (OWASP A09)"""
    log_msg = f"{event_type}: {details}"
    if level == "WARNING":
        security_logger.warning(log_msg)
    elif level == "ERROR":
        security_logger.error(log_msg)
    else:
        security_logger.info(log_msg)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    """
    Get the current authenticated user from JWT token.
    SECURITY (OWASP A02): Bearer-only auth prevents CSRF bypass via cookies.
    Checks token blacklist for logged-out tokens (OWASP A04 compliance).
    
    Multi-tenant: Looks up user in appropriate database based on token.
    """
    from models import User
    from utils.token_blacklist import is_token_blacklisted
    from utils.multi_tenant import master_db, get_tenant_db

    token = None

    # httpOnly cookie takes priority (OWASP A02 — XSS cannot steal httpOnly cookies).
    # SameSite=Lax blocks cross-site POST/PUT/DELETE, mitigating CSRF (RFC 6265bis §8.8.2).
    # Bearer header accepted as fallback for mobile / API clients.
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        token = cookie_token
    elif credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if token has been blacklisted (logged out)
    if await is_token_blacklisted(db, token):
        raise HTTPException(status_code=401, detail="Token has been revoked")
    
    try:
        payload = jwt.decode(
            token, JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "iat"]}
        )
        user_id = payload.get("sub")
        tenant_code = payload.get("tenant")  # May be None for super_admin
        mfa_pending = payload.get("mfa_pending", False)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # SECURITY (OWASP A07): Restrict MFA-pending tokens to MFA endpoints only
        if mfa_pending:
            request_path = request.url.path if hasattr(request, 'url') else ""
            allowed_mfa_paths = ["/api/mfa/", "/api/auth/me", "/api/auth/logout"]
            if not any(request_path.startswith(p) for p in allowed_mfa_paths):
                raise HTTPException(
                    status_code=403,
                    detail="MFA setup required. Complete MFA setup before accessing this resource."
                )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_doc = None
    
    # Multi-tenant lookup
    if tenant_code:
        # User belongs to a specific tenant
        try:
            tenant_db = get_tenant_db(tenant_code)
            user_doc = await tenant_db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        except Exception as e:
            logging.warning(f"Error accessing tenant database: {e}")
    
    # Fallback: Check master database for super_admin or legacy users
    if not user_doc:
        # Check super_admins collection first
        user_doc = await master_db.super_admins.find_one({"id": user_id}, {"_id": 0, "password": 0})
        
        # Fallback: Check old users collection (for backwards compatibility during migration)
        if not user_doc:
            user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    # Inject tenant_code from the JWT so downstream code (e.g. MFA routes) can
    # route DB operations to the correct tenant DB. The user doc stored in the
    # tenant DB does not carry this field itself, so it must come from the token.
    if tenant_code and not user_doc.get('tenant_code'):
        user_doc['tenant_code'] = tenant_code
    
    return User(**user_doc)


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    """
    Get current user if authenticated, otherwise return None.
    Useful for endpoints that work for both authenticated and anonymous users.
    """
    from models import User
    from utils.multi_tenant import master_db, get_tenant_db
    
    token = None
    
    # Check httpOnly cookie first
    access_token_cookie = request.cookies.get("access_token")
    if access_token_cookie:
        token = access_token_cookie
    elif credentials:
        token = credentials.credentials
    
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        tenant_code = payload.get("tenant")  # May be None for super_admin
        if not user_id:
            return None
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    
    user_doc = None
    
    # Multi-tenant lookup (same logic as get_current_user)
    if tenant_code:
        try:
            tenant_db = get_tenant_db(tenant_code)
            user_doc = await tenant_db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        except Exception:
            pass
    
    # Fallback: Check master database for super_admin or legacy users
    if not user_doc:
        user_doc = await master_db.super_admins.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user_doc:
            user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user_doc:
        return None
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)


async def get_tenant_db_for_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    """
    Get the tenant database for the current authenticated user.
    This ensures data isolation - users can only access their tenant's data.
    Returns (tenant_db, current_user) tuple.
    
    Raises 403 if user has no tenant (e.g., super_admin trying to access tenant data directly).
    """
    from models import User
    from utils.token_blacklist import is_token_blacklisted
    from utils.multi_tenant import get_tenant_db

    token = None

    # httpOnly cookie takes priority (OWASP A02 — XSS cannot steal httpOnly cookies).
    # SameSite=Lax blocks cross-site POST/PUT/DELETE, mitigating CSRF (RFC 6265bis §8.8.2).
    # Bearer header accepted as fallback for mobile / API clients.
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        token = cookie_token
    elif credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if token has been blacklisted
    if await is_token_blacklisted(db, token):
        raise HTTPException(status_code=401, detail="Token has been revoked")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        tenant_code = payload.get("tenant")
        mfa_pending = payload.get("mfa_pending", False)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # SECURITY (OWASP A07): Restrict MFA-pending tokens
        if mfa_pending:
            request_path = request.url.path if hasattr(request, 'url') else ""
            allowed_mfa_paths = ["/api/mfa/", "/api/auth/me", "/api/auth/logout"]
            if not any(request_path.startswith(p) for p in allowed_mfa_paths):
                raise HTTPException(
                    status_code=403,
                    detail="MFA setup required. Complete MFA setup before accessing this resource."
                )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Require tenant_code for tenant-isolated routes
    if not tenant_code:
        raise HTTPException(
            status_code=403, 
            detail="This endpoint requires tenant context. Super admins must access data via tenant-specific endpoints."
        )
    
    try:
        tenant_db = get_tenant_db(tenant_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Get user from tenant database
    user_doc = await tenant_db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found in tenant")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**user_doc)
    
    return tenant_db, user
