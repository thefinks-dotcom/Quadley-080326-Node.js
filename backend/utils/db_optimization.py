"""Database Performance Optimization

This module provides:
1. Index creation for frequently queried fields
2. Query optimization helpers
3. Database maintenance utilities
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def create_indexes(db):
    """
    Create database indexes for optimal query performance.
    
    Run this on application startup or as a migration.
    Uses background=True to avoid blocking and handles existing indexes gracefully.
    """
    logger.info("Creating database indexes...")
    
    async def safe_create_index(collection, keys, **kwargs):
        """Create index, ignoring if it already exists"""
        try:
            kwargs['background'] = True  # Don't block operations
            await collection.create_index(keys, **kwargs)
        except Exception as e:
            # Index already exists or minor issue - not critical
            if "IndexKeySpecsConflict" not in str(e) and "DuplicateKey" not in str(e):
                logger.debug(f"Index creation note for {collection.name}: {e}")
    
    try:
        # Users collection
        await safe_create_index(db.users, "email")
        await safe_create_index(db.users, "id")
        await safe_create_index(db.users, "role")
        await safe_create_index(db.users, "tenant_id")
        await safe_create_index(db.users, "floor")
        
        # Events collection
        await safe_create_index(db.events, "id")
        await safe_create_index(db.events, "start_time")
        await safe_create_index(db.events, "type")
        await safe_create_index(db.events, "created_by")
        await safe_create_index(db.events, [("start_time", -1)])
        
        # Announcements collection
        await safe_create_index(db.announcements, "id")
        await safe_create_index(db.announcements, [("created_at", -1)])
        await safe_create_index(db.announcements, "priority")
        
        # Messages collection - critical for chat performance
        await safe_create_index(db.messages, "id")
        await safe_create_index(db.messages, "group_id")
        await safe_create_index(db.messages, "sender_id")
        await safe_create_index(db.messages, "conversation_id")
        await safe_create_index(db.messages, "receiver_id")
        await safe_create_index(db.messages, [("group_id", 1), ("created_at", -1)])
        await safe_create_index(db.messages, [("conversation_id", 1), ("timestamp", -1)])
        await safe_create_index(db.messages, [("sender_id", 1), ("receiver_id", 1), ("timestamp", -1)])
        
        # Conversations for fast lookup
        await safe_create_index(db.conversations, "id")
        await safe_create_index(db.conversations, "conversation_id")
        await safe_create_index(db.conversations, [("participants", 1)])
        await safe_create_index(db.conversations, [("updated_at", -1)])
        
        # Message groups
        await safe_create_index(db.message_groups, "id")
        await safe_create_index(db.message_groups, "members")
        await safe_create_index(db.message_groups, [("updated_at", -1)])
        
        # Maintenance requests
        await safe_create_index(db.maintenance_requests, "id")
        await safe_create_index(db.maintenance_requests, "user_id")
        await safe_create_index(db.maintenance_requests, "status")
        await safe_create_index(db.maintenance_requests, [("created_at", -1)])
        
        # Late meals
        await safe_create_index(db.late_meals, "id")
        await safe_create_index(db.late_meals, "user_id")
        await safe_create_index(db.late_meals, "date")
        
        # Jobs
        await safe_create_index(db.jobs, "id")
        await safe_create_index(db.jobs, "status")
        await safe_create_index(db.jobs, [("created_at", -1)])
        await safe_create_index(db.job_applications, "id")
        await safe_create_index(db.job_applications, "job_id")
        await safe_create_index(db.job_applications, "user_id")
        
        # Shoutouts
        await safe_create_index(db.shoutouts, "id")
        await safe_create_index(db.shoutouts, "receiver_id")
        await safe_create_index(db.shoutouts, [("created_at", -1)])
        
        # Safe disclosures
        await safe_create_index(db.safe_disclosures, "id")
        await safe_create_index(db.safe_disclosures, "user_id")
        await safe_create_index(db.safe_disclosures, "status")
        
        # Bookings
        await safe_create_index(db.bookings, "id")
        await safe_create_index(db.bookings, "user_id")
        await safe_create_index(db.bookings, "date")
        
        # Parcels
        await safe_create_index(db.parcels, "id")
        await safe_create_index(db.parcels, "user_id")
        await safe_create_index(db.parcels, [("created_at", -1)])
        
        # Notifications
        await safe_create_index(db.notification_history, "id")
        await safe_create_index(db.notification_history, "user_id")
        await safe_create_index(db.notification_history, [("user_id", 1), ("created_at", -1)])
        
        # Security collections
        await safe_create_index(db.login_attempts, "email")
        await safe_create_index(db.login_attempts, "timestamp")
        await safe_create_index(db.token_blacklist, "expires_at")
        await safe_create_index(db.password_reset_tokens, "email")
        await safe_create_index(db.password_reset_tokens, "expires_at")
        await safe_create_index(db.mfa_setup, "user_id")
        await safe_create_index(db.security_logs, "user_id")
        await safe_create_index(db.security_logs, [("timestamp", -1)])
        
        # Other collections
        await safe_create_index(db.cocurricular_groups, "id")
        await safe_create_index(db.study_groups, "id")
        await safe_create_index(db.tutoring_requests, "id")
        await safe_create_index(db.tenants, "id")
        await safe_create_index(db.device_tokens, "user_id")
        
        logger.info("Database indexes created/verified successfully")
        return True
        
    except Exception as e:
        logger.warning(f"Index creation completed with warnings: {e}")
        return True  # Don't fail startup for index issues


async def create_master_indexes(master_db):
    """
    Create indexes on the master database (quadley_master).
    Called separately from create_indexes() because master_db is a different
    Mongo database than the per-tenant db passed to create_indexes().
    """
    logger.info("Creating master database indexes...")

    async def safe(collection, keys, **kwargs):
        try:
            kwargs['background'] = True
            await collection.create_index(keys, **kwargs)
        except Exception as e:
            if "IndexKeySpecsConflict" not in str(e) and "DuplicateKey" not in str(e):
                logger.debug(f"Master index note for {collection.name}: {e}")

    try:
        # tenants.code is queried on every app launch (branding endpoint)
        await safe(master_db.tenants, [("code", 1)], unique=True, name="tenants_code_unique")
        await safe(master_db.tenants, [("code", 1), ("status", 1)], name="tenants_code_status")
        await safe(master_db.tenants, "id")

        # super_admins looked up by email and id on every auth check
        await safe(master_db.super_admins, "email", unique=True)
        await safe(master_db.super_admins, "id")

        logger.info("Master database indexes created/verified successfully")
        return True
    except Exception as e:
        logger.warning(f"Master index creation completed with warnings: {e}")
        return True


async def get_index_stats(db) -> dict:
    """Get statistics about database indexes"""
    stats = {}
    
    collections = await db.list_collection_names()
    for collection_name in collections:
        try:
            indexes = await db[collection_name].index_information()
            stats[collection_name] = {
                "index_count": len(indexes),
                "indexes": list(indexes.keys())
            }
        except Exception as e:
            stats[collection_name] = {"error": str(e)}
    
    return stats


async def cleanup_expired_data(db):
    """
    Clean up expired data from various collections.
    Run periodically (e.g., daily via cron or background task).
    """
    logger.info("Starting cleanup of expired data...")
    
    now = datetime.now(timezone.utc)
    results = {}
    
    try:
        # Clean expired password reset tokens
        result = await db.password_reset_tokens.delete_many({
            "expires_at": {"$lt": now.isoformat()}
        })
        results["password_reset_tokens"] = result.deleted_count
        
        # Clean expired blacklisted tokens
        result = await db.token_blacklist.delete_many({
            "expires_at": {"$lt": now}
        })
        results["token_blacklist"] = result.deleted_count
        
        # Clean old login attempts (older than 24 hours)
        from datetime import timedelta
        cutoff = now - timedelta(hours=24)
        result = await db.login_attempts.delete_many({
            "timestamp": {"$lt": cutoff.isoformat()}
        })
        results["login_attempts"] = result.deleted_count
        
        # Clean old unverified MFA setups (older than 1 hour)
        mfa_cutoff = now - timedelta(hours=1)
        result = await db.mfa_setup.delete_many({
            "verified": False,
            "created_at": {"$lt": mfa_cutoff.isoformat()}
        })
        results["mfa_setup"] = result.deleted_count
        
        logger.info(f"Cleanup completed: {results}")
        return results
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        return {"error": str(e)}


async def optimize_collection(db, collection_name: str):
    """Run compact command on a collection (requires admin privileges)"""
    try:
        await db.command("compact", collection_name)
        logger.info(f"Compacted collection: {collection_name}")
        return True
    except Exception as e:
        logger.warning(f"Could not compact {collection_name}: {e}")
        return False
