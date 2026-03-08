"""URL validation utilities for SSRF prevention"""
from urllib.parse import urlparse
from typing import Tuple
import ipaddress

# Trusted image hosts (add your CDN domains here)
ALLOWED_IMAGE_HOSTS = [
    'images.unsplash.com',
    'cdn.quadley.app',
    'storage.googleapis.com',
    'res.cloudinary.com',
    'i.imgur.com',
]

# Dangerous hosts to always block
BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'metadata.google',
    '169.254.169.254',  # AWS metadata
    'metadata.google.internal',
]

def validate_image_url(url: str, strict_mode: bool = False) -> Tuple[bool, str]:
    """
    Validate image URL to prevent SSRF.
    
    Args:
        url: The URL to validate
        strict_mode: If True, only allow hosts in ALLOWED_IMAGE_HOSTS
    
    Returns:
        (is_valid, error_message)
    """
    
    if not url:
        return False, "URL is required"
    
    if len(url) > 2048:
        return False, "URL too long"
    
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"
    
    # Must be HTTP or HTTPS
    if parsed.scheme not in ('https', 'http'):
        return False, "URL must use HTTP or HTTPS"
    
    # Check hostname exists
    hostname = parsed.hostname
    if not hostname:
        return False, "Invalid hostname"
    
    hostname_lower = hostname.lower()
    
    # Block dangerous hosts
    for blocked in BLOCKED_HOSTS:
        if blocked in hostname_lower:
            return False, "This host is not allowed"
    
    # Block internal/private IPs
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
            return False, "Internal IP addresses not allowed"
    except ValueError:
        # Not an IP, it's a hostname
        if strict_mode:
            # In strict mode, check against allowlist
            if hostname_lower not in [h.lower() for h in ALLOWED_IMAGE_HOSTS]:
                return False, "Host not in allowed list"
    
    # Check file extension
    path_lower = parsed.path.lower()
    allowed_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')
    if not any(path_lower.endswith(ext) for ext in allowed_extensions):
        # Allow URLs without extension (some CDNs don't use extensions)
        pass
    
    return True, ""
