"""
Multi-tenant database management utility.
Each tenant gets their own database for complete data isolation.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Dict
import os
import logging
import random
import string

# Master database connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)

# Master database - stores tenants, super admins, invitations
MASTER_DB_NAME = "quadley_master"
master_db = client[MASTER_DB_NAME]

# Cache for tenant database connections
_tenant_db_cache: Dict[str, AsyncIOMotorDatabase] = {}

# All available modules that can be toggled
ALL_MODULES = [
    "events",
    "announcements", 
    "messages",
    "jobs",
    "dining",
    "maintenance",
    "recognition",
    "wellbeing",
    "academics",
    "cocurricular",
    "floor",
    "birthdays",
    "finance",
    "safe_disclosure",
    "parcels",
    "bookings"
]

def generate_tenant_code(name: str) -> str:
    """Generate a unique tenant code from name"""
    # Create base code from name (first 3-4 chars, uppercase)
    base = ''.join(c for c in name.upper() if c.isalnum())[:4]
    # Add random suffix
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"{base}{suffix}"

def get_tenant_db_name(tenant_code: str) -> str:
    """Get the database name for a tenant"""
    return f"quadley_tenant_{tenant_code.lower()}"

def get_tenant_db(tenant_code: str) -> AsyncIOMotorDatabase:
    """Get database connection for a specific tenant"""
    if not tenant_code:
        raise ValueError("Tenant code is required")
    
    if tenant_code not in _tenant_db_cache:
        db_name = get_tenant_db_name(tenant_code)
        _tenant_db_cache[tenant_code] = client[db_name]
        logging.info(f"Created database connection for tenant: {tenant_code}")
    
    return _tenant_db_cache[tenant_code]

async def initialize_tenant_database(tenant_code: str) -> bool:
    """
    Initialize collections and indexes for a new tenant database.
    Called when a new tenant is created.
    """
    try:
        db = get_tenant_db(tenant_code)
        
        # Create collections with indexes
        collections_config = {
            "users": [
                {"keys": [("email", 1)], "unique": True},
                {"keys": [("user_id", 1)], "unique": True},
                {"keys": [("role", 1)]},
            ],
            "events": [
                {"keys": [("date", 1)]},
                {"keys": [("created_by", 1)]},
            ],
            "announcements": [
                {"keys": [("created_at", -1)]},
                {"keys": [("priority", -1)]},
            ],
            "messages": [
                {"keys": [("conversation_id", 1)]},
                {"keys": [("created_at", -1)]},
            ],
            "conversations": [
                {"keys": [("participants", 1)]},
            ],
            "jobs": [
                {"keys": [("status", 1)]},
                {"keys": [("created_at", -1)]},
            ],
            "menu": [
                {"keys": [("date", 1)]},
                {"keys": [("meal_type", 1)]},
            ],
            "late_meals": [
                {"keys": [("student_id", 1)]},
                {"keys": [("date", 1)]},
            ],
            "maintenance": [
                {"keys": [("submitted_by", 1)]},
                {"keys": [("status", 1)]},
            ],
            "shoutouts": [
                {"keys": [("created_at", -1)]},
            ],
            "wellbeing": [
                {"keys": [("user_id", 1)]},
            ],
            "study_groups": [
                {"keys": [("subject", 1)]},
            ],
            "tutoring": [
                {"keys": [("subject", 1)]},
            ],
            "cocurricular": [
                {"keys": [("category", 1)]},
            ],
            "floor_posts": [
                {"keys": [("floor", 1)]},
                {"keys": [("created_at", -1)]},
            ],
            "birthdays": [
                {"keys": [("month", 1), ("day", 1)]},
            ],
            "bills": [
                {"keys": [("user_id", 1)]},
                {"keys": [("due_date", 1)]},
            ],
            "safe_disclosures": [
                {"keys": [("submitted_by", 1)]},
                {"keys": [("status", 1)]},
            ],
            "parcels": [
                {"keys": [("recipient_id", 1)]},
                {"keys": [("status", 1)]},
            ],
            "bookings": [
                {"keys": [("user_id", 1)]},
                {"keys": [("facility", 1)]},
                {"keys": [("date", 1)]},
            ],
            "notifications": [
                {"keys": [("user_id", 1)]},
                {"keys": [("read", 1)]},
                {"keys": [("created_at", -1)]},
            ],
        }
        
        for collection_name, indexes in collections_config.items():
            collection = db[collection_name]
            for index_config in indexes:
                try:
                    await collection.create_index(
                        index_config["keys"],
                        unique=index_config.get("unique", False),
                        background=True
                    )
                except Exception as e:
                    logging.warning(f"Index creation warning for {collection_name}: {e}")
        
        logging.info(f"Initialized database for tenant: {tenant_code}")
        return True
        
    except Exception as e:
        logging.error(f"Error initializing tenant database: {e}")
        return False

async def delete_tenant_database(tenant_code: str) -> bool:
    """
    Delete a tenant's database completely.
    Use with caution - this is irreversible!
    """
    try:
        db_name = get_tenant_db_name(tenant_code)
        await client.drop_database(db_name)
        
        # Remove from cache
        if tenant_code in _tenant_db_cache:
            del _tenant_db_cache[tenant_code]
        
        logging.info(f"Deleted database for tenant: {tenant_code}")
        return True
        
    except Exception as e:
        logging.error(f"Error deleting tenant database: {e}")
        return False

def generate_user_id(tenant_code: str, sequence: int) -> str:
    """Generate a unique user ID for a tenant"""
    return f"{tenant_code.upper()}-{sequence:06d}"
