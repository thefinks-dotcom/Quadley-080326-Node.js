#!/usr/bin/env python3
"""
Quadley Comprehensive Test Data Seeder
======================================

This script creates a complete test environment with realistic data for all features.
It's idempotent - running multiple times won't create duplicates.

SECURITY WARNING (OWASP A08):
This script is for development/staging ONLY. It is blocked in production.

Usage:
  SEED_CONFIRMED=yes python seed_test_data.py [--clean] [--users-only] [--minimal]

Options:
  --clean       Clear existing test data before seeding
  --users-only  Only seed user accounts (no content)
  --minimal     Seed minimal data (fewer records)

Examples:
  SEED_CONFIRMED=yes python seed_test_data.py
  SEED_CONFIRMED=yes python seed_test_data.py --clean
"""

import os
import sys
import argparse
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import uuid
import random

# ============ SECURITY CHECK (OWASP A08) ============
ENV = os.environ.get('ENV', os.environ.get('ENVIRONMENT', 'development')).lower()
BLOCKED_ENVIRONMENTS = ['production', 'prod', 'live']

if ENV in BLOCKED_ENVIRONMENTS:
    print("=" * 60)
    print("SECURITY ERROR: Seed script cannot run in production!")
    print(f"Current environment: {ENV}")
    print("=" * 60)
    sys.exit(1)

if not os.environ.get('SEED_CONFIRMED'):
    print("=" * 60)
    print("WARNING: About to seed the database.")
    print(f"Environment: {ENV}")
    print("")
    print("To proceed: SEED_CONFIRMED=yes python seed_test_data.py")
    print("=" * 60)
    sys.exit(1)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'residential_college_db')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# ============ HELPER FUNCTIONS ============

def generate_id():
    """Generate a unique ID"""
    return str(uuid.uuid4())

def hash_password(password: str) -> str:
    """Hash password using bcrypt (matches server implementation)"""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.hash(password)

def random_date(days_back=30, days_forward=30):
    """Generate a random date within range"""
    base = datetime.now(timezone.utc)
    offset = random.randint(-days_back, days_forward)
    return (base + timedelta(days=offset)).isoformat()

def future_date(min_days=1, max_days=60):
    """Generate a future date"""
    base = datetime.now(timezone.utc)
    offset = random.randint(min_days, max_days)
    return (base + timedelta(days=offset)).isoformat()

def past_date(min_days=1, max_days=60):
    """Generate a past date"""
    base = datetime.now(timezone.utc)
    offset = random.randint(min_days, max_days)
    return (base - timedelta(days=offset)).isoformat()

def upsert_by_email(collection, data):
    """Upsert a document by email"""
    result = db[collection].update_one(
        {'email': data['email']},
        {'$set': data},
        upsert=True
    )
    return result.upserted_id is not None or result.modified_count > 0

def upsert_by_id(collection, data):
    """Upsert a document by id"""
    result = db[collection].update_one(
        {'id': data['id']},
        {'$set': data},
        upsert=True
    )
    return result.upserted_id is not None or result.modified_count > 0

# ============ DATA GENERATORS ============

