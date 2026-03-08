"""Move-In Magic routes"""
from fastapi import APIRouter, Depends

from models import User
from utils.auth import get_current_user

router = APIRouter(prefix="/move-in-magic", tags=["move_in"])


@router.get("/data")
async def get_move_in_magic_data(current_user: User = Depends(get_current_user)):
    """Get Move-In Magic data including welcome message, things to bring, and floor map"""
    things_to_bring = [
        "Bedding (sheets, pillows, blanket)",
        "Towels and toiletries",
        "Laptop and chargers",
        "Study supplies (notebooks, pens)",
        "Clothing for all seasons",
        "Personal medications",
        "Photos and decorations",
        "Laundry supplies",
        "Reusable water bottle",
        "Extension cords and power strips"
    ]
    
    welcome_message = f"Welcome to Residential College, {current_user.first_name}! 🎉\n\nWe're excited to have you join our community. Move-in day is an exciting time, and we're here to help make your transition as smooth as possible. Below you'll find a helpful checklist of things to bring, and your floor map with your room marked. If you need any assistance during move-in, don't hesitate to reach out to our staff!"
    
    floor_map_url = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80"
    
    transport_options = [
        {"name": "Campus Shuttle", "description": "Free shuttle service around campus", "schedule": "Every 15 mins, 7am-10pm"},
        {"name": "Public Bus", "description": "Route 42 stops at Main Gate", "schedule": "Every 20 mins weekdays"},
        {"name": "Uber/Lyft", "description": "Rideshare pickup at South Entrance", "schedule": "24/7 available"},
        {"name": "Bike Share", "description": "Campus bike rental program", "schedule": "Station at Student Center"}
    ]
    
    grocery_stores = [
        {"name": "Campus Market", "distance": "On campus", "hours": "7am-11pm daily"},
        {"name": "Whole Foods", "distance": "0.5 miles", "hours": "8am-10pm daily"}
    ]
    
    return {
        "welcome_message": welcome_message,
        "things_to_bring": things_to_bring,
        "floor_map_url": floor_map_url,
        "room_number": current_user.room_number if hasattr(current_user, 'room_number') else None,
        "floor": current_user.floor,
        "transport_options": transport_options,
        "grocery_stores": grocery_stores
    }
