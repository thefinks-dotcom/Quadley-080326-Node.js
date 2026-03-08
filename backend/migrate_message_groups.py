"""
Migration Script: Add Message Groups to Existing Co-Curricular Groups
Creates message groups for all co-curricular groups that don't have them
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from uuid import uuid4
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'residential_college_db')

async def migrate_message_groups():
    """Add message groups to all co-curricular groups that don't have them"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔍 Scanning for co-curricular groups without message groups...")
    
    # Find all co-curricular groups
    groups = await db.cocurricular_groups.find(
        {},
        {"_id": 0}
    ).to_list(1000)
    
    total_groups = len(groups)
    groups_without_chat = 0
    groups_updated = 0
    errors = 0
    
    print(f"📊 Found {total_groups} total co-curricular groups\n")
    
    for group in groups:
        group_id = group.get('id')
        group_name = group.get('name')
        group_type = group.get('type')
        message_group_id = group.get('message_group_id')
        members = group.get('members', [])
        member_names = group.get('member_names', [])
        
        # Check if message group already exists
        if message_group_id:
            # Verify message group exists in database
            msg_group = await db.message_groups.find_one({"id": message_group_id}, {"_id": 0})
            if msg_group:
                print(f"✅ {group_name} ({group_type}) - Already has chat (ID: {message_group_id})")
                continue
            else:
                print(f"⚠️  {group_name} ({group_type}) - Has ID but chat doesn't exist, recreating...")
        else:
            groups_without_chat += 1
            print(f"❌ {group_name} ({group_type}) - No message group")
        
        # Create message group
        try:
            new_message_group_id = str(uuid4())
            
            # Get creator info (first member or owner)
            creator_id = group.get('owner_id') or (members[0] if members else None)
            creator_name = group.get('owner_name') or (member_names[0] if member_names else 'System')
            
            # Create message group document
            message_group = {
                "id": new_message_group_id,
                "name": f"{group_name} Chat",
                "members": members,
                "member_names": member_names,
                "created_by": creator_id or "system",
                "created_by_name": creator_name,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Insert message group
            await db.message_groups.insert_one(message_group)
            
            # Update co-curricular group with message_group_id
            await db.cocurricular_groups.update_one(
                {"id": group_id},
                {"$set": {"message_group_id": new_message_group_id}}
            )
            
            # Send welcome message
            welcome_message = {
                "id": str(uuid4()),
                "sender_id": "system",
                "sender_name": "Quadley System",
                "receiver_id": None,
                "group_id": new_message_group_id,
                "conversation_id": None,
                "content": f"🎉 Welcome to {group_name}! This is your team chat. All {len(members)} members have been added.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "read": False,
                "read_by": [],
                "file_url": None
            }
            
            await db.messages.insert_one(welcome_message)
            
            groups_updated += 1
            print(f"   ✅ Created message group: {new_message_group_id}")
            print(f"   ✅ Added {len(members)} members to chat")
            print("   ✅ Sent welcome message\n")
            
        except Exception as e:
            errors += 1
            print(f"   ❌ ERROR: {str(e)}\n")
    
    print("\n" + "="*60)
    print("📈 MIGRATION SUMMARY")
    print("="*60)
    print(f"Total co-curricular groups: {total_groups}")
    print(f"Groups without chat: {groups_without_chat}")
    print(f"Groups updated: {groups_updated}")
    print(f"Errors: {errors}")
    print("="*60)
    
    if groups_updated > 0:
        print(f"\n✅ Successfully added message groups to {groups_updated} co-curricular groups!")
    else:
        print("\n✅ All co-curricular groups already have message groups!")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    print("🚀 Starting Message Groups Migration\n")
    asyncio.run(migrate_message_groups())
    print("\n✅ Migration complete!")
