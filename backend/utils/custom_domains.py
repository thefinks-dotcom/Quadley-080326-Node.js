"""
Custom Domain Management for Multi-Tenant System
=================================================
Allows tenants to use their own custom domains (e.g., portal.college.edu)
with DNS-based verification and automatic tenant routing.
"""
import os
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field
from enum import Enum

# Import dns.resolver explicitly
try:
    from dns import resolver as dns_resolver
    from dns.resolver import NXDOMAIN, NoAnswer, NoNameservers
    DNS_AVAILABLE = True
except ImportError:
    DNS_AVAILABLE = False
    dns_resolver = None

logger = logging.getLogger(__name__)

# Domain verification settings
VERIFICATION_TXT_PREFIX = "quadley-verify="
VERIFICATION_EXPIRY_HOURS = 72


class DomainStatus(str, Enum):
    """Status of a custom domain."""
    PENDING = "pending"           # Domain added, awaiting verification
    VERIFIED = "verified"         # DNS verification passed
    ACTIVE = "active"             # Domain is active and routing traffic
    FAILED = "failed"             # Verification failed
    EXPIRED = "expired"           # Verification token expired
    SUSPENDED = "suspended"       # Domain suspended by admin


class CustomDomainConfig(BaseModel):
    """Configuration for a tenant's custom domain."""
    domain: str = Field(..., description="Custom domain (e.g., portal.college.edu)")
    tenant_code: str = Field(..., description="Tenant code this domain routes to")
    status: DomainStatus = Field(default=DomainStatus.PENDING)
    verification_token: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    verification_record: Optional[str] = None  # Full TXT record value
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    verified_at: Optional[str] = None
    last_check: Optional[str] = None
    ssl_status: str = Field(default="pending")  # pending, active, error
    primary: bool = Field(default=False)  # Is this the primary custom domain?
    notes: Optional[str] = None


def generate_verification_token(tenant_code: str, domain: str) -> str:
    """Generate a unique verification token for a domain."""
    # Use a hash to ensure uniqueness and prevent guessing
    secret = os.environ.get("SECRET_KEY", "default-secret")
    data = f"{tenant_code}:{domain}:{secret}:{datetime.now().date()}"
    return hashlib.sha256(data.encode()).hexdigest()[:16]


def get_verification_txt_record(token: str) -> str:
    """Get the full TXT record value for DNS verification."""
    return f"{VERIFICATION_TXT_PREFIX}{token}"


async def verify_domain_dns(domain: str, expected_token: str) -> Tuple[bool, str]:
    """
    Verify domain ownership via DNS TXT record.
    
    The tenant must add a TXT record: quadley-verify=<token>
    
    Args:
        domain: Domain to verify
        expected_token: Expected verification token
    
    Returns:
        Tuple of (is_verified, message)
    """
    if not DNS_AVAILABLE:
        return False, "DNS verification not available (dnspython not installed)"
    
    expected_record = get_verification_txt_record(expected_token)
    
    try:
        # Query TXT records for the domain
        # Try both root domain and _quadley subdomain
        domains_to_check = [
            domain,
            f"_quadley.{domain}",
            f"_quadley-verification.{domain}"
        ]
        
        for check_domain in domains_to_check:
            try:
                answers = dns_resolver.resolve(check_domain, 'TXT')
                
                for rdata in answers:
                    txt_value = str(rdata).strip('"')
                    
                    if txt_value == expected_record:
                        logger.info(f"Domain verified: {domain}")
                        return True, f"Domain verified via {check_domain}"
                    
                    # Check if they have a partial match (common mistake)
                    if expected_token in txt_value:
                        return False, f"TXT record found but format incorrect. Expected: {expected_record}"
                        
            except NXDOMAIN:
                continue
            except NoAnswer:
                continue
            except Exception as e:
                logger.debug(f"DNS check for {check_domain} failed: {e}")
                continue
        
        return False, "Verification TXT record not found. Please add the DNS record and wait for propagation."
        
    except NXDOMAIN:
        return False, f"Domain {domain} does not exist"
    except NoNameservers:
        return False, f"No DNS servers found for {domain}"
    except Exception as e:
        logger.error(f"DNS verification error for {domain}: {e}")
        return False, f"DNS lookup failed: {str(e)}"


