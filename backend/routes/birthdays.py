"""Birthdays routes - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
import uuid

from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/birthdays", tags=["birthdays"])


@router.get("/upcoming")
async def get_upcoming_birthdays(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get birthdays happening this week - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    # Get all users with birthdays (excluding those who opted out)
    users = await tenant_db.users.find({
        "birthday": {"$exists": True, "$ne": None},
        "birthday_notifications": True
    }, {"_id": 0, "password": 0}).to_list(1000)
    
    today = datetime.now()
    week_from_now = today + timedelta(days=7)
    
    upcoming = []
    for user_doc in users:
        if user_doc.get('birthday'):
            try:
                # Parse birthday (format: YYYY-MM-DD or MM-DD)
                bday_str = user_doc['birthday']
                if len(bday_str.split('-')) == 3:
                    bday = datetime.strptime(bday_str, '%Y-%m-%d')
                else:
                    bday = datetime.strptime(f"{today.year}-{bday_str}", '%Y-%m-%d')
                
                # Check if birthday is this year (adjust to current year)
                bday_this_year = bday.replace(year=today.year)
                
                # If birthday already passed this year, check next year
                if bday_this_year < today:
                    bday_this_year = bday_this_year.replace(year=today.year + 1)
                
                # Check if within next 7 days
                if today <= bday_this_year <= week_from_now:
                    user_doc['birthday_date'] = bday_this_year.strftime('%Y-%m-%d')
                    user_doc['days_until'] = (bday_this_year - today).days
                    upcoming.append(user_doc)
            except Exception:
                continue
    
    # Sort by days until birthday
    upcoming.sort(key=lambda x: x.get('days_until', 999))
    return upcoming


@router.get("/today")
async def get_todays_birthdays(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get today's birthdays - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    users = await tenant_db.users.find({
        "birthday": {"$exists": True, "$ne": None},
        "birthday_notifications": True
    }, {"_id": 0, "password": 0}).to_list(1000)
    
    today = datetime.now()
    today_str = today.strftime('%m-%d')
    
    todays_birthdays = []
    for user_doc in users:
        if user_doc.get('birthday'):
            bday_str = user_doc['birthday']
            # Extract MM-DD from birthday string
            if len(bday_str.split('-')) == 3:
                bday_mmdd = '-'.join(bday_str.split('-')[1:])
            else:
                bday_mmdd = bday_str
            
            if bday_mmdd == today_str:
                todays_birthdays.append(user_doc)
    
    return todays_birthdays


@router.post("/{user_id}/wish")
async def send_birthday_wish(
    user_id: str, 
    wish_data: dict, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Send a birthday wish to a user - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    wish = {
        "id": str(uuid.uuid4()),
        "from_user_id": current_user.id,
        "from_user_name": f"{current_user.first_name} {current_user.last_name}",
        "to_user_id": user_id,
        "message": wish_data.get('message', 'Happy Birthday! 🎉'),
        "created_at": datetime.now().isoformat()
    }
    
    await tenant_db.birthday_wishes.insert_one(wish)
    
    return {"message": "Birthday wish sent successfully"}
