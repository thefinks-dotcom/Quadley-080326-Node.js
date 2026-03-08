"""CAPTCHA routes for bot protection.

OWASP A04 Compliance: Prevents automated attacks on public forms.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from utils.captcha import (
    generate_math_captcha, verify_captcha, get_captcha_config,
    CAPTCHA_PROVIDER
)

router = APIRouter(prefix="/captcha", tags=["captcha"])


class CaptchaVerifyRequest(BaseModel):
    """Request to verify CAPTCHA"""
    captcha_type: str  # "math", "hcaptcha", or "recaptcha"
    captcha_id: Optional[str] = None  # For math CAPTCHA
    answer: Optional[str] = None  # For math CAPTCHA
    token: Optional[str] = None  # For hCaptcha/reCAPTCHA


@router.get("/config")
async def get_config():
    """
    Get CAPTCHA configuration for frontend.
    
    Returns the active provider and any necessary site keys.
    """
    return get_captcha_config()


@router.get("/challenge")
async def get_challenge():
    """
    Get a new math CAPTCHA challenge.
    
    Returns a captcha_id and question. The user must submit
    the captcha_id with their answer for verification.
    """
    if CAPTCHA_PROVIDER != "math":
        return {
            "provider": CAPTCHA_PROVIDER,
            "message": f"Using {CAPTCHA_PROVIDER} - no server-side challenge needed"
        }
    
    captcha_id, question, _ = generate_math_captcha()
    
    return {
        "provider": "math",
        "captcha_id": captcha_id,
        "question": question
    }


@router.post("/verify")
async def verify(request: Request, verify_data: CaptchaVerifyRequest):
    """
    Verify a CAPTCHA response.
    
    For math CAPTCHA: provide captcha_id and answer
    For hCaptcha/reCAPTCHA: provide token
    """
    ip_address = request.client.host if request.client else None
    
    is_valid = await verify_captcha(
        captcha_type=verify_data.captcha_type,
        captcha_id=verify_data.captcha_id,
        user_answer=verify_data.answer,
        token=verify_data.token,
        remote_ip=ip_address
    )
    
    if is_valid:
        return {"verified": True, "message": "CAPTCHA verified successfully"}
    
    raise HTTPException(status_code=400, detail="CAPTCHA verification failed")
