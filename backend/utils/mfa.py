"""Multi-Factor Authentication (MFA) using TOTP.

OWASP A07 Compliance: Implements MFA for privileged accounts.

This module provides TOTP-based MFA that can be enabled for admin users.
Compatible with Google Authenticator, Authy, and other TOTP apps.
"""
import pyotp
import qrcode
import io
import base64
from datetime import datetime, timezone
from typing import Optional, Tuple
import secrets
import logging

logger = logging.getLogger(__name__)

# MFA constants
MFA_ISSUER = "Quadley"
BACKUP_CODE_COUNT = 10
BACKUP_CODE_LENGTH = 8


def generate_mfa_secret() -> str:
    """Generate a new TOTP secret for a user"""
    return pyotp.random_base32()


def get_totp_uri(email: str, secret: str) -> str:
    """Generate the TOTP provisioning URI for QR code scanning"""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=MFA_ISSUER)


def generate_qr_code_base64(email: str, secret: str) -> str:
    """Generate a QR code image as base64 string for easy embedding"""
    uri = get_totp_uri(email, secret)
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()


def verify_totp(secret: str, code: str) -> bool:
    """
    Verify a TOTP code.
    
    Args:
        secret: User's TOTP secret
        code: 6-digit code from authenticator app
    
    Returns:
        True if code is valid
    """
    if not secret or not code:
        return False
    
    # Clean the code (remove spaces, dashes)
    code = code.replace(" ", "").replace("-", "")
    
    if len(code) != 6 or not code.isdigit():
        return False
    
    totp = pyotp.TOTP(secret)
    # valid_window=1 allows for clock drift (30 sec before/after)
    return totp.verify(code, valid_window=1)


def generate_backup_codes() -> list:
    """Generate backup codes for recovery"""
    codes = []
    for _ in range(BACKUP_CODE_COUNT):
        code = secrets.token_hex(BACKUP_CODE_LENGTH // 2).upper()
        # Format as XXXX-XXXX
        formatted = f"{code[:4]}-{code[4:]}"
        codes.append(formatted)
    return codes


def hash_backup_codes(codes: list) -> list:
    """Hash backup codes for storage (one-way)"""
    import hashlib
    return [hashlib.sha256(code.encode()).hexdigest() for code in codes]


def verify_backup_code(code: str, hashed_codes: list) -> Tuple[bool, Optional[str]]:
    """
    Verify a backup code.
    
    Returns:
        Tuple of (is_valid, hash_to_remove)
    """
    import hashlib
    
    code = code.replace(" ", "").replace("-", "").upper()
    if len(code) == 8:
        code = f"{code[:4]}-{code[4:]}"
    
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    
    if code_hash in hashed_codes:
        return True, code_hash
    
    return False, None


class MFAService:
    """Service class for MFA operations with database"""
    
    def __init__(self, db):
        self.db = db
    
    async def setup_mfa(self, user_id: str, email: str) -> dict:
        """
        Start MFA setup for a user.
        
        Returns:
            Dict with secret, qr_code, and backup_codes
        """
        secret = generate_mfa_secret()
        backup_codes = generate_backup_codes()
        hashed_codes = hash_backup_codes(backup_codes)
        qr_code = generate_qr_code_base64(email, secret)
        
        # Store pending MFA setup (not yet verified)
        await self.db.mfa_setup.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "secret": secret,
                    "backup_codes": hashed_codes,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "verified": False
                }
            },
            upsert=True
        )
        
        return {
            "secret": secret,
            "qr_code": qr_code,
            "backup_codes": backup_codes,
            "message": "Scan the QR code with your authenticator app, then verify with a code"
        }
    
    async def verify_and_enable_mfa(self, user_id: str, code: str) -> bool:
        """
        Verify initial MFA code and enable MFA for the user.
        """
        setup = await self.db.mfa_setup.find_one({"user_id": user_id, "verified": False})
        
        if not setup:
            return False
        
        if not verify_totp(setup["secret"], code):
            return False
        
        # MFA verified, enable it for the user
        await self.db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "mfa_enabled": True,
                    "mfa_secret": setup["secret"],
                    "mfa_backup_codes": setup["backup_codes"]
                }
            }
        )
        
        # Mark setup as verified
        await self.db.mfa_setup.update_one(
            {"user_id": user_id},
            {"$set": {"verified": True}}
        )
        
        logger.info(f"MFA enabled for user {user_id}")
        return True
    
    async def verify_mfa_code(self, user_id: str, code: str) -> bool:
        """
        Verify MFA code during login.
        """
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0})
        
        if not user or not user.get("mfa_enabled"):
            return True  # MFA not enabled, skip verification
        
        secret = user.get("mfa_secret")
        if not secret:
            return True
        
        return verify_totp(secret, code)
    
    async def verify_backup_code(self, user_id: str, code: str) -> bool:
        """
        Verify a backup code and consume it.
        """
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0})
        
        if not user or not user.get("mfa_enabled"):
            return False
        
        hashed_codes = user.get("mfa_backup_codes", [])
        is_valid, hash_to_remove = verify_backup_code(code, hashed_codes)
        
        if is_valid and hash_to_remove:
            # Remove used backup code
            await self.db.users.update_one(
                {"id": user_id},
                {"$pull": {"mfa_backup_codes": hash_to_remove}}
            )
            logger.info(f"Backup code used for user {user_id}")
            return True
        
        return False
    
    async def disable_mfa(self, user_id: str) -> bool:
        """
        Disable MFA for a user.
        """
        await self.db.users.update_one(
            {"id": user_id},
            {
                "$set": {"mfa_enabled": False},
                "$unset": {"mfa_secret": "", "mfa_backup_codes": ""}
            }
        )
        
        # Clean up setup records
        await self.db.mfa_setup.delete_many({"user_id": user_id})
        
        logger.info(f"MFA disabled for user {user_id}")
        return True
    
    async def regenerate_backup_codes(self, user_id: str) -> list:
        """
        Generate new backup codes (invalidates old ones).
        """
        backup_codes = generate_backup_codes()
        hashed_codes = hash_backup_codes(backup_codes)
        
        await self.db.users.update_one(
            {"id": user_id},
            {"$set": {"mfa_backup_codes": hashed_codes}}
        )
        
        logger.info(f"Backup codes regenerated for user {user_id}")
        return backup_codes
    
    async def is_mfa_enabled(self, user_id: str) -> bool:
        """Check if MFA is enabled for a user"""
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "mfa_enabled": 1})
        return user.get("mfa_enabled", False) if user else False
    
    async def get_mfa_status(self, user_id: str) -> dict:
        """Get MFA status for a user"""
        user = await self.db.users.find_one(
            {"id": user_id}, 
            {"_id": 0, "mfa_enabled": 1, "mfa_backup_codes": 1}
        )
        
        if not user:
            return {"enabled": False, "backup_codes_remaining": 0}
        
        return {
            "enabled": user.get("mfa_enabled", False),
            "backup_codes_remaining": len(user.get("mfa_backup_codes", []))
        }
