#!/usr/bin/env python3
"""
Quadley Data Seeding Script
---------------------------
This script imports data from JSON files into the MongoDB database.

SECURITY WARNING (OWASP A08):
This script is for development/staging ONLY. It is blocked in production.

Usage:
  python seed_data.py [--colleges FILE] [--applications FILE] [--documents FILE] [--all-sample]

Examples:
  python seed_data.py --colleges colleges.json
  python seed_data.py --all-sample  # Generate sample data
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient
import uuid

# ============ SECURITY CHECK (OWASP A08) ============
# Block seed script execution in production environments
ENV = os.environ.get('ENV', os.environ.get('ENVIRONMENT', 'development')).lower()
BLOCKED_ENVIRONMENTS = ['production', 'prod', 'live']

if ENV in BLOCKED_ENVIRONMENTS:
    print("=" * 60)
    print("SECURITY ERROR: Seed script cannot run in production!")
    print(f"Current environment: {ENV}")
    print("This script is only allowed in development/staging.")
    print("=" * 60)
    sys.exit(1)

# Additional safety check - require explicit confirmation
if not os.environ.get('SEED_CONFIRMED'):
    print("=" * 60)
    print("WARNING: About to seed the database.")
    print(f"Environment: {ENV}")
    print("Database: " + os.environ.get('DB_NAME', 'residential_college_db'))
    print("")
    print("To proceed, set SEED_CONFIRMED=yes environment variable:")
    print("  SEED_CONFIRMED=yes python seed_data.py [options]")
    print("=" * 60)
    sys.exit(1)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'residential_college_db')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def generate_id():
    return str(uuid.uuid4())

def seed_colleges(file_path=None, data=None):
    """Seed colleges/tenants data"""
    if file_path:
        with open(file_path, 'r') as f:
            data = json.load(f)
    
    if not data:
        print("No college data provided")
        return 0
    
    count = 0
    for item in data:
        item['id'] = item.get('id', generate_id())
        item['created_at'] = datetime.now(timezone.utc).isoformat()
        
        # Upsert by id or name
        result = db.tenants.update_one(
            {'$or': [{'id': item['id']}, {'name': item.get('name')}]},
            {'$set': item},
            upsert=True
        )
        if result.upserted_id or result.modified_count:
            count += 1
    
    print(f"Seeded {count} colleges/tenants")
    return count

def seed_applications(file_path=None, data=None):
    """Seed applications data (job applications, RA applications, etc.)"""
    if file_path:
        with open(file_path, 'r') as f:
            data = json.load(f)
    
    if not data:
        print("No application data provided")
        return 0
    
    count = 0
    for item in data:
        item['id'] = item.get('id', generate_id())
        item['created_at'] = item.get('created_at', datetime.now(timezone.utc).isoformat())
        
        # Determine collection based on type
        collection = 'job_applications'
        if item.get('type') == 'ra_application':
            collection = 'ra_application_submissions'
        elif item.get('type') == 'tutor_application':
            collection = 'tutor_applications'
        
        result = db[collection].update_one(
            {'id': item['id']},
            {'$set': item},
            upsert=True
        )
        if result.upserted_id or result.modified_count:
            count += 1
    
    print(f"Seeded {count} applications")
    return count

def seed_documents(file_path=None, data=None):
    """Seed documents data"""
    if file_path:
        with open(file_path, 'r') as f:
            data = json.load(f)
    
    if not data:
        print("No document data provided")
        return 0
    
    count = 0
    for item in data:
        item['id'] = item.get('id', generate_id())
        item['created_at'] = item.get('created_at', datetime.now(timezone.utc).isoformat())
        
        result = db.documents.update_one(
            {'id': item['id']},
            {'$set': item},
            upsert=True
        )
        if result.upserted_id or result.modified_count:
            count += 1
    
    print(f"Seeded {count} documents")
    return count

def seed_sample_data():
    """Generate and seed sample data for testing"""
    print("Generating sample data...")
    
    # Sample colleges
    colleges = [
        {
            "id": "college_001",
            "name": "Griffin College",
            "code": "GRIF",
            "description": "A vibrant residential community",
            "address": "123 University Drive",
            "capacity": 500,
            "floors": ["Ground", "Level 1", "Level 2", "Level 3"],
            "features": ["Library", "Gym", "Common Room", "Music Room"]
        },
        {
            "id": "college_002", 
            "name": "Phoenix House",
            "code": "PHNX",
            "description": "Modern living spaces",
            "address": "456 Campus Road",
            "capacity": 400,
            "floors": ["Ground", "Level 1", "Level 2"],
            "features": ["Study Rooms", "Lounge", "Garden"]
        }
    ]
    
    # Sample announcements
    announcements = [
        {
            "id": generate_id(),
            "title": "Welcome to Semester 1, 2026!",
            "content": "Welcome back everyone! We're excited to kick off another great semester. Check out the events calendar for O-Week activities.",
            "priority": "high",
            "target_audience": "all",
            "created_by": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": generate_id(),
            "title": "Dining Hall Hours Update",
            "content": "The dining hall will now be open from 7am-9pm on weekdays and 8am-8pm on weekends.",
            "priority": "normal",
            "target_audience": "all",
            "created_by": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Sample events
    events = [
        {
            "id": generate_id(),
            "title": "Welcome BBQ",
            "description": "Join us for the annual welcome BBQ! Free food and great company.",
            "date": "2026-02-15T12:00:00Z",
            "location": "Quad Lawn",
            "category": "social",
            "created_by": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": generate_id(),
            "title": "Study Skills Workshop",
            "description": "Learn effective study techniques from academic advisors.",
            "date": "2026-02-20T14:00:00Z",
            "location": "Library Room 101",
            "category": "academic",
            "created_by": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Sample jobs
    jobs = [
        {
            "id": generate_id(),
            "title": "Library Assistant",
            "job_type": "internal",
            "description": "Help maintain the college library, assist students with resources.",
            "department": "Library",
            "hours_per_week": "10-15",
            "pay_rate": "$25/hour",
            "posted_by": "admin",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": generate_id(),
            "title": "Tutoring Position - Mathematics",
            "job_type": "internal",
            "description": "Tutor first-year students in calculus and linear algebra.",
            "department": "Academic Support",
            "hours_per_week": "5-10",
            "pay_rate": "$30/hour",
            "posted_by": "admin",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Sample study groups
    study_groups = [
        {
            "id": generate_id(),
            "name": "MATH101 Study Group",
            "subject": "Mathematics",
            "location": "Library Study Room 3",
            "meeting_schedule": "Tuesdays & Thursdays 6pm",
            "created_by": "sample_user",
            "members": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": generate_id(),
            "name": "Physics Problem Solving",
            "subject": "Physics",
            "location": "Science Building 201",
            "meeting_schedule": "Wednesdays 5pm",
            "created_by": "sample_user",
            "members": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Insert sample data
    seed_colleges(data=colleges)
    
    for ann in announcements:
        db.announcements.update_one({'id': ann['id']}, {'$set': ann}, upsert=True)
    print(f"Seeded {len(announcements)} announcements")
    
    for event in events:
        db.events.update_one({'id': event['id']}, {'$set': event}, upsert=True)
    print(f"Seeded {len(events)} events")
    
    for job in jobs:
        db.jobs.update_one({'id': job['id']}, {'$set': job}, upsert=True)
    print(f"Seeded {len(jobs)} jobs")
    
    for sg in study_groups:
        db.study_groups.update_one({'id': sg['id']}, {'$set': sg}, upsert=True)
    print(f"Seeded {len(study_groups)} study groups")
    
    print("\nSample data seeding complete!")

def main():
    parser = argparse.ArgumentParser(description='Seed data into Quadley database')
    parser.add_argument('--colleges', help='Path to colleges JSON file')
    parser.add_argument('--applications', help='Path to applications JSON file')
    parser.add_argument('--documents', help='Path to documents JSON file')
    parser.add_argument('--all-sample', action='store_true', help='Generate and seed sample data')
    
    args = parser.parse_args()
    
    if args.all_sample:
        seed_sample_data()
        return
    
    if not any([args.colleges, args.applications, args.documents]):
        parser.print_help()
        print("\nNo files specified. Use --all-sample to generate sample data.")
        return
    
    if args.colleges:
        seed_colleges(args.colleges)
    
    if args.applications:
        seed_applications(args.applications)
    
    if args.documents:
        seed_documents(args.documents)
    
    print("\nData seeding complete!")

if __name__ == '__main__':
    main()
