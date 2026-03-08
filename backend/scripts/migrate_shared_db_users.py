"""
Migration Script: Move Users from Shared DB to Tenant DBs
=========================================================
This script migrates users that were incorrectly stored in the shared database
to their correct tenant-specific databases based on their inviter's tenant.

Usage:
    python scripts/migrate_shared_db_users.py --dry-run  # Preview changes
    python scripts/migrate_shared_db_users.py --execute  # Execute migration
"""
import asyncio
import argparse
import logging
from datetime import datetime, timezone
import uuid
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def find_inviter_tenant(client, inviter_id: str) -> tuple:
    """Find which tenant an inviter belongs to."""
    dbs = await client.list_database_names()
    tenant_dbs = [d for d in dbs if d.startswith('quadley_tenant_')]
    
    for db_name in tenant_dbs:
        tenant_db = client[db_name]
        user = await tenant_db.users.find_one({"id": inviter_id})
        if user:
            # Extract tenant code from DB name (quadley_tenant_murp1021 -> MURP1021)
            tenant_code = db_name.replace('quadley_tenant_', '').upper()
            return db_name, tenant_code, user.get('email')
    
    return None, None, None


async def generate_user_id(tenant_code: str, role: str) -> str:
    """Generate a formatted user_id."""
    role_prefix = {
        'student': 'STU',
        'ra': 'RA',
        'admin': 'ADMIN',
        'super_admin': 'SADMIN',
        'college_admin': 'CADMIN'
    }
    prefix = role_prefix.get(role, 'USR')
    return f"{tenant_code}-{prefix}-{uuid.uuid4().hex[:8].upper()}"


async def migrate_users(dry_run: bool = True):
    """Main migration function."""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    
    # Shared database where users are incorrectly stored
    shared_db = client[os.environ.get('DB_NAME', 'residential_college_db')]
    
    # Get all users from shared DB
    cursor = shared_db.users.find({})
    users = await cursor.to_list(1000)
    
    logger.info(f"Found {len(users)} users in shared database")
    
    # Track migration stats
    stats = {
        'total': len(users),
        'migrated': 0,
        'skipped_no_inviter': 0,
        'skipped_inviter_not_found': 0,
        'skipped_already_exists': 0,
        'errors': 0
    }
    
    # Group users by their target tenant
    migration_plan = {}
    
    for user in users:
        email = user.get('email')
        inviter_id = user.get('invited_by')
        
        if not inviter_id:
            logger.info(f"  SKIP: {email} - No inviter_id (possibly self-registered)")
            stats['skipped_no_inviter'] += 1
            continue
        
        # Find which tenant the inviter belongs to
        tenant_db_name, tenant_code, inviter_email = await find_inviter_tenant(client, inviter_id)
        
        if not tenant_db_name:
            logger.warning(f"  SKIP: {email} - Inviter {inviter_id} not found in any tenant")
            stats['skipped_inviter_not_found'] += 1
            continue
        
        # Check if user already exists in target tenant DB
        tenant_db = client[tenant_db_name]
        existing = await tenant_db.users.find_one({"email": email.lower()})
        if existing:
            logger.info(f"  SKIP: {email} - Already exists in {tenant_db_name}")
            stats['skipped_already_exists'] += 1
            continue
        
        # Add to migration plan
        if tenant_db_name not in migration_plan:
            migration_plan[tenant_db_name] = {
                'tenant_code': tenant_code,
                'users': []
            }
        migration_plan[tenant_db_name]['users'].append(user)
    
    # Print migration plan
    logger.info("\n" + "="*60)
    logger.info("MIGRATION PLAN")
    logger.info("="*60)
    
    for db_name, plan in migration_plan.items():
        logger.info(f"\n{db_name} ({plan['tenant_code']}):")
        for user in plan['users']:
            logger.info(f"  - {user.get('email')} ({user.get('role')})")
    
    if dry_run:
        logger.info("\n" + "="*60)
        logger.info("DRY RUN - No changes made")
        logger.info("Run with --execute to perform migration")
        logger.info("="*60)
        return stats
    
    # Execute migration
    logger.info("\n" + "="*60)
    logger.info("EXECUTING MIGRATION")
    logger.info("="*60)
    
    for db_name, plan in migration_plan.items():
        tenant_db = client[db_name]
        tenant_code = plan['tenant_code']
        
        for user in plan['users']:
            try:
                # Prepare user document for insertion
                user_doc = {**user}
                
                # Remove MongoDB _id
                user_doc.pop('_id', None)
                
                # Add tenant_code if not present
                user_doc['tenant_code'] = tenant_code
                
                # Generate user_id if missing
                if not user_doc.get('user_id'):
                    user_doc['user_id'] = await generate_user_id(
                        tenant_code, 
                        user_doc.get('role', 'student')
                    )
                
                # Add migration metadata
                user_doc['migrated_at'] = datetime.now(timezone.utc).isoformat()
                user_doc['migrated_from'] = 'shared_db'
                
                # Insert into tenant DB
                await tenant_db.users.insert_one(user_doc)
                
                # Delete from shared DB
                await shared_db.users.delete_one({"id": user['id']})
                
                logger.info(f"  MIGRATED: {user.get('email')} -> {db_name}")
                stats['migrated'] += 1
                
            except Exception as e:
                logger.error(f"  ERROR: {user.get('email')} - {str(e)}")
                stats['errors'] += 1
    
    # Print summary
    logger.info("\n" + "="*60)
    logger.info("MIGRATION SUMMARY")
    logger.info("="*60)
    logger.info(f"Total users processed: {stats['total']}")
    logger.info(f"Successfully migrated: {stats['migrated']}")
    logger.info(f"Skipped (no inviter): {stats['skipped_no_inviter']}")
    logger.info(f"Skipped (inviter not found): {stats['skipped_inviter_not_found']}")
    logger.info(f"Skipped (already exists): {stats['skipped_already_exists']}")
    logger.info(f"Errors: {stats['errors']}")
    
    client.close()
    return stats


def main():
    parser = argparse.ArgumentParser(description='Migrate users from shared DB to tenant DBs')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run', action='store_true', help='Preview changes without executing')
    group.add_argument('--execute', action='store_true', help='Execute the migration')
    
    args = parser.parse_args()
    
    asyncio.run(migrate_users(dry_run=args.dry_run))


if __name__ == '__main__':
    main()
