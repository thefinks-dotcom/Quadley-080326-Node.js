# MongoDB Atlas Multi-Tenant User Setup Guide

This guide explains how to configure MongoDB Atlas with database-level access control for the Quadley multi-tenant architecture.

## Overview

Each tenant in Quadley has their own isolated database (`quadley_tenant_{code}`). For maximum security, you can create separate MongoDB Atlas database users for each tenant, where each user can only access their specific tenant database.

## Prerequisites

1. MongoDB Atlas account with an M10+ cluster (required for advanced security features)
2. Atlas Admin API key with Project Owner permissions
3. Network access configured (IP whitelist or VPC peering)

## Step 1: Create Atlas Admin API Key

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Go to **Organization Settings** > **Access Manager** > **API Keys**
3. Click **Create API Key**
4. Set permissions: **Organization Owner** or **Project Owner**
5. Save the **Public Key** and **Private Key**

```bash
# Store these securely
ATLAS_PUBLIC_KEY="your_public_key"
ATLAS_PRIVATE_KEY="your_private_key"
ATLAS_PROJECT_ID="your_project_id"
```

## Step 2: Get Your Project ID

1. In Atlas, click on your project name
2. Go to **Project Settings**
3. Copy the **Project ID** (shown in URL or settings)

## Step 3: API Endpoints for User Management

### Create Database User for a Tenant

```bash
# Create a user with access to only one tenant database
curl -X POST \
  "https://cloud.mongodb.com/api/atlas/v1.0/groups/${ATLAS_PROJECT_ID}/databaseUsers" \
  -u "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" \
  --digest \
  -H "Content-Type: application/json" \
  -d '{
    "databaseName": "admin",
    "groupId": "'${ATLAS_PROJECT_ID}'",
    "roles": [
      {
        "databaseName": "quadley_tenant_ormd0001",
        "roleName": "readWrite"
      }
    ],
    "username": "tenant_ormd0001",
    "password": "SecurePassword123!"
  }'
```

### List Database Users

```bash
curl -X GET \
  "https://cloud.mongodb.com/api/atlas/v1.0/groups/${ATLAS_PROJECT_ID}/databaseUsers" \
  -u "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" \
  --digest
```

### Delete Database User

```bash
curl -X DELETE \
  "https://cloud.mongodb.com/api/atlas/v1.0/groups/${ATLAS_PROJECT_ID}/databaseUsers/admin/tenant_ormd0001" \
  -u "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" \
  --digest
```

## Step 4: Connection String per Tenant

Each tenant would connect using their specific credentials:

```
mongodb+srv://tenant_ormd0001:SecurePassword123!@cluster0.xxxxx.mongodb.net/quadley_tenant_ormd0001
```

## Step 5: Subscription Tiers & User Limits

The system supports three subscription tiers:

| Tier | Max Users | Available Modules | Price |
|------|-----------|-------------------|-------|
| Basic | 100 | 8 core modules | $99/month |
| Pro | 500 | All modules | $299/month |
| Enterprise | Unlimited | All modules + API access | Custom |

### Basic Tier Modules
- Events
- Announcements
- Messages
- Dining
- Maintenance
- Floor
- Birthdays
- Recognition

### Pro Tier Adds
- Jobs
- Academics
- Co-Curricular
- Wellbeing
- Finance
- Safe Disclosure
- Parcels
- Bookings

## Step 6: Implementing in Backend

To automatically create Atlas users when a tenant is created, add the following to your backend:

### Environment Variables

```bash
# Add to backend/.env
ATLAS_PUBLIC_KEY=your_public_key
ATLAS_PRIVATE_KEY=your_private_key
ATLAS_PROJECT_ID=your_project_id
ATLAS_CLUSTER_NAME=Cluster0
```

### Atlas User Management Service

Create `backend/utils/atlas_user_manager.py`:

```python
import os
import requests
from requests.auth import HTTPDigestAuth
import secrets
import string

ATLAS_PUBLIC_KEY = os.environ.get('ATLAS_PUBLIC_KEY')
ATLAS_PRIVATE_KEY = os.environ.get('ATLAS_PRIVATE_KEY')
ATLAS_PROJECT_ID = os.environ.get('ATLAS_PROJECT_ID')
ATLAS_BASE_URL = "https://cloud.mongodb.com/api/atlas/v1.0"

def generate_password(length=24):
    """Generate a secure random password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

async def create_tenant_db_user(tenant_code: str) -> dict:
    """Create a MongoDB Atlas user for a specific tenant"""
    if not all([ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_PROJECT_ID]):
        return {"error": "Atlas API credentials not configured"}
    
    username = f"tenant_{tenant_code.lower()}"
    password = generate_password()
    database = f"quadley_tenant_{tenant_code.lower()}"
    
    payload = {
        "databaseName": "admin",
        "groupId": ATLAS_PROJECT_ID,
        "roles": [
            {
                "databaseName": database,
                "roleName": "readWrite"
            }
        ],
        "username": username,
        "password": password
    }
    
    response = requests.post(
        f"{ATLAS_BASE_URL}/groups/{ATLAS_PROJECT_ID}/databaseUsers",
        auth=HTTPDigestAuth(ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY),
        json=payload
    )
    
    if response.status_code in [200, 201]:
        return {
            "success": True,
            "username": username,
            "password": password,
            "database": database
        }
    else:
        return {
            "success": False,
            "error": response.text
        }

async def delete_tenant_db_user(tenant_code: str) -> bool:
    """Delete a tenant's MongoDB Atlas user"""
    username = f"tenant_{tenant_code.lower()}"
    
    response = requests.delete(
        f"{ATLAS_BASE_URL}/groups/{ATLAS_PROJECT_ID}/databaseUsers/admin/{username}",
        auth=HTTPDigestAuth(ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY)
    )
    
    return response.status_code in [200, 202, 204]
```

## Security Considerations

1. **Credential Storage**: Store tenant-specific credentials securely (e.g., AWS Secrets Manager, HashiCorp Vault)
2. **Password Rotation**: Implement regular password rotation for database users
3. **Audit Logging**: Enable Atlas audit logging for compliance
4. **Network Security**: Use VPC peering or private endpoints in production
5. **Encryption**: Ensure encryption at rest and in transit are enabled

## Monitoring

1. Enable Atlas alerts for:
   - Connection spikes per tenant
   - Query performance degradation
   - Storage utilization
2. Use Atlas Data Explorer to monitor per-database metrics

## Troubleshooting

### Common Issues

1. **Authentication Failed**: Check username/password, ensure user exists
2. **Access Denied**: Verify roles are correctly assigned to the tenant database
3. **Connection Timeout**: Check IP whitelist and network connectivity

### Verify User Permissions

```bash
# Connect as the tenant user and verify access
mongosh "mongodb+srv://cluster0.xxxxx.mongodb.net/quadley_tenant_ormd0001" \
  --username tenant_ormd0001 \
  --password "your_password"

# Try accessing own database (should work)
use quadley_tenant_ormd0001
db.users.find().limit(1)

# Try accessing another tenant (should fail)
use quadley_tenant_trin0002
db.users.find().limit(1)
# Expected: Error - not authorized
```

## Next Steps

1. Implement automated user creation in tenant creation workflow
2. Set up credential rotation schedule
3. Configure monitoring and alerts
4. Document disaster recovery procedures
