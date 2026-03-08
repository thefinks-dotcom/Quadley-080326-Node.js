"""Migration: Add tenant support to existing data"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "residential_college_db")

DEFAULT_TENANT_ID = "default_college"
DEFAULT_TENANT_NAME = "Default College"

async def migrate():
    """Add tenant_id to all existing collections"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔄 Starting tenant migration...")
    
    # Create default tenant
    print("\n1️⃣ Creating default tenant...")
    existing_tenant = await db.tenants.find_one({"tenant_id": DEFAULT_TENANT_ID})
    if not existing_tenant:
        tenant_doc = {
            "id": DEFAULT_TENANT_ID,
            "tenant_id": DEFAULT_TENANT_ID,
            "tenant_name": DEFAULT_TENANT_NAME,
            "domain": "example.edu",
            "contact_email": "admin@example.edu",
            "status": "active",
            "capacity": 500,
            "floors": ["Floor 1", "Floor 2", "Floor 3", "Floor 4"],
            "features_enabled": ["events", "dining", "maintenance", "academics"],
            "primary_color": "#3b82f6",
            "secondary_color": "#1f2937",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tenants.insert_one(tenant_doc)
        print(f"✅ Created tenant: {DEFAULT_TENANT_ID}")
    else:
        print(f"ℹ️  Tenant already exists: {DEFAULT_TENANT_ID}")
    
    # Collections to migrate
    collections = [
        "users",
        "announcements",
        "events",
        "maintenance",
        "shoutouts",
        "study_groups",
        "messages",
        "message_groups",
        "cultural_groups",
        "sports_groups",
        "clubs",
        "tutoring_applications",
        "parcels",
        "study_streaks"
    ]
    
    print("\n2️⃣ Migrating collections...")
    for collection_name in collections:
        # Check if collection exists
        collection_list = await db.list_collection_names()
        if collection_name not in collection_list:
            print(f"⏭️  Skipping {collection_name} (doesn't exist)")
            continue
        
        # Count documents without tenant_id
        count = await db[collection_name].count_documents({"tenant_id": {"$exists": False}})
        
        if count > 0:
            result = await db[collection_name].update_many(
                {"tenant_id": {"$exists": False}},
                {"$set": {"tenant_id": DEFAULT_TENANT_ID}}
            )
            print(f"✅ {collection_name}: Updated {result.modified_count} documents")
        else:
            print(f"ℹ️  {collection_name}: Already migrated")
    
    # Create indexes
    print("\n3️⃣ Creating compound indexes...")
    indexes = [
        ("users", [("tenant_id", 1), ("email", 1)], {"unique": True}),
        ("announcements", [("tenant_id", 1), ("created_at", -1)], {}),
        ("events", [("tenant_id", 1), ("date", 1)], {}),
        ("shoutouts", [("tenant_id", 1), ("created_at", -1)], {}),
        ("maintenance", [("tenant_id", 1), ("created_at", -1)], {}),
    ]
    
    for collection_name, keys, options in indexes:
        if collection_name in await db.list_collection_names():
            try:
                await db[collection_name].create_index(keys, **options)
                print(f"✅ Created index on {collection_name}")
            except Exception as e:
                print(f"⚠️  Index on {collection_name}: {str(e)}")
    
    print("\n✅ Migration complete!")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