async def check_domain_cname(domain: str, expected_target: str) -> Tuple[bool, str]:
    """
    Check if domain has correct CNAME record pointing to our servers.
    
    Args:
        domain: Custom domain to check
        expected_target: Expected CNAME target (e.g., tenants.quadley.app)
    
    Returns:
        Tuple of (is_correct, message)
    """
    if not DNS_AVAILABLE:
        return False, "DNS check not available"
    
    try:
        answers = dns_resolver.resolve(domain, 'CNAME')
        
        for rdata in answers:
            cname_target = str(rdata).rstrip('.')
            
            if cname_target.lower() == expected_target.lower():
                return True, f"CNAME correctly points to {expected_target}"
            
            return False, f"CNAME points to {cname_target}, expected {expected_target}"
        
        return False, "No CNAME record found"
        
    except NoAnswer:
        # Check for A record as fallback
        try:
            answers = dns_resolver.resolve(domain, 'A')
            return True, "Domain has A record (using direct IP)"
        except Exception:
            return False, "No CNAME or A record found"
    except NXDOMAIN:
        return False, f"Domain {domain} does not exist"
    except Exception as e:
        logger.error(f"CNAME check error for {domain}: {e}")
        return False, f"DNS lookup failed: {str(e)}"


def normalize_domain(domain: str) -> str:
    """Normalize a domain name (lowercase, remove protocol, trailing slash)."""
    domain = domain.lower().strip()
    
    # Remove protocol
    if domain.startswith("https://"):
        domain = domain[8:]
    elif domain.startswith("http://"):
        domain = domain[7:]
    
    # Remove trailing slash
    domain = domain.rstrip("/")
    
    # Remove www prefix for consistency
    if domain.startswith("www."):
        domain = domain[4:]
    
    return domain


def validate_domain_format(domain: str) -> Tuple[bool, str]:
    """Validate domain format."""
    import re
    
    domain = normalize_domain(domain)
    
    # Check length
    if len(domain) > 253:
        return False, "Domain name too long (max 253 characters)"
    
    # Check format
    domain_regex = r'^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'
    if not re.match(domain_regex, domain):
        return False, "Invalid domain format"
    
    # Disallow our own domains
    blocked_suffixes = ['.quadley.app', '.quadley.com', '.emergent.com']
    for suffix in blocked_suffixes:
        if domain.endswith(suffix):
            return False, f"Cannot use {suffix} domains"
    
    return True, "Valid domain format"


async def create_custom_domain(
    db,
    tenant_code: str,
    domain: str,
    created_by: str
) -> Dict[str, Any]:
    """
    Create a new custom domain configuration for a tenant.
    
    Args:
        db: Database connection
        tenant_code: Tenant code
        domain: Custom domain to add
        created_by: Admin who created this
    
    Returns:
        Domain configuration with verification instructions
    """
    # Normalize and validate domain
    domain = normalize_domain(domain)
    is_valid, message = validate_domain_format(domain)
    
    if not is_valid:
        raise ValueError(message)
    
    # Check if domain is already in use
    existing = await db.custom_domains.find_one({"domain": domain})
    if existing:
        if existing["tenant_code"] == tenant_code:
            raise ValueError("This domain is already configured for this tenant")
        else:
            raise ValueError("This domain is already in use by another tenant")
    
    # Check if tenant exists
    tenant = await db.tenants.find_one({"code": tenant_code})
    if not tenant:
        raise ValueError(f"Tenant {tenant_code} not found")
    
    # Generate verification token
    token = generate_verification_token(tenant_code, domain)
    verification_record = get_verification_txt_record(token)
    
    # Create domain config
    config = CustomDomainConfig(
        domain=domain,
        tenant_code=tenant_code,
        verification_token=token,
        verification_record=verification_record
    )
    
    # Store in database
    doc = config.model_dump()
    doc["created_by"] = created_by
    await db.custom_domains.insert_one(doc)
    
    # Return with verification instructions
    return {
        "domain": domain,
        "tenant_code": tenant_code,
        "status": config.status,
        "verification_instructions": {
            "step_1": f"Add a TXT record to your DNS for {domain}",
            "step_2": f"TXT record value: {verification_record}",
            "step_3": "Wait for DNS propagation (can take up to 48 hours)",
            "step_4": "Click 'Verify Domain' to check",
            "alternative": f"Or add the TXT record to _quadley.{domain}"
        },
        "cname_instructions": {
            "step_1": f"Add a CNAME record for {domain}",
            "step_2": "CNAME target: tenants.quadley.app",
            "note": "This routes traffic to Quadley servers"
        },
        "created_at": config.created_at
    }


