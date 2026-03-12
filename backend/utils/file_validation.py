"""File upload validation utilities"""
from typing import Tuple
from pathlib import Path
import hashlib
import io

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

# Allowed file types
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_IMAGE_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Magic bytes for common image formats
IMAGE_SIGNATURES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
    b'RIFF': 'image/webp',  # WebP starts with RIFF
}

def detect_mime_type(content: bytes) -> str:
    """Detect MIME type from file content using magic bytes"""
    for signature, mime_type in IMAGE_SIGNATURES.items():
        if content.startswith(signature):
            return mime_type
    
    # Check for WebP (RIFF....WEBP)
    if content[:4] == b'RIFF' and content[8:12] == b'WEBP':
        return 'image/webp'
    
    return 'application/octet-stream'

async def validate_image_upload(file, filename: str) -> Tuple[bool, str, bytes]:
    """
    Validate uploaded image file for security.
    Returns (is_valid, error_message, file_content)
    """
    
    # Check file extension
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return False, f"File type {ext} not allowed. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}", b''
    
    # Read file content
    content = await file.read()
    await file.seek(0)  # Reset for later use
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        return False, f"File too large. Maximum size: {MAX_FILE_SIZE // 1024 // 1024}MB", b''
    
    # Check if file is empty
    if len(content) == 0:
        return False, "File is empty", b''
    
    # Check MIME type using magic bytes
    detected_mime = detect_mime_type(content)
    if detected_mime not in ALLOWED_IMAGE_MIME_TYPES:
        return False, f"Invalid file content. Expected image, detected: {detected_mime}", b''
    
    # Check for embedded scripts in first 1KB
    try:
        content_preview = content[:1000].decode('latin-1', errors='ignore').lower()
        dangerous_patterns = ['<script', '<?php', 'javascript:', 'onerror=', 'onload=', 'eval(']
        for pattern in dangerous_patterns:
            if pattern in content_preview:
                return False, "File contains potentially dangerous content", b''
    except Exception:
        pass
    
    # Strip EXIF metadata (location, device info, etc.) to protect user privacy
    content = _strip_exif(content, detected_mime)

    return True, "", content


def _strip_exif(content: bytes, mime_type: str) -> bytes:
    """
    Remove EXIF metadata from image content using Pillow.
    Only strips from formats that commonly carry EXIF (JPEG, PNG, WebP).
    Returns original bytes if stripping fails or Pillow is unavailable.
    """
    if not PILLOW_AVAILABLE or mime_type not in ('image/jpeg', 'image/png', 'image/webp'):
        return content

    try:
        img = Image.open(io.BytesIO(content))
        data = list(img.getdata())
        clean_img = Image.new(img.mode, img.size)
        clean_img.putdata(data)

        buf = io.BytesIO()
        fmt_map = {'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WEBP'}
        clean_img.save(buf, format=fmt_map[mime_type])
        return buf.getvalue()
    except Exception:
        return content

def generate_safe_filename(original_filename: str, prefix: str, content: bytes) -> str:
    """Generate a safe filename using hash"""
    file_hash = hashlib.sha256(content).hexdigest()[:12]
    safe_ext = Path(original_filename).suffix.lower()
    if safe_ext not in ALLOWED_IMAGE_EXTENSIONS:
        safe_ext = '.jpg'  # Default extension
    return f"{prefix}_{file_hash}{safe_ext}"

def sanitize_csv_value(value: str) -> str:
    """
    Prevent CSV formula injection by escaping values that start with
    dangerous characters: =, +, -, @, |, %
    """
    if not value:
        return value
    
    value = str(value).strip()
    
    # Characters that can trigger formula execution in spreadsheets
    dangerous_chars = ('=', '+', '-', '@', '|', '%')
    
    if value.startswith(dangerous_chars):
        # Prefix with single quote to treat as text
        return "'" + value
    
    return value
