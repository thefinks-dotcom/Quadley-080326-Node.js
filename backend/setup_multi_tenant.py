"""
Script to initialize the multi-tenant system with test data.
This clears old data and sets up:
- Super Admin in master database
- Test tenants with sample data
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# All available modules
ALL_MODULES = [
    "events", "announcements", "messages", "jobs", "dining",
    "maintenance", "recognition", "wellbeing", "academics",
    "cocurricular", "floor", "birthdays", "finance",
    "safe_disclosure", "parcels", "bookings"
]

async def setup_multi_tenant_test_data():
    mongo_url = os.environ.get('MONGO_URL')
    if not mongo_url:
        print("ERROR: MONGO_URL not set")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    
    print("=" * 60)
    print("MULTI-TENANT SYSTEM INITIALIZATION")
    print("=" * 60)
    
    # 1. Clear old databases
    print("\n[1/5] Clearing old databases...")
    
    # Drop old quadley database
    old_db_name = os.environ.get('DB_NAME', 'quadley')
    await client.drop_database(old_db_name)
    print(f"  - Dropped: {old_db_name}")
    
    # Drop any existing tenant databases
    db_names = await client.list_database_names()
    for db_name in db_names:
        if db_name.startswith('quadley_tenant_'):
            await client.drop_database(db_name)
            print(f"  - Dropped: {db_name}")
    
    # 2. Initialize master database
    print("\n[2/5] Setting up master database...")
    master_db = client['quadley_master']
    
    # Create indexes for master collections
    await master_db.tenants.create_index("code", unique=True)
    await master_db.tenants.create_index("contact_person_email")
    await master_db.invitations.create_index("token", unique=True)
    await master_db.invitations.create_index([("tenant_code", 1), ("email", 1)])
    await master_db.super_admins.create_index("email", unique=True)
    print("  - Created indexes")
    
    # 3. Create Super Admin
    print("\n[3/5] Creating Super Admin...")
    super_admin = {
        "id": str(uuid.uuid4()),
        "email": "gen@quadley.app",
        "password": hash_password("Quadley2025!"),
        "first_name": "Gen",
        "last_name": "Fink",
        "role": "super_admin",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await master_db.super_admins.insert_one(super_admin)
    print(f"  - Super Admin: {super_admin['email']} / Quadley2025!")
    
    # 4. Create Test Tenants
    print("\n[4/5] Creating test tenants...")
    
    tenants_data = [
        {
            "code": "ORMD0001",
            "name": "Ormond College",
            "contact_person_name": "Emily Parker",
            "contact_person_email": "epinker@icloud.com",
            "enabled_modules": ALL_MODULES.copy(),
            "status": "active"
        },
        {
            "code": "TRIN0002",
            "name": "Trinity College",
            "contact_person_name": "James Wilson",
            "contact_person_email": "jwilson@trinity.edu",
            "enabled_modules": ["events", "announcements", "messages", "dining", "maintenance"],
            "status": "active"
        }
    ]
    
    for tenant_data in tenants_data:
        tenant = {
            "id": str(uuid.uuid4()),
            **tenant_data,
            "user_count": 0,
            "next_user_sequence": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": super_admin['id']
        }
        await master_db.tenants.insert_one(tenant)
        print(f"  - Tenant: {tenant['name']} (Code: {tenant['code']})")
        
        # Create invitation for tenant admin
        invitation = {
            "id": str(uuid.uuid4()),
            "tenant_code": tenant['code'],
            "email": tenant['contact_person_email'],
            "role": "admin",
            "first_name": tenant['contact_person_name'].split()[0],
            "last_name": " ".join(tenant['contact_person_name'].split()[1:]),
            "token": str(uuid.uuid4()),
            "status": "pending",
            "invited_by": super_admin['id'],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }
        await master_db.invitations.insert_one(invitation)
        print(f"    - Admin invitation: {invitation['email']} (Token: {invitation['token'][:8]}...)")
        
        # Initialize tenant database
        tenant_db = client[f"quadley_tenant_{tenant['code'].lower()}"]
        
        # Create collections and indexes
        await tenant_db.users.create_index("email", unique=True)
        await tenant_db.users.create_index("user_id", unique=True)
        await tenant_db.events.create_index("date")
        await tenant_db.announcements.create_index([("created_at", -1)])
        await tenant_db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
        
        print(f"    - Database initialized: quadley_tenant_{tenant['code'].lower()}")
    
    # 5. Create sample users for first tenant (Ormond College)
    print("\n[5/5] Creating sample users for Ormond College...")
    
    ormond_db = client['quadley_tenant_ormd0001']
    
    sample_users = [
        {
            "user_id": "ORMD-000001",
            "email": "epinker@icloud.com",
            "first_name": "Emily",
            "last_name": "Parker",
            "role": "admin",
            "password": hash_password("AbC!123!")
        },
        {
            "user_id": "ORMD-000002",
            "email": "esmef@icloud.com",
            "first_name": "Esme",
            "last_name": "Foster",
            "role": "ra",
            "password": hash_password("Yellow!!")
        },
        {
            "user_id": "ORMD-000003",
            "email": "emeliaf@icloud.com",
            "first_name": "Emelia",
            "last_name": "Fink",
            "role": "student",
            "password": hash_password("Maroon!!")
        },
        {
            "user_id": "ORMD-000004",
            "email": "estherf@icloud.com",
            "first_name": "Esther",
            "last_name": "Fink",
            "role": "student",
            "password": hash_password("Purple!!")
        }
    ]
    
    for user_data in sample_users:
        user = {
            "id": str(uuid.uuid4()),
            "tenant_code": "ORMD0001",
            **user_data,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await ormond_db.users.insert_one(user)
        print(f"  - {user['role'].capitalize()}: {user['email']} ({user['user_id']})")
    
    # Update tenant user count
    await master_db.tenants.update_one(
        {"code": "ORMD0001"},
        {"$set": {"user_count": len(sample_users), "next_user_sequence": len(sample_users) + 1}}
    )
    
    # Mark admin invitation as accepted (since we created the admin directly)
    await master_db.invitations.update_one(
        {"tenant_code": "ORMD0001", "email": "epinker@icloud.com"},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    print("\n" + "=" * 60)
    print("INITIALIZATION COMPLETE!")
    print("=" * 60)
    print("\nTest Credentials:")
    print("-" * 40)
    print("Super Admin:")
    print("  Email: gen@quadley.app")
    print("  Password: Quadley2025!")
    print()
    print("Ormond College (ORMD0001):")
    print("  Admin: epinker@icloud.com / AbC!123!")
    print("  RA: esmef@icloud.com / Yellow!!")
    print("  Student: emeliaf@icloud.com / Maroon!!")
    print("  Student: estherf@icloud.com / Purple!!")
    print()
    print("Trinity College (TRIN0002):")
    print("  Admin invitation pending for: jwilson@trinity.edu")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_multi_tenant_test_data())