async def verify_custom_domain(db, domain: str) -> Dict[str, Any]:
    """
    Verify a custom domain's DNS configuration.
    
    Args:
        db: Database connection
        domain: Domain to verify
    
    Returns:
        Verification result
    """
    domain = normalize_domain(domain)
    
    # Get domain config
    config = await db.custom_domains.find_one({"domain": domain}, {"_id": 0})
    if not config:
        raise ValueError(f"Domain {domain} not found")
    
    # Check if already verified
    if config.get("status") == DomainStatus.ACTIVE:
        return {
            "domain": domain,
            "status": "active",
            "message": "Domain is already active"
        }
    
    # Verify DNS TXT record
    token = config.get("verification_token")
    is_verified, message = await verify_domain_dns(domain, token)
    
    # Update status
    now = datetime.now(timezone.utc).isoformat()
    
    if is_verified:
        # Check CNAME/routing
        cname_ok, cname_message = await check_domain_cname(domain, "tenants.quadley.app")
        
        new_status = DomainStatus.ACTIVE if cname_ok else DomainStatus.VERIFIED
        
        await db.custom_domains.update_one(
            {"domain": domain},
            {"$set": {
                "status": new_status,
                "verified_at": now,
                "last_check": now
            }}
        )
        
        return {
            "domain": domain,
            "status": new_status,
            "dns_verified": True,
            "cname_configured": cname_ok,
            "message": message,
            "cname_message": cname_message,
            "next_steps": [] if cname_ok else [
                "Add CNAME record pointing to tenants.quadley.app"
            ]
        }
    else:
        await db.custom_domains.update_one(
            {"domain": domain},
            {"$set": {
                "status": DomainStatus.PENDING,
                "last_check": now
            }}
        )
        
        return {
            "domain": domain,
            "status": "pending",
            "dns_verified": False,
            "message": message,
            "verification_record": config.get("verification_record")
        }


async def get_tenant_by_domain(db, domain: str) -> Optional[str]:
    """
    Look up tenant code by custom domain.
    
    Args:
        db: Database connection
        domain: Domain to look up
    
    Returns:
        Tenant code if found and domain is active, None otherwise
    """
    domain = normalize_domain(domain)
    
    config = await db.custom_domains.find_one(
        {"domain": domain, "status": DomainStatus.ACTIVE},
        {"tenant_code": 1}
    )
    
    if config:
        return config.get("tenant_code")
    
    return None


async def list_tenant_domains(db, tenant_code: str) -> list:
    """Get all custom domains for a tenant."""
    cursor = db.custom_domains.find(
        {"tenant_code": tenant_code},
        {"_id": 0}
    )
    return await cursor.to_list(100)


async def delete_custom_domain(db, domain: str, tenant_code: str) -> bool:
    """Delete a custom domain configuration."""
    domain = normalize_domain(domain)
    
    result = await db.custom_domains.delete_one({
        "domain": domain,
        "tenant_code": tenant_code
    })
    
    return result.deleted_count > 0


async def set_primary_domain(db, tenant_code: str, domain: str) -> bool:
    """Set a domain as the primary custom domain for a tenant."""
    domain = normalize_domain(domain)
    
    # Verify domain exists and is active
    config = await db.custom_domains.find_one({
        "domain": domain,
        "tenant_code": tenant_code,
        "status": DomainStatus.ACTIVE
    })
    
    if not config:
        raise ValueError("Domain must be active before setting as primary")
    
    # Unset current primary
    await db.custom_domains.update_many(
        {"tenant_code": tenant_code},
        {"$set": {"primary": False}}
    )
    
    # Set new primary
    await db.custom_domains.update_one(
        {"domain": domain},
        {"$set": {"primary": True}}
    )
    
    # Update tenant record with primary domain
    await db.tenants.update_one(
        {"code": tenant_code},
        {"$set": {"custom_domain": domain}}
    )
    
    return True
