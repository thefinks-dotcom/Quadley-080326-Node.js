"""
Password Breach Detection
=========================
Check passwords against HaveIBeenPwned API to prevent use of compromised passwords.
Uses k-anonymity model - only first 5 chars of SHA1 hash are sent to API.
"""
import hashlib
import logging
import httpx
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

HIBP_API_URL = "https://api.pwnedpasswords.com/range/"
HIBP_TIMEOUT = 5.0  # Seconds


async def check_password_breach(password: str) -> Tuple[bool, int]:
    """
    Check if a password has been exposed in known data breaches.
    
    Uses k-anonymity: Only the first 5 characters of the SHA1 hash
    are sent to the API, preserving password privacy.
    
    Args:
        password: Plain text password to check
    
    Returns:
        Tuple of (is_breached: bool, breach_count: int)
        breach_count = number of times password appeared in breaches
    """
    try:
        # Hash the password with SHA1 (HIBP uses SHA1)
        sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
        
        # Split into prefix (sent to API) and suffix (checked locally)
        prefix = sha1_hash[:5]
        suffix = sha1_hash[5:]
        
        # Query HIBP API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{HIBP_API_URL}{prefix}",
                timeout=HIBP_TIMEOUT,
                headers={"User-Agent": "Quadley-Security-Check"}
            )
            
            if response.status_code != 200:
                logger.warning(f"HIBP API returned {response.status_code}")
                return False, 0  # Fail open - allow password
            
            # Parse response - format: SUFFIX:COUNT\r\n
            hashes = response.text.split('\r\n')
            
            for line in hashes:
                if ':' not in line:
                    continue
                    
                hash_suffix, count = line.split(':')
                
                if hash_suffix == suffix:
                    breach_count = int(count)
                    logger.info(f"Password found in {breach_count} breaches")
                    return True, breach_count
            
            return False, 0
            
    except httpx.TimeoutException:
        logger.warning("HIBP API timeout - skipping breach check")
        return False, 0
    except Exception as e:
        logger.error(f"Password breach check failed: {e}")
        return False, 0  # Fail open


def get_breach_warning_message(breach_count: int) -> str:
    """Get appropriate warning message based on breach count."""
    if breach_count >= 100000:
        return (
            "This password has been exposed in major data breaches over 100,000 times. "
            "Please choose a different password."
        )
    elif breach_count >= 10000:
        return (
            "This password has been exposed in data breaches over 10,000 times. "
            "We strongly recommend choosing a different password."
        )
    elif breach_count >= 1000:
        return (
            "This password has appeared in known data breaches. "
            "Consider using a more unique password."
        )
    elif breach_count > 0:
        return (
            "This password has been found in a data breach. "
            "For better security, consider using a different password."
        )
    return ""


async def validate_password_security(
    password: str,
    strict_mode: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Validate password against breach database.
    
    Args:
        password: Password to validate
        strict_mode: If True, reject any breached password.
                     If False, only reject passwords with high breach counts.
    
    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    is_breached, count = await check_password_breach(password)
    
    if not is_breached:
        return True, None
    
    if strict_mode or count >= 10000:
        # Reject password
        return False, get_breach_warning_message(count)
    
    # Allow but warn (message can be shown to user)
    return True, get_breach_warning_message(count)
