"""CAPTCHA verification for public forms.

OWASP A04 Compliance: Prevents automated attacks on public endpoints.

Supports:
1. Simple math CAPTCHA (built-in, no external dependency)
2. hCaptcha integration (optional, more secure)
3. reCAPTCHA v3 integration (optional)
"""
import os
import random
import secrets
import hashlib
from typing import Optional, Tuple
import httpx
import logging

from .redis_cache import cache

logger = logging.getLogger(__name__)

# CAPTCHA configuration
CAPTCHA_EXPIRY_SECONDS = 300  # 5 minutes
HCAPTCHA_SECRET = os.environ.get('HCAPTCHA_SECRET')
HCAPTCHA_SITEKEY = os.environ.get('HCAPTCHA_SITEKEY')
RECAPTCHA_SECRET = os.environ.get('RECAPTCHA_SECRET')

# Determine active CAPTCHA provider
if HCAPTCHA_SECRET:
    CAPTCHA_PROVIDER = "hcaptcha"
elif RECAPTCHA_SECRET:
    CAPTCHA_PROVIDER = "recaptcha"
else:
    CAPTCHA_PROVIDER = "math"  # Built-in fallback


def generate_math_captcha() -> Tuple[str, str, str]:
    """
    Generate a simple math CAPTCHA challenge.
    
    Returns:
        Tuple of (captcha_id, question, answer_hash)
    """
    operations = [
        ("+", lambda a, b: a + b),
        ("-", lambda a, b: a - b),
        ("×", lambda a, b: a * b),
    ]
    
    op_symbol, op_func = random.choice(operations)
    
    # Generate numbers that produce reasonable results
    if op_symbol == "×":
        a, b = random.randint(2, 9), random.randint(2, 9)
    elif op_symbol == "-":
        a, b = random.randint(10, 50), random.randint(1, 10)
    else:
        a, b = random.randint(10, 50), random.randint(1, 50)
    
    answer = op_func(a, b)
    question = f"What is {a} {op_symbol} {b}?"
    
    captcha_id = secrets.token_urlsafe(16)
    answer_hash = hashlib.sha256(str(answer).encode()).hexdigest()
    
    # Store the answer hash with expiry
    cache_key = f"captcha:{captcha_id}"
    cache.set(cache_key, answer_hash, CAPTCHA_EXPIRY_SECONDS)
    
    return captcha_id, question, answer_hash


def verify_math_captcha(captcha_id: str, user_answer: str) -> bool:
    """
    Verify a math CAPTCHA answer.
    
    Args:
        captcha_id: The CAPTCHA identifier
        user_answer: User's answer to the math question
    
    Returns:
        True if correct, False otherwise
    """
    cache_key = f"captcha:{captcha_id}"
    stored_hash = cache.get(cache_key)
    
    if not stored_hash:
        logger.warning("CAPTCHA verification failed: Invalid or expired captcha_id")
        return False
    
    # Clean the answer
    try:
        answer = str(int(user_answer.strip()))
    except (ValueError, AttributeError):
        return False
    
    answer_hash = hashlib.sha256(answer.encode()).hexdigest()
    
    if answer_hash == stored_hash:
        # Delete used CAPTCHA
        cache.delete(cache_key)
        return True
    
    return False


async def verify_hcaptcha(token: str, remote_ip: Optional[str] = None) -> bool:
    """
    Verify hCaptcha token.
    
    Args:
        token: hCaptcha response token from frontend
        remote_ip: Client IP address (optional)
    
    Returns:
        True if verification passed
    """
    if not HCAPTCHA_SECRET:
        logger.error("hCaptcha secret not configured")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://hcaptcha.com/siteverify",
                data={
                    "secret": HCAPTCHA_SECRET,
                    "response": token,
                    "remoteip": remote_ip
                }
            )
            result = response.json()
            
            if result.get("success"):
                return True
            
            logger.warning(f"hCaptcha verification failed: {result.get('error-codes', [])}")
            return False
            
    except Exception as e:
        logger.error(f"hCaptcha verification error: {e}")
        return False


async def verify_recaptcha(token: str, remote_ip: Optional[str] = None, min_score: float = 0.5) -> bool:
    """
    Verify reCAPTCHA v3 token.
    
    Args:
        token: reCAPTCHA response token from frontend
        remote_ip: Client IP address (optional)
        min_score: Minimum score threshold (0.0 to 1.0)
    
    Returns:
        True if verification passed with acceptable score
    """
    if not RECAPTCHA_SECRET:
        logger.error("reCAPTCHA secret not configured")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={
                    "secret": RECAPTCHA_SECRET,
                    "response": token,
                    "remoteip": remote_ip
                }
            )
            result = response.json()
            
            if result.get("success"):
                score = result.get("score", 0)
                if score >= min_score:
                    return True
                logger.warning(f"reCAPTCHA score too low: {score} < {min_score}")
            
            logger.warning(f"reCAPTCHA verification failed: {result.get('error-codes', [])}")
            return False
            
    except Exception as e:
        logger.error(f"reCAPTCHA verification error: {e}")
        return False


async def verify_captcha(
    captcha_type: str,
    captcha_id: Optional[str] = None,
    user_answer: Optional[str] = None,
    token: Optional[str] = None,
    remote_ip: Optional[str] = None
) -> bool:
    """
    Unified CAPTCHA verification.
    
    Args:
        captcha_type: "math", "hcaptcha", or "recaptcha"
        captcha_id: For math CAPTCHA
        user_answer: For math CAPTCHA
        token: For hCaptcha/reCAPTCHA
        remote_ip: Client IP address
    
    Returns:
        True if CAPTCHA verification passed
    """
    if captcha_type == "math":
        if not captcha_id or not user_answer:
            return False
        return verify_math_captcha(captcha_id, user_answer)
    
    elif captcha_type == "hcaptcha":
        if not token:
            return False
        return await verify_hcaptcha(token, remote_ip)
    
    elif captcha_type == "recaptcha":
        if not token:
            return False
        return await verify_recaptcha(token, remote_ip)
    
    else:
        logger.error(f"Unknown CAPTCHA type: {captcha_type}")
        return False


def get_captcha_config() -> dict:
    """
    Get CAPTCHA configuration for frontend.
    
    Returns:
        Dict with provider info and site keys
    """
    config = {
        "provider": CAPTCHA_PROVIDER,
        "enabled": True
    }
    
    if CAPTCHA_PROVIDER == "hcaptcha" and HCAPTCHA_SITEKEY:
        config["sitekey"] = HCAPTCHA_SITEKEY
    elif CAPTCHA_PROVIDER == "recaptcha":
        config["sitekey"] = os.environ.get('RECAPTCHA_SITEKEY')
    
    return config