# Tenant/College data
TENANTS = [
    {
        'tenant_id': 'quadley_main',
        'tenant_name': 'Quadley Residential College',
        'domain': 'quadley.app',
        'contact_email': 'admin@quadley.app',
        'capacity': 500,
        'status': 'active',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
]

# Floor data
FLOORS = [
    'Ground Floor - Wing A',
    'Ground Floor - Wing B', 
    'Level 1 - Wing A',
    'Level 1 - Wing B',
    'Level 2 - Wing A',
    'Level 2 - Wing B',
    'Level 3 - Wing A',
    'Level 3 - Wing B',
]

# Test Users - consistent IDs for testing
USERS = [
    # Super Admin
    {
        'id': 'user_super_admin_001',
        'email': 'gen@quadley.app',
        'password': 'Quadley2025!',
        'first_name': 'Genesis',
        'last_name': 'Admin',
        'role': 'super_admin',
        'floor': None,
        'active': True,
        'onboarding_completed': True,
    },
    # Admin
    {
        'id': 'user_admin_001',
        'email': 'admin@quadley.app',
        'password': 'Admin123!',
        'first_name': 'College',
        'last_name': 'Admin',
        'role': 'admin',
        'floor': None,
        'active': True,
        'onboarding_completed': True,
    },
    # RAs (one per floor)
    {
        'id': 'user_ra_001',
        'email': 'epink@icloud.com',
        'password': 'AbC!123!AbC!123!',
        'first_name': 'Emily',
        'last_name': 'Pink',
        'role': 'ra',
        'floor': 'Level 1 - Wing A',
        'active': True,
        'onboarding_completed': True,
    },
    {
        'id': 'user_ra_002',
        'email': 'ra.james@quadley.app',
        'password': 'RaPass123!',
        'first_name': 'James',
        'last_name': 'Wilson',
        'role': 'ra',
        'floor': 'Level 2 - Wing A',
        'active': True,
        'onboarding_completed': True,
    },
    # Students
    {
        'id': 'user_student_001',
        'email': 'alice@example.com',
        'password': 'Quadley2025!',
        'first_name': 'Alice',
        'last_name': 'Johnson',
        'role': 'student',
        'floor': 'Level 1 - Wing A',
        'room': 'Room 105',
        'year': 'Second Year',
        'major': 'Computer Science',
        'active': True,
        'onboarding_completed': True,
    },
    {
        'id': 'user_student_002',
        'email': 'bob@example.com',
        'password': 'Student123!',
        'first_name': 'Bob',
        'last_name': 'Smith',
        'role': 'student',
        'floor': 'Level 1 - Wing A',
        'room': 'Room 107',
        'year': 'First Year',
        'major': 'Engineering',
        'active': True,
        'onboarding_completed': True,
    },
    {
        'id': 'user_student_003',
        'email': 'carol@example.com',
        'password': 'Student123!',
        'first_name': 'Carol',
        'last_name': 'Davis',
        'role': 'student',
        'floor': 'Level 2 - Wing A',
        'room': 'Room 203',
        'year': 'Third Year',
        'major': 'Psychology',
        'active': True,
        'onboarding_completed': True,
    },
    {
        'id': 'user_student_004',
        'email': 'david@example.com',
        'password': 'Student123!',
        'first_name': 'David',
        'last_name': 'Lee',
        'role': 'student',
        'floor': 'Ground Floor - Wing A',
        'room': 'Room G02',
        'year': 'First Year',
        'major': 'Business',
        'active': True,
        'onboarding_completed': True,
    },
    {
        'id': 'user_student_005',
        'email': 'emma@example.com',
        'password': 'Student123!',
        'first_name': 'Emma',
        'last_name': 'Williams',
        'role': 'student',
        'floor': 'Level 3 - Wing A',
        'room': 'Room 301',
        'year': 'Second Year',
        'major': 'Medicine',
        'active': True,
        'onboarding_completed': True,
    },
]

def seed_users(minimal=False):
    """Seed user accounts"""
    print("\n📝 Seeding users...")
    count = 0
    users_to_seed = USERS[:5] if minimal else USERS
    
    for user_data in users_to_seed:
        user = {
            **user_data,
            'password': hash_password(user_data['password']),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'tenant_id': 'quadley_main',
        }
        if upsert_by_email('users', user):
            count += 1
            
    print(f"   ✅ Seeded {count} users")
    return count

def seed_tenants():
    """Seed tenant/college data"""
    print("\n🏛️ Seeding tenants...")
    count = 0
    for tenant in TENANTS:
        tenant['id'] = generate_id()
        if upsert_by_id('tenants', tenant):
            count += 1
    print(f"   ✅ Seeded {count} tenants")
    return count

def seed_announcements(minimal=False):
    """Seed announcements"""
    print("\n📢 Seeding announcements...")
    
    announcements = [
        {
            'id': generate_id(),
            'title': 'Welcome to Semester 1, 2026!',
            'content': 'Welcome back to Quadley Residential College! We have an exciting semester planned with new events, activities, and improvements to our facilities. Check out the events calendar for all upcoming activities.',
            'priority': 'high',
            'is_emergency': False,
            'target_audience': 'all',
            'author_name': 'College Admin',
            'created_by': 'user_admin_001',
            'created_at': past_date(1, 3),
        },
        {
            'id': generate_id(),
            'title': 'Dining Hall Hours Extended',
            'content': 'Great news! Starting this week, the dining hall will be open until 9pm on weekdays. Breakfast hours remain 7am-10am.',
            'priority': 'normal',
            'is_emergency': False,
            'target_audience': 'all',
            'author_name': 'College Admin',
            'created_by': 'user_admin_001',
            'created_at': past_date(1, 2),
        },
        {
            'id': generate_id(),
            'title': 'Fire Drill Scheduled',
            'content': 'A mandatory fire drill will be conducted on Friday at 2pm. Please familiarize yourself with the evacuation routes on your floor.',
            'priority': 'high',
            'is_emergency': False,
            'target_audience': 'all',
            'author_name': 'Safety Officer',
            'created_by': 'user_admin_001',
            'created_at': past_date(0, 1),
        },
        {
            'id': generate_id(),
            'title': 'WiFi Maintenance Tonight',
            'content': 'The campus WiFi will be undergoing maintenance tonight from 2am-4am. Please plan accordingly.',
            'priority': 'normal',
            'is_emergency': False,
            'target_audience': 'all',
            'author_name': 'IT Department',
            'created_by': 'user_admin_001',
            'created_at': datetime.now(timezone.utc).isoformat(),
        },
    ]
    
    if minimal:
        announcements = announcements[:2]
    
    count = 0
    for ann in announcements:
        if upsert_by_id('announcements', ann):
            count += 1
    print(f"   ✅ Seeded {count} announcements")
    return count

def seed_events(minimal=False):
    """Seed events"""
    print("\n📅 Seeding events...")
    
    events = [
        {
            'id': generate_id(),
            'title': 'Welcome BBQ',
            'description': 'Join us for the annual welcome BBQ! Free food, music, and games. Meet your fellow residents and make new friends.',
            'date': future_date(3, 7),
            'start_time': future_date(3, 7),
            'end_time': future_date(3, 7),
            'location': 'Quad Lawn',
            'category': 'social',
            'capacity': 200,
            'rsvp_count': 45,
            'created_by': 'user_admin_001',
            'created_at': past_date(5, 10),
        },
        {
            'id': generate_id(),
            'title': 'Study Skills Workshop',
            'description': 'Learn effective study techniques from our academic advisors. Topics include time management, note-taking, and exam preparation.',
            'date': future_date(7, 14),
            'start_time': future_date(7, 14),
            'end_time': future_date(7, 14),
            'location': 'Library Room 101',
            'category': 'academic',
            'capacity': 30,
            'rsvp_count': 18,
            'created_by': 'user_admin_001',
            'created_at': past_date(3, 5),
        },
        {
            'id': generate_id(),
            'title': 'Movie Night: Classic Films',
            'description': 'Join us for a screening of classic films in the common room. Popcorn and drinks provided!',
            'date': future_date(1, 3),
            'start_time': future_date(1, 3),
            'end_time': future_date(1, 3),
            'location': 'Common Room',
            'category': 'entertainment',
            'capacity': 50,
            'rsvp_count': 32,
            'created_by': 'user_ra_001',
            'created_at': past_date(1, 2),
        },
        {
            'id': generate_id(),
            'title': 'Yoga & Meditation',
            'description': 'Weekly yoga and meditation session. All levels welcome. Mats provided.',
            'date': future_date(2, 5),
            'start_time': future_date(2, 5),
            'end_time': future_date(2, 5),
            'location': 'Wellness Center',
            'category': 'wellness',
            'capacity': 20,
            'rsvp_count': 12,
            'created_by': 'user_ra_002',
            'created_at': past_date(1, 2),
        },
        {
            'id': generate_id(),
            'title': 'Career Fair',
            'description': 'Meet employers and learn about internship and job opportunities. Bring your resume!',
            'date': future_date(14, 21),
            'start_time': future_date(14, 21),
            'end_time': future_date(14, 21),
            'location': 'Great Hall',
            'category': 'career',
            'capacity': 500,
            'rsvp_count': 150,
            'created_by': 'user_admin_001',
            'created_at': past_date(7, 10),
        },
    ]
    
    if minimal:
        events = events[:2]
    
    count = 0
    for event in events:
        if upsert_by_id('events', event):
            count += 1
    print(f"   ✅ Seeded {count} events")
    return count

def seed_jobs(minimal=False):
    """Seed job postings"""
    print("\n💼 Seeding jobs...")
    
    jobs = [
        {
            'id': 'job_001',
            'title': 'Library Assistant',
            'description': 'Help maintain the college library, assist students with finding resources, and manage book returns.',
            'category': 'Academic',
            'department': 'Library',
            'hours_per_week': 12,
            'pay_rate': '$25/hour',
            'required_skills': ['Organization', 'Customer Service'],
            'responsibilities': 'Shelving books, helping students find resources, managing returns',
            'status': 'active',
            'created_by': 'user_admin_001',
            'created_by_name': 'Admin User',
            'positions_available': 2,
            'created_at': past_date(10, 20),
            'applications_count': 0,
        },
        {
            'id': 'job_002',
            'title': 'Math Tutor',
            'description': 'Tutor first and second year students in calculus and linear algebra.',
            'category': 'Academic',
            'department': 'Academic Support',
            'hours_per_week': 8,
            'pay_rate': '$30/hour',
            'required_skills': ['Mathematics', 'Teaching', 'Patience'],
            'responsibilities': 'One-on-one tutoring, group sessions, exam prep assistance',
            'status': 'active',
            'created_by': 'user_admin_001',
            'created_by_name': 'Admin User',
            'positions_available': 3,
            'created_at': past_date(5, 15),
            'applications_count': 0,
        },
        {
            'id': 'job_003',
            'title': 'Dining Hall Assistant',
            'description': 'Assist with meal service, cleaning, and food preparation in the dining hall.',
            'category': 'Food Service',
            'department': 'Dining Services',
            'hours_per_week': 10,
            'pay_rate': '$22/hour',
            'required_skills': ['Food Safety', 'Teamwork'],
            'responsibilities': 'Serving food, cleaning tables, restocking stations',
            'status': 'active',
            'created_by': 'user_admin_001',
            'created_by_name': 'Admin User',
            'positions_available': 5,
            'created_at': past_date(3, 10),
            'applications_count': 0,
        },
        {
            'id': 'job_004',
            'title': 'Event Assistant',
            'description': 'Help organize and run college events. Responsibilities include setup, registration, and cleanup.',
            'category': 'Student Life',
            'department': 'Student Activities',
            'hours_per_week': 6,
            'pay_rate': '$24/hour',
            'required_skills': ['Organization', 'Communication', 'Flexibility'],
            'responsibilities': 'Event setup, attendee registration, breakdown and cleanup',
            'status': 'active',
            'created_by': 'user_admin_001',
            'created_by_name': 'Admin User',
            'positions_available': 4,
            'created_at': past_date(1, 5),
            'applications_count': 0,
        },
    ]
    
    if minimal:
        jobs = jobs[:2]
    
    count = 0
    for job in jobs:
        if upsert_by_id('jobs', job):
            count += 1
    print(f"   ✅ Seeded {count} jobs")
    return count

def seed_job_applications(minimal=False):
    """Seed job applications - 4 test applications with 2 from the same person"""
    print("\n📝 Seeding job applications...")
    
    # Get job IDs from the database
    jobs = list(db.jobs.find({}, {'id': 1, 'title': 1}))
    if not jobs:
        print("   ⚠️ No jobs found - skipping job applications")
        return 0
    
    # Get student IDs
    students = list(db.users.find({'role': 'student'}, {'id': 1, 'first_name': 1, 'last_name': 1, 'email': 1}))
    if len(students) < 3:
        print("   ⚠️ Not enough students found - skipping job applications")
        return 0
    
    applications = [
        # Application 1: First student applying for first job
        {
            'id': generate_id(),
            'job_id': jobs[0]['id'],
            'job_title': jobs[0].get('title', 'Unknown Job'),
            'applicant_id': students[0]['id'],
            'applicant_name': f"{students[0].get('first_name', '')} {students[0].get('last_name', '')}",
            'applicant_email': students[0].get('email', ''),
            'why_interested': 'I am passionate about helping others and have always loved libraries. I believe this position would be perfect for developing my organizational skills.',
            'availability': 'Monday, Wednesday, Friday afternoons; Full weekends',
            'experience': 'Volunteered at local public library during high school for 2 years.',
            'references': [{'name': 'Ms. Jane Smith', 'relationship': 'High School Librarian', 'contact': 'jane.smith@school.edu'}],
            'status': 'pending',
            'created_at': past_date(1, 3),
        },
        # Application 2: Same first student applying for second job (different position)
        {
            'id': generate_id(),
            'job_id': jobs[1]['id'] if len(jobs) > 1 else jobs[0]['id'],
            'job_title': jobs[1].get('title', 'Unknown Job') if len(jobs) > 1 else jobs[0].get('title', 'Unknown Job'),
            'applicant_id': students[0]['id'],
            'applicant_name': f"{students[0].get('first_name', '')} {students[0].get('last_name', '')}",
            'applicant_email': students[0].get('email', ''),
            'why_interested': 'I have strong math skills and enjoy helping other students understand complex concepts.',
            'availability': 'Tuesdays and Thursdays all day; Saturday mornings',
            'experience': 'Peer tutor in high school, helping students with algebra and pre-calculus.',
            'references': [{'name': 'Mr. John Doe', 'relationship': 'Math Teacher', 'contact': 'john.doe@school.edu'}],
            'status': 'reviewing',
            'created_at': past_date(2, 5),
        },
        # Application 3: Second student
        {
            'id': generate_id(),
            'job_id': jobs[2]['id'] if len(jobs) > 2 else jobs[0]['id'],
            'job_title': jobs[2].get('title', 'Unknown Job') if len(jobs) > 2 else jobs[0].get('title', 'Unknown Job'),
            'applicant_id': students[1]['id'],
            'applicant_name': f"{students[1].get('first_name', '')} {students[1].get('last_name', '')}",
            'applicant_email': students[1].get('email', ''),
            'why_interested': 'I enjoy working in food service and meeting new people. This would be a great opportunity.',
            'availability': 'Weekends and any weekday evening',
            'experience': 'Worked part-time at a local cafe for 6 months.',
            'references': [{'name': 'Ms. Sarah Johnson', 'relationship': 'Cafe Manager', 'contact': 'sarah@localcafe.com'}],
            'status': 'interview',
            'created_at': past_date(5, 10),
        },
        # Application 4: Third student
        {
            'id': generate_id(),
            'job_id': jobs[3]['id'] if len(jobs) > 3 else jobs[0]['id'],
            'job_title': jobs[3].get('title', 'Unknown Job') if len(jobs) > 3 else jobs[0].get('title', 'Unknown Job'),
            'applicant_id': students[2]['id'],
            'applicant_name': f"{students[2].get('first_name', '')} {students[2].get('last_name', '')}",
            'applicant_email': students[2].get('email', ''),
            'why_interested': 'Event planning is my passion! I organized multiple events in high school and loved every minute.',
            'availability': 'Flexible - can work around class schedule',
            'experience': 'Student council event coordinator for 2 years.',
            'references': [{'name': 'Principal Mr. Williams', 'relationship': 'High School Principal', 'contact': 'williams@school.edu'}],
            'status': 'accepted',
            'created_at': past_date(10, 15),
        },
    ]
    
    if minimal:
        applications = applications[:2]
    
    count = 0
    for app in applications:
        if upsert_by_id('job_applications', app):
            count += 1
    print(f"   ✅ Seeded {count} job applications")
    return count

def seed_maintenance_requests(minimal=False):
    """Seed maintenance/service requests"""
    print("\n🔧 Seeding maintenance requests...")
    
    requests = [
        {
            'id': generate_id(),
            'title': 'Broken light fixture',
            'description': 'The light fixture in my room is flickering and making a buzzing sound.',
            'category': 'electrical',
            'priority': 'medium',
            'status': 'pending',
            'room': 'Room 105',
            'floor': 'Level 1 - Wing A',
            'submitted_by': 'user_student_001',
            'created_at': past_date(2, 5),
        },
        {
            'id': generate_id(),
            'title': 'Clogged sink',
            'description': 'The bathroom sink is draining very slowly.',
            'category': 'plumbing',
            'priority': 'high',
            'status': 'in_progress',
            'room': 'Room 203',
            'floor': 'Level 2 - Wing A',
            'submitted_by': 'user_student_003',
            'assigned_to': 'Maintenance Team',
            'created_at': past_date(1, 3),
        },
        {
            'id': generate_id(),
            'title': 'AC not cooling',
            'description': 'The air conditioning unit is running but not producing cold air.',
            'category': 'hvac',
            'priority': 'medium',
            'status': 'completed',
            'room': 'Room G02',
            'floor': 'Ground Floor - Wing A',
            'submitted_by': 'user_student_004',
            'resolution': 'Filter cleaned and refrigerant topped up.',
            'created_at': past_date(5, 10),
            'resolved_at': past_date(3, 4),
        },
    ]
    
    if minimal:
        requests = requests[:1]
    
    count = 0
    for req in requests:
        if upsert_by_id('maintenance_requests', req):
            count += 1
    print(f"   ✅ Seeded {count} maintenance requests")
    return count

def seed_shoutouts(minimal=False):
    """Seed shoutouts/recognition"""
    print("\n⭐ Seeding shoutouts...")
    
    shoutouts = [
        {
            'id': generate_id(),
            'from_user_id': 'user_student_001',
            'from_user_name': 'Alice Johnson',
            'to_user_id': 'user_student_002',
            'to_user_name': 'Bob Smith',
            'recipient_name': 'Bob Smith',
            'message': 'Thanks for helping me with my calculus homework! You explained it so clearly.',
            'category': 'academic',
            'likes': 5,
            'created_at': past_date(1, 5),
        },
        {
            'id': generate_id(),
            'from_user_id': 'user_student_003',
            'from_user_name': 'Carol Davis',
            'to_user_id': 'user_ra_001',
            'to_user_name': 'Emily Pink',
            'recipient_name': 'Emily Pink',
            'message': 'Best RA ever! Always there when we need help and organizes amazing floor events.',
            'category': 'community',
            'likes': 12,
            'created_at': past_date(3, 7),
        },
        {
            'id': generate_id(),
            'from_user_id': 'user_ra_001',
            'from_user_name': 'Emily Pink',
            'to_user_id': 'user_student_005',
            'to_user_name': 'Emma Williams',
            'recipient_name': 'Emma Williams',
            'message': 'Thank you for volunteering at the welcome event! Your energy was contagious.',
            'category': 'volunteer',
            'likes': 8,
            'created_at': past_date(0, 2),
        },
    ]
    
    if minimal:
        shoutouts = shoutouts[:1]
    
    count = 0
    for shoutout in shoutouts:
        if upsert_by_id('shoutouts', shoutout):
            count += 1
    print(f"   ✅ Seeded {count} shoutouts")
    return count

def seed_dining_menu():
    """Seed dining menu"""
    print("\n🍽️ Seeding dining menu...")
    
    # Today's menu
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    menu = {
        'id': f'menu_{today}',
        'date': today,
        'breakfast': {
            'items': ['Scrambled eggs', 'Toast & butter', 'Fresh fruit', 'Yogurt', 'Coffee/Tea'],
            'special': 'Belgian waffles with maple syrup',
            'hours': '7:00am - 10:00am'
        },
        'lunch': {
            'items': ['Grilled chicken salad', 'Vegetable stir-fry', 'Pasta marinara', 'Soup of the day'],
            'special': 'Teriyaki salmon bowl',
            'hours': '11:30am - 2:00pm'
        },
        'dinner': {
            'items': ['Roast beef with gravy', 'Vegetarian lasagna', 'Steamed vegetables', 'Dinner rolls'],
            'special': 'Surf & turf night',
            'hours': '5:30pm - 8:00pm'
        },
        'dietary_options': ['Vegetarian', 'Vegan', 'Gluten-free', 'Halal'],
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    
    if upsert_by_id('dining_menus', menu):
        print("   ✅ Seeded today's dining menu")
        return 1
    return 0

def seed_study_groups(minimal=False):
    """Seed study groups"""
    print("\n📚 Seeding study groups...")
    
    groups = [
        {
            'id': generate_id(),
            'name': 'MATH101 Study Group',
            'subject': 'Mathematics',
            'description': 'Weekly study sessions for Calculus I. We work through problem sets together.',
            'location': 'Library Study Room 3',
            'meeting_schedule': 'Tuesdays & Thursdays 6pm',
            'max_members': 8,
            'created_by': 'user_student_001',
            'members': ['user_student_001', 'user_student_002', 'user_student_004'],
            'created_at': past_date(10, 20),
        },
        {
            'id': generate_id(),
            'name': 'Physics Problem Solving',
            'subject': 'Physics',
            'description': 'Collaborative problem solving for Physics 201.',
            'location': 'Science Building 201',
            'meeting_schedule': 'Wednesdays 5pm',
            'max_members': 6,
            'created_by': 'user_student_002',
            'members': ['user_student_002', 'user_student_003'],
            'created_at': past_date(5, 15),
        },
    ]
    
    if minimal:
        groups = groups[:1]
    
    count = 0
    for group in groups:
        if upsert_by_id('study_groups', group):
            count += 1
    print(f"   ✅ Seeded {count} study groups")
    return count

def seed_safe_disclosures(minimal=False):
    """Seed safe disclosure reports (anonymized sample data)"""
    print("\n🛡️ Seeding safe disclosure data...")
    
    # Note: These are anonymized sample records for testing the reporting system
    disclosures = [
        {
            'id': generate_id(),
            'disclosure_type': 'bullying',
            'incident_date': past_date(30, 60),
            'severity': 'medium',
            'status': 'resolved',
            'anonymous': True,
            'created_at': past_date(25, 55),
            'resolved_at': past_date(10, 20),
        },
        {
            'id': generate_id(),
            'disclosure_type': 'harassment',
            'incident_date': past_date(15, 30),
            'severity': 'high',
            'status': 'in_review',
            'anonymous': False,
            'submitted_by': 'user_student_003',
            'created_at': past_date(10, 25),
        },
        {
            'id': generate_id(),
            'disclosure_type': 'safety_concern',
            'incident_date': past_date(5, 10),
            'severity': 'low',
            'status': 'pending',
            'anonymous': True,
            'created_at': past_date(3, 8),
        },
    ]
    
    if minimal:
        disclosures = disclosures[:1]
    
    count = 0
    for disclosure in disclosures:
        if upsert_by_id('disclosures', disclosure):
            count += 1
    print(f"   ✅ Seeded {count} safe disclosure records")
    return count

def seed_parcels(minimal=False):
    """Seed parcel notifications"""
    print("\n📦 Seeding parcels...")
    
    parcels = [
        {
            'id': generate_id(),
            'recipient_id': 'user_student_001',
            'recipient_name': 'Alice Johnson',
            'carrier': 'Australia Post',
            'tracking_number': 'AP123456789',
            'status': 'awaiting_pickup',
            'location': 'Reception Desk',
            'notified_at': past_date(0, 1),
            'created_at': past_date(0, 1),
        },
        {
            'id': generate_id(),
            'recipient_id': 'user_student_002',
            'recipient_name': 'Bob Smith',
            'carrier': 'DHL',
            'tracking_number': 'DHL987654321',
            'status': 'picked_up',
            'location': 'Reception Desk',
            'notified_at': past_date(3, 5),
            'picked_up_at': past_date(2, 3),
            'created_at': past_date(3, 5),
        },
    ]
    
    if minimal:
        parcels = parcels[:1]
    
    count = 0
    for parcel in parcels:
        if upsert_by_id('parcels', parcel):
            count += 1
    print(f"   ✅ Seeded {count} parcels")
    return count

def seed_cocurricular_activities(minimal=False):
    """Seed co-curricular activities/clubs with proper categories"""
    print("\n🎭 Seeding co-curricular activities...")
    
    # Default contact info for system-created activities
    default_contact = {
        'contact_person': 'user_admin_001',
        'contact_person_name': 'Quadley Admin',
        'owner_id': 'user_admin_001',
        'owner_name': 'Quadley Admin',
        'member_names': [],
        'photos': [],
        'message_group_id': None,
        'competition_times': None,
        'send_reminders': False,
        'reminder_times': [],
    }
    
    activities = [
        # Cultural Activities
        {
            'id': 'activity_cultural_001',
            'name': 'International Dance Club',
            'type': 'Cultural Activities',
            'description': 'Learn and perform traditional dances from around the world. All skill levels welcome!',
            'meeting_times': 'Tuesdays & Thursdays 7:00 PM',
            'other_details': 'Dance Studio B, Recreation Center',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_cultural_002',
            'name': 'Drama & Theatre Society',
            'type': 'Cultural Activities',
            'description': 'Act, direct, and produce plays and performances throughout the year.',
            'meeting_times': 'Wednesdays 6:00 PM',
            'other_details': 'Black Box Theatre',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_cultural_003',
            'name': 'Art & Design Collective',
            'type': 'Cultural Activities',
            'description': 'Express yourself through painting, sculpture, digital art, and more.',
            'meeting_times': 'Mondays 5:00 PM',
            'other_details': 'Art Studio, Building C',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_cultural_004',
            'name': 'Music Ensemble',
            'type': 'Cultural Activities',
            'description': 'Join fellow musicians for jam sessions and performances.',
            'meeting_times': 'Fridays 4:00 PM',
            'other_details': 'Music Room, Student Center',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        
        # Sports & Athletics
        {
            'id': 'activity_sports_001',
            'name': 'Intramural Basketball',
            'type': 'Sports & Athletics',
            'description': 'Casual basketball games and tournaments. Form teams or join as free agent.',
            'meeting_times': 'Mon/Wed/Fri 6:00 PM',
            'other_details': 'Main Gym',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_sports_002',
            'name': 'Running Club',
            'type': 'Sports & Athletics',
            'description': 'Group runs for all fitness levels. Train for 5Ks or just enjoy the exercise.',
            'meeting_times': 'Tue/Thu 6:30 AM & Sat 8:00 AM',
            'other_details': 'Meet at Main Entrance',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_sports_003',
            'name': 'Yoga & Wellness',
            'type': 'Sports & Athletics',
            'description': 'Relax and strengthen your body with guided yoga sessions.',
            'meeting_times': 'Daily 7:00 AM',
            'other_details': 'Wellness Center, Room 101',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_sports_004',
            'name': 'Swimming Club',
            'type': 'Sports & Athletics',
            'description': 'Lap swimming, water polo, and aquatic fitness.',
            'meeting_times': 'Tue/Thu 5:00 PM',
            'other_details': 'Aquatic Center',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_sports_005',
            'name': 'Soccer/Football Club',
            'type': 'Sports & Athletics',
            'description': 'Weekly pickup games and seasonal tournaments.',
            'meeting_times': 'Saturdays 2:00 PM',
            'other_details': 'South Field',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        
        # Clubs
        {
            'id': 'activity_clubs_001',
            'name': 'Debate Society',
            'type': 'Clubs',
            'description': 'Sharpen your argumentation and public speaking skills.',
            'meeting_times': 'Thursdays 7:00 PM',
            'other_details': 'Conference Room A',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_clubs_002',
            'name': 'Environmental Action',
            'type': 'Clubs',
            'description': 'Campus sustainability initiatives and environmental advocacy.',
            'meeting_times': 'Wednesdays 5:30 PM',
            'other_details': 'Green Building, Room 203',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_clubs_003',
            'name': 'Photography Club',
            'type': 'Clubs',
            'description': 'Learn photography techniques, share your work, and go on photo walks.',
            'meeting_times': 'Sundays 10:00 AM',
            'other_details': 'Media Lab',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_clubs_004',
            'name': 'Book Club',
            'type': 'Clubs',
            'description': 'Monthly book discussions across various genres.',
            'meeting_times': 'First Friday of month 6:00 PM',
            'other_details': 'Library Lounge',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_clubs_005',
            'name': 'Coding & Tech Club',
            'type': 'Clubs',
            'description': 'Hackathons, coding workshops, and tech talks.',
            'meeting_times': 'Tuesdays 8:00 PM',
            'other_details': 'Computer Lab 2',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
        {
            'id': 'activity_clubs_006',
            'name': 'Volunteer Corps',
            'type': 'Clubs',
            'description': 'Community service and volunteer opportunities.',
            'meeting_times': 'Saturdays 9:00 AM',
            'other_details': 'Community Center Lobby',
            'members': [],
            'created_at': past_date(30, 60),
            **default_contact,
        },
    ]
    
    if minimal:
        activities = activities[:6]  # 2 from each category
    
    count = 0
    for activity in activities:
        if upsert_by_id('cocurricular_groups', activity):
            count += 1
    print(f"   ✅ Seeded {count} co-curricular activities")
    return count

def seed_tutoring(minimal=False):
    """Seed tutoring listings"""
    print("\n📚 Seeding tutoring...")
    
    tutors = [
        {
            'id': 'tutor_001',
            'student_id': 'user_student_001',
            'student_name': 'Alice Johnson',
            'subjects': ['Mathematics', 'Statistics'],
            'available_times': 'Mon/Wed 3-5 PM, Sat 10 AM-12 PM',
            'bio': 'Math major with 3 years tutoring experience. Patient and thorough!',
            'hourly_rate': 0,  # Free peer tutoring
            'status': 'approved',
            'created_at': past_date(10, 30),
        },
        {
            'id': 'tutor_002',
            'student_id': 'user_student_002',
            'student_name': 'Bob Smith',
            'subjects': ['Physics', 'Chemistry'],
            'available_times': 'Tue/Thu 4-6 PM',
            'bio': 'Pre-med student. Can help with general sciences and lab reports.',
            'hourly_rate': 0,
            'status': 'approved',
            'created_at': past_date(10, 30),
        },
        {
            'id': 'tutor_003',
            'student_id': 'user_student_003',
            'student_name': 'Carol Davis',
            'subjects': ['English', 'Writing', 'Essay Review'],
            'available_times': 'Flexible - message to schedule',
            'bio': 'English Literature major. Expert at essay structure and grammar.',
            'hourly_rate': 0,
            'status': 'approved',
            'created_at': past_date(10, 30),
        },
        {
            'id': 'tutor_004',
            'student_id': 'user_student_004',
            'student_name': 'David Lee',
            'subjects': ['Computer Science', 'Python', 'Java'],
            'available_times': 'Evenings after 7 PM',
            'bio': 'CS senior. Can help with programming assignments and debugging.',
            'hourly_rate': 0,
            'status': 'approved',
            'created_at': past_date(10, 30),
        },
    ]
    
    if minimal:
        tutors = tutors[:2]
    
    count = 0
    for tutor in tutors:
        if upsert_by_id('tutoring', tutor):
            count += 1
    print(f"   ✅ Seeded {count} tutors")
    return count

def seed_bookings(minimal=False):
    """Seed room/facility bookings"""
    print("\n📅 Seeding bookings...")
    
    # Bookable resources
    resources = [
        {'id': 'resource_001', 'name': 'Study Room A', 'type': 'study_room', 'capacity': 6, 'location': 'Library Level 2'},
        {'id': 'resource_002', 'name': 'Study Room B', 'type': 'study_room', 'capacity': 4, 'location': 'Library Level 2'},
        {'id': 'resource_003', 'name': 'Meeting Room 1', 'type': 'meeting_room', 'capacity': 12, 'location': 'Student Center'},
        {'id': 'resource_004', 'name': 'Music Practice Room', 'type': 'practice_room', 'capacity': 2, 'location': 'Arts Building'},
        {'id': 'resource_005', 'name': 'BBQ Area', 'type': 'outdoor', 'capacity': 20, 'location': 'Courtyard'},
        {'id': 'resource_006', 'name': 'Common Room TV', 'type': 'equipment', 'capacity': 1, 'location': 'Level 1 Common Room'},
    ]
    
    for resource in resources:
        resource['created_at'] = datetime.now(timezone.utc).isoformat()
        upsert_by_id('bookable_resources', resource)
    
    # Sample bookings
    bookings = [
        {
            'id': 'booking_001',
            'resource_id': 'resource_001',
            'resource_name': 'Study Room A',
            'user_id': 'user_student_001',
            'user_name': 'Alice Johnson',
            'date': future_date(1, 3),
            'start_time': '14:00',
            'end_time': '16:00',
            'purpose': 'Group study session for finals',
            'status': 'confirmed',
            'created_at': past_date(0, 1),
        },
        {
            'id': 'booking_002',
            'resource_id': 'resource_003',
            'resource_name': 'Meeting Room 1',
            'user_id': 'user_student_002',
            'user_name': 'Bob Smith',
            'date': future_date(2, 5),
            'start_time': '18:00',
            'end_time': '20:00',
            'purpose': 'Club committee meeting',
            'status': 'confirmed',
            'created_at': past_date(0, 2),
        },
        {
            'id': 'booking_003',
            'resource_id': 'resource_005',
            'resource_name': 'BBQ Area',
            'user_id': 'user_ra_001',
            'user_name': 'Emily Pink',
            'date': future_date(5, 10),
            'start_time': '12:00',
            'end_time': '15:00',
            'purpose': 'Floor social event',
            'status': 'pending',
            'created_at': past_date(0, 1),
        },
    ]
    
    if minimal:
        bookings = bookings[:2]
    
    count = 0
    for booking in bookings:
        if upsert_by_id('bookings', booking):
            count += 1
    print(f"   ✅ Seeded {len(resources)} resources and {count} bookings")
    return count

def seed_wellbeing_resources():
    """Seed wellbeing/mental health resources"""
    print("\n💚 Seeding wellbeing resources...")
    
    resources = [
        {
            'id': 'wellbeing_001',
            'title': 'Counseling Services',
            'category': 'mental_health',
            'description': 'Free confidential counseling available to all students. Individual and group sessions.',
            'contact': 'counseling@college.edu',
            'phone': '555-HELP',
            'hours': 'Mon-Fri 9 AM - 5 PM',
            'location': 'Health Center, Room 201',
            'is_emergency': False,
        },
        {
            'id': 'wellbeing_002',
            'title': '24/7 Crisis Hotline',
            'category': 'crisis',
            'description': 'Immediate support available around the clock for mental health emergencies.',
            'contact': 'crisis@college.edu',
            'phone': '555-CRISIS',
            'hours': '24/7',
            'location': 'Phone/Text support',
            'is_emergency': True,
        },
        {
            'id': 'wellbeing_003',
            'title': 'Peer Support Network',
            'category': 'peer_support',
            'description': 'Trained student volunteers available to listen and connect you with resources.',
            'contact': 'peers@college.edu',
            'phone': None,
            'hours': 'Evenings 6-10 PM',
            'location': 'Student Wellness Center',
            'is_emergency': False,
        },
        {
            'id': 'wellbeing_004',
            'title': 'Meditation & Mindfulness',
            'category': 'wellness',
            'description': 'Weekly guided meditation sessions. No experience needed.',
            'contact': None,
            'phone': None,
            'hours': 'Wednesdays 12 PM',
            'location': 'Quiet Room, Library Level 3',
            'is_emergency': False,
        },
        {
            'id': 'wellbeing_005',
            'title': 'Health Services',
            'category': 'physical_health',
            'description': 'General health checkups, vaccinations, and minor illness treatment.',
            'contact': 'health@college.edu',
            'phone': '555-DOCS',
            'hours': 'Mon-Fri 8 AM - 6 PM',
            'location': 'Health Center',
            'is_emergency': False,
        },
    ]
    
    count = 0
    for resource in resources:
        resource['created_at'] = datetime.now(timezone.utc).isoformat()
        if upsert_by_id('wellbeing_resources', resource):
            count += 1
    print(f"   ✅ Seeded {count} wellbeing resources")
    return count

def seed_finance_records(minimal=False):
    """Seed finance/billing records"""
    print("\n💰 Seeding finance records...")
    
    # Get student IDs
    students = list(db.users.find({'role': 'student'}, {'id': 1}).limit(5))
    if not students:
        print("   ⚠️ No students found - skipping finance records")
        return 0
    
    records = []
    for i, student in enumerate(students):
        # Room charges
        records.append({
            'id': f'finance_room_{student["id"]}',
            'user_id': student['id'],
            'type': 'charge',
            'category': 'room',
            'description': 'Spring Semester Room Fee',
            'amount': 5500.00,
            'due_date': future_date(30, 45),
            'status': 'pending',
            'created_at': past_date(5, 10),
        })
        # Meal plan
        records.append({
            'id': f'finance_meal_{student["id"]}',
            'user_id': student['id'],
            'type': 'charge',
            'category': 'meal_plan',
            'description': 'Spring Semester Meal Plan',
            'amount': 2200.00,
            'due_date': future_date(30, 45),
            'status': 'pending',
            'created_at': past_date(5, 10),
        })
        # A payment for some students
        if i % 2 == 0:
            records.append({
                'id': f'finance_payment_{student["id"]}',
                'user_id': student['id'],
                'type': 'payment',
                'category': 'payment',
                'description': 'Payment received - Thank you!',
                'amount': -3000.00,
                'due_date': None,
                'status': 'completed',
                'created_at': past_date(1, 5),
            })
    
    if minimal:
        records = records[:6]
    
    count = 0
    for record in records:
        if upsert_by_id('finance_records', record):
            count += 1
    print(f"   ✅ Seeded {count} finance records")
    return count

def seed_floor_posts(minimal=False):
    """Seed floor community posts"""
    print("\n🏠 Seeding floor posts...")
    
    floors = ['Level 1 - Wing A', 'Level 1 - Wing B', 'Level 2 - Wing A', 'Level 2 - Wing B']
    
    posts = [
        {
            'id': 'floor_post_001',
            'floor': floors[0],
            'author_id': 'user_ra_001',
            'author_name': 'Emily Pink (RA)',
            'title': 'Floor Meeting Tonight!',
            'content': 'Reminder: Mandatory floor meeting tonight at 8 PM in the common room. We\'ll be discussing upcoming events and any concerns.',
            'type': 'announcement',
            'pinned': True,
            'created_at': past_date(0, 1),
        },
        {
            'id': 'floor_post_002',
            'floor': floors[0],
            'author_id': 'user_student_001',
            'author_name': 'Alice Johnson',
            'title': 'Lost Keys',
            'content': 'Has anyone found a set of keys with a blue keychain? I think I dropped them in the laundry room.',
            'type': 'question',
            'pinned': False,
            'created_at': past_date(0, 2),
        },
        {
            'id': 'floor_post_003',
            'floor': floors[0],
            'author_id': 'user_student_002',
            'author_name': 'Bob Smith',
            'title': 'Movie Night This Saturday',
            'content': 'Hosting a movie night in my room (203). Bringing popcorn and snacks. DM me if you want to join!',
            'type': 'social',
            'pinned': False,
            'created_at': past_date(1, 3),
        },
        {
            'id': 'floor_post_004',
            'floor': floors[1],
            'author_id': 'user_student_003',
            'author_name': 'Carol Davis',
            'title': 'Study Group for Bio 101',
            'content': 'Anyone else struggling with the upcoming Bio exam? Let\'s form a study group!',
            'type': 'academic',
            'pinned': False,
            'created_at': past_date(0, 3),
        },
        {
            'id': 'floor_post_005',
            'floor': floors[2],
            'author_id': 'user_student_004',
            'author_name': 'David Lee',
            'title': 'Selling Mini Fridge',
            'content': 'Moving out next semester. Selling my mini fridge for $50. Works perfectly. Message if interested.',
            'type': 'marketplace',
            'pinned': False,
            'created_at': past_date(2, 5),
        },
    ]
    
    if minimal:
        posts = posts[:3]
    
    count = 0
    for post in posts:
        if upsert_by_id('floor_posts', post):
            count += 1
    print(f"   ✅ Seeded {count} floor posts")
    return count

def seed_messages(minimal=False):
    """Seed direct messages/conversations"""
    print("\n💬 Seeding messages...")
    
    conversations = [
        {
            'id': 'conv_001',
            'participants': ['user_student_001', 'user_ra_001'],
            'participant_names': ['Alice Johnson', 'Emily Pink'],
            'last_message': 'Thanks for letting me know about the noise complaint!',
            'last_message_at': past_date(0, 1),
            'unread_count': {'user_student_001': 0, 'user_ra_001': 1},
        },
        {
            'id': 'conv_002',
            'participants': ['user_student_001', 'user_student_002'],
            'participant_names': ['Alice Johnson', 'Bob Smith'],
            'last_message': 'See you at the library at 3!',
            'last_message_at': past_date(0, 0),
            'unread_count': {'user_student_001': 1, 'user_student_002': 0},
        },
    ]
    
    messages = [
        # Conversation 1
        {'id': 'msg_001', 'conversation_id': 'conv_001', 'sender_id': 'user_student_001', 'content': 'Hi Emily, is there a floor meeting this week?', 'created_at': past_date(1, 2)},
        {'id': 'msg_002', 'conversation_id': 'conv_001', 'sender_id': 'user_ra_001', 'content': 'Yes! Thursday at 8 PM. I\'ll send an announcement.', 'created_at': past_date(1, 2)},
        {'id': 'msg_003', 'conversation_id': 'conv_001', 'sender_id': 'user_student_001', 'content': 'Thanks for letting me know about the noise complaint!', 'created_at': past_date(0, 1)},
        # Conversation 2
        {'id': 'msg_004', 'conversation_id': 'conv_002', 'sender_id': 'user_student_002', 'content': 'Hey, want to study together for the calc exam?', 'created_at': past_date(0, 1)},
        {'id': 'msg_005', 'conversation_id': 'conv_002', 'sender_id': 'user_student_001', 'content': 'Sure! Library?', 'created_at': past_date(0, 0)},
        {'id': 'msg_006', 'conversation_id': 'conv_002', 'sender_id': 'user_student_002', 'content': 'See you at the library at 3!', 'created_at': past_date(0, 0)},
    ]
    
    if minimal:
        conversations = conversations[:1]
        messages = messages[:3]
    
    count = 0
    for conv in conversations:
        if upsert_by_id('conversations', conv):
            count += 1
    
    msg_count = 0
    for msg in messages:
        if upsert_by_id('messages', msg):
            msg_count += 1
    
    print(f"   ✅ Seeded {count} conversations and {msg_count} messages")
    return count

def future_date(min_days, max_days):
    """Generate a future date string"""
    days = random.randint(min_days, max_days)
    date = datetime.now(timezone.utc) + timedelta(days=days)
    return date.strftime('%Y-%m-%d')

def clean_test_data():
    """Remove all test data from collections"""
    print("\n🧹 Cleaning existing test data...")
    
    collections = [
        'users', 'tenants', 'announcements', 'events', 'jobs', 'job_applications',
        'maintenance_requests', 'maintenance', 'shoutouts', 'dining_menus',
        'study_groups', 'disclosures', 'parcels', 'parcel_notifications',
        'messages', 'conversations', 'clubs', 'bookings', 'bookable_resources',
        'cocurricular_groups', 'tutoring', 'wellbeing_resources', 
        'finance_records', 'floor_posts'
    ]
    
    for collection in collections:
        result = db[collection].delete_many({})
        if result.deleted_count > 0:
            print(f"   Deleted {result.deleted_count} documents from {collection}")
    
    print("   ✅ Cleanup complete")

# ============ MAIN ============

def main():
    parser = argparse.ArgumentParser(description='Seed test data into Quadley database')
    parser.add_argument('--clean', action='store_true', help='Clear existing data before seeding')
    parser.add_argument('--users-only', action='store_true', help='Only seed user accounts')
    parser.add_argument('--minimal', action='store_true', help='Seed minimal data')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🌱 Quadley Test Data Seeder")
    print(f"   Database: {DB_NAME}")
    print(f"   Environment: {ENV}")
    print("=" * 60)
    
    if args.clean:
        clean_test_data()
    
    # Always seed users and tenants
    seed_tenants()
    seed_users(minimal=args.minimal)
    
    if not args.users_only:
        seed_announcements(minimal=args.minimal)
        seed_events(minimal=args.minimal)
        seed_jobs(minimal=args.minimal)
        seed_job_applications(minimal=args.minimal)
        seed_maintenance_requests(minimal=args.minimal)
        seed_shoutouts(minimal=args.minimal)
        seed_dining_menu()
        seed_study_groups(minimal=args.minimal)
        seed_safe_disclosures(minimal=args.minimal)
        seed_parcels(minimal=args.minimal)
        seed_cocurricular_activities(minimal=args.minimal)
        seed_tutoring(minimal=args.minimal)
        seed_bookings(minimal=args.minimal)
        seed_wellbeing_resources()
        seed_finance_records(minimal=args.minimal)
        seed_floor_posts(minimal=args.minimal)
        seed_messages(minimal=args.minimal)
    
    print("\n" + "=" * 60)
    print("✅ Test data seeding complete!")
    print("")
    print("Test Accounts:")
    print("  Super Admin: gen@quadley.app / Quadley2025!")
    print("  Admin:       admin@quadley.app / Admin123!")
    print("  RA:          epink@icloud.com / AbC!123!AbC!123!")
    print("  Student:     alice@example.com / Quadley2025!")
    print("=" * 60)

if __name__ == '__main__':
    main()
