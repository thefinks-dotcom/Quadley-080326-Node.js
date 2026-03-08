"""
PII Field-Level Encryption (OWASP A02 - Cryptographic Failures)
================================================================
AES-256-GCM encryption for sensitive PII fields in MongoDB documents.
Encrypts phone numbers, emergency contacts, and other sensitive data at rest.

Usage:
    from utils.field_encryption import encrypt_field, decrypt_field, encrypt_pii_fields, decrypt_pii_fields

    # Single field
    encrypted = encrypt_field("555-1234")
    decrypted = decrypt_field(encrypted)

    # Document-level (encrypts specified fields in-place)
    doc = {"name": "Alice", "phone": "555-1234", "emergency_contact": "555-5678"}
    encrypt_pii_fields(doc, ["phone", "emergency_contact"])
    # doc is now {"name": "Alice", "phone": "enc:...", "emergency_contact": "enc:..."}
    decrypt_pii_fields(doc, ["phone", "emergency_contact"])
    # doc is restored to original
"""
import os
import base64
import hashlib
import logging
from pathlib import Path
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Encryption prefix to identify encrypted values
ENCRYPTED_PREFIX = "enc:"

# Derive a 256-bit key from the JWT_SECRET (or a dedicated ENCRYPTION_KEY if set)
_raw_key = os.environ.get("ENCRYPTION_KEY") or os.environ.get("JWT_SECRET", "")
if not _raw_key:
    logger.critical("SECURITY: No ENCRYPTION_KEY or JWT_SECRET set. Field encryption DISABLED — PII will NOT be protected.")
    _ENCRYPTION_KEY = None
else:
    # Derive a stable 32-byte key via SHA-256
    _ENCRYPTION_KEY = hashlib.sha256(_raw_key.encode()).digest()


def encrypt_field(value: str) -> str:
    """Encrypt a single string value using AES-256-GCM.
    Returns a prefixed base64 string: 'enc:<nonce>:<ciphertext+tag>'
    If encryption is not configured, returns the original value.
    """
    if not value or not isinstance(value, str):
        return value
    if value.startswith(ENCRYPTED_PREFIX):
        return value  # Already encrypted
    if _ENCRYPTION_KEY is None:
        raise ValueError("Encryption key not configured — refusing to store unprotected PII. Set ENCRYPTION_KEY or JWT_SECRET.")

    try:
        aesgcm = AESGCM(_ENCRYPTION_KEY)
        nonce = os.urandom(12)  # 96-bit nonce for GCM
        ciphertext = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
        encoded = base64.b64encode(nonce + ciphertext).decode("ascii")
        return f"{ENCRYPTED_PREFIX}{encoded}"
    except Exception as e:
        logger.error(f"Field encryption failed: {e}")
        raise ValueError("Encryption failed: refusing to store unprotected sensitive data")


def decrypt_field(value: str) -> str:
    """Decrypt a single enc:-prefixed string.
    Returns the plaintext, or the original value if not encrypted / decryption fails.
    """
    if not value or not isinstance(value, str):
        return value
    if not value.startswith(ENCRYPTED_PREFIX):
        return value  # Not encrypted
    if _ENCRYPTION_KEY is None:
        return value

    try:
        raw = base64.b64decode(value[len(ENCRYPTED_PREFIX):])
        nonce = raw[:12]
        ciphertext = raw[12:]
        aesgcm = AESGCM(_ENCRYPTION_KEY)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception as e:
        logger.error(f"Field decryption failed: {e}")
        return value  # Return as-is to avoid data loss


def encrypt_pii_fields(doc: dict, fields: list[str]) -> dict:
    """Encrypt specified fields in a document dict (in-place).
    Only encrypts non-empty string values that aren't already encrypted.
    """
    for field in fields:
        val = doc.get(field)
        if val and isinstance(val, str):
            doc[field] = encrypt_field(val)
    return doc


def decrypt_pii_fields(doc: dict, fields: list[str]) -> dict:
    """Decrypt specified fields in a document dict (in-place)."""
    for field in fields:
        val = doc.get(field)
        if val and isinstance(val, str):
            doc[field] = decrypt_field(val)
    return doc


# Default PII fields that should be encrypted when stored
DEFAULT_PII_FIELDS = [
    "phone",
    "emergency_contact",
    "emergency_contact_phone",
    "emergency_contact_name",
    "medical_info",
    "preferred_contact",
]


def is_encryption_enabled() -> bool:
    """Check if field encryption is properly configured."""
    return _ENCRYPTION_KEY is not None
