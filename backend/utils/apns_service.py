"""
Apple Push Notification Service (APNs) Integration
===================================================
Secure push notification service for iOS devices.
Uses JWT-based authentication with APNs HTTP/2 API.
"""

import os
import time
import logging
import httpx
import jwt
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# APNs Configuration
APNS_KEY_ID = os.environ.get('APNS_KEY_ID', '497KZ6499T')
APNS_TEAM_ID = os.environ.get('APNS_TEAM_ID', '5376HPKV8H')
APNS_BUNDLE_ID = os.environ.get('APNS_BUNDLE_ID', 'com.quadley.mobile1')

# APNs endpoints
APNS_PRODUCTION_URL = "https://api.push.apple.com"
APNS_SANDBOX_URL = "https://api.sandbox.push.apple.com"

# Use sandbox for development, production for App Store builds
APNS_USE_SANDBOX = os.environ.get('APNS_USE_SANDBOX', 'true').lower() == 'true'
APNS_URL = APNS_SANDBOX_URL if APNS_USE_SANDBOX else APNS_PRODUCTION_URL

# Private key from environment variable (base64 encoded or raw PEM)
APNS_PRIVATE_KEY = os.environ.get('APNS_PRIVATE_KEY', '')


class APNsService:
    """Apple Push Notification Service client"""
    
    def __init__(self):
        self._token: Optional[str] = None
        self._token_timestamp: float = 0
        self._token_lifetime: int = 3500  # Refresh token every ~58 minutes (Apple allows 1 hour)
        
    def _get_private_key(self) -> str:
        """Get the private key, handling both raw PEM and base64 encoded formats"""
        key = APNS_PRIVATE_KEY
        
        if not key:
            raise ValueError("APNS_PRIVATE_KEY environment variable not set")
        
        # If it doesn't look like a PEM key, try base64 decode
        if not key.startswith('-----BEGIN'):
            import base64
            try:
                key = base64.b64decode(key).decode('utf-8')
            except Exception:
                pass
        
        return key
    
    def _generate_token(self) -> str:
        """Generate a new JWT token for APNs authentication"""
        private_key = self._get_private_key()
        
        headers = {
            'alg': 'ES256',
            'kid': APNS_KEY_ID,
        }
        
        payload = {
            'iss': APNS_TEAM_ID,
            'iat': int(time.time()),
        }
        
        token = jwt.encode(
            payload,
            private_key,
            algorithm='ES256',
            headers=headers
        )
        
        return token
    
    def _get_token(self) -> str:
        """Get a valid JWT token, refreshing if necessary"""
        current_time = time.time()
        
        if not self._token or (current_time - self._token_timestamp) > self._token_lifetime:
            self._token = self._generate_token()
            self._token_timestamp = current_time
            logger.info("Generated new APNs JWT token")
        
        return self._token
    
    async def send_notification(
        self,
        device_token: str,
        title: str,
        body: str,
        badge: Optional[int] = None,
        sound: str = "default",
        data: Optional[Dict[str, Any]] = None,
        category: Optional[str] = None,
        thread_id: Optional[str] = None,
        priority: int = 10,
        expiration: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Send a push notification to a single device.
        
        Args:
            device_token: The APNs device token
            title: Notification title
            body: Notification body text
            badge: App badge number (None to leave unchanged)
            sound: Sound name or "default"
            data: Custom data payload
            category: Notification category for actions
            thread_id: Thread identifier for grouping
            priority: 10 for immediate, 5 for power-efficient
            expiration: Unix timestamp when notification expires
            
        Returns:
            Dict with 'success' boolean and 'apns_id' or 'error'
        """
        try:
            token = self._get_token()
            
            # Build the APNs payload
            aps = {
                'alert': {
                    'title': title,
                    'body': body,
                },
                'sound': sound,
            }
            
            if badge is not None:
                aps['badge'] = badge
            
            if category:
                aps['category'] = category
            
            if thread_id:
                aps['thread-id'] = thread_id
            
            payload = {'aps': aps}
            
            # Add custom data
            if data:
                payload.update(data)
            
            # Build headers
            headers = {
                'authorization': f'bearer {token}',
                'apns-topic': APNS_BUNDLE_ID,
                'apns-push-type': 'alert',
                'apns-priority': str(priority),
            }
            
            if expiration:
                headers['apns-expiration'] = str(expiration)
            
            # Send the request
            url = f"{APNS_URL}/3/device/{device_token}"
            
            async with httpx.AsyncClient(http2=True) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )
                
                apns_id = response.headers.get('apns-id', '')
                
                if response.status_code == 200:
                    logger.info(f"Push notification sent successfully: {apns_id}")
                    return {
                        'success': True,
                        'apns_id': apns_id,
                        'device_token': device_token[:20] + '...'
                    }
                else:
                    error_body = response.json() if response.content else {}
                    error_reason = error_body.get('reason', 'Unknown error')
                    logger.error(f"APNs error: {response.status_code} - {error_reason}")
                    
                    return {
                        'success': False,
                        'error': error_reason,
                        'status_code': response.status_code,
                        'device_token': device_token[:20] + '...'
                    }
                    
        except jwt.exceptions.InvalidKeyError as e:
            logger.error(f"APNs key error: {e}")
            return {'success': False, 'error': 'Invalid APNs key configuration'}
        except httpx.HTTPError as e:
            logger.error(f"APNs HTTP error: {e}")
            return {'success': False, 'error': f'HTTP error: {str(e)}'}
        except Exception as e:
            logger.error(f"APNs error: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_bulk_notifications(
        self,
        device_tokens: List[str],
        title: str,
        body: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send push notifications to multiple devices.
        
        Returns:
            Dict with 'sent', 'failed', and 'results' list
        """
        results = []
        sent = 0
        failed = 0
        
        for token in device_tokens:
            result = await self.send_notification(token, title, body, **kwargs)
            results.append(result)
            
            if result.get('success'):
                sent += 1
            else:
                failed += 1
        
        return {
            'sent': sent,
            'failed': failed,
            'total': len(device_tokens),
            'results': results
        }


# Singleton instance
apns_service = APNsService()


async def send_push_to_users(
    db,
    user_ids: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    notification_type: str = "general"
) -> Dict[str, Any]:
    """
    Send push notifications to specific users based on their registered devices.
    
    Args:
        db: Database connection
        user_ids: List of user IDs to notify
        title: Notification title
        body: Notification body
        data: Custom data payload
        notification_type: Type for preference checking (announcements, events, messages, etc.)
        
    Returns:
        Summary of sent notifications
    """
    try:
        # Get device tokens for users
        tokens_cursor = db.device_tokens.find({
            "user_id": {"$in": user_ids},
            "active": True,
            "platform": "ios"  # Filter for iOS devices
        })
        
        tokens = await tokens_cursor.to_list(1000)
        
        if not tokens:
            return {"sent": 0, "message": "No active iOS devices found"}
        
        # Check notification preferences (optional)
        # For now, we send to all - you can add preference checking here
        
        device_tokens = [t["device_token"] for t in tokens]
        
        # Include notification type in data
        payload_data = data or {}
        payload_data["type"] = notification_type
        payload_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Send notifications
        result = await apns_service.send_bulk_notifications(
            device_tokens=device_tokens,
            title=title,
            body=body,
            data=payload_data
        )
        
        # Log failed tokens for cleanup
        for r in result.get('results', []):
            if not r.get('success') and r.get('error') in ['BadDeviceToken', 'Unregistered']:
                # Mark token as inactive
                await db.device_tokens.update_one(
                    {"device_token": {"$regex": f"^{r.get('device_token', '')[:20]}"}},
                    {"$set": {"active": False}}
                )
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending push notifications: {e}")
        return {"sent": 0, "error": str(e)}


async def send_push_to_all(
    db,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    exclude_users: Optional[List[str]] = None,
    notification_type: str = "general"
) -> Dict[str, Any]:
    """
    Send push notification to all registered iOS devices.
    
    Args:
        db: Database connection
        title: Notification title
        body: Notification body
        data: Custom data payload
        exclude_users: List of user IDs to exclude
        notification_type: Type for preference checking (for future use)
        
    Returns:
        Summary of sent notifications
    """
    try:
        query = {"active": True, "platform": "ios"}
        
        if exclude_users:
            query["user_id"] = {"$nin": exclude_users}
        
        tokens = await db.device_tokens.find(query).to_list(10000)
        
        if not tokens:
            return {"sent": 0, "message": "No active iOS devices found"}
        
        device_tokens = [t["device_token"] for t in tokens]
        
        result = await apns_service.send_bulk_notifications(
            device_tokens=device_tokens,
            title=title,
            body=body,
            data=data or {}
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending broadcast notifications: {e}")
        return {"sent": 0, "error": str(e)}
