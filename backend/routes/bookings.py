"""Bookings routes for facility reservations - Tenant isolated (OWASP A01)"""
from fastapi import APIRouter, Depends
from typing import List
from datetime import datetime

from models import Booking, BookingCreate
from utils.auth import get_tenant_db_for_user

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=Booking)
async def create_booking(
    booking_data: BookingCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a facility booking - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    booking = Booking(
        student_id=current_user.id,
        student_name=f"{current_user.first_name} {current_user.last_name}",
        facility=booking_data.facility,
        date=booking_data.date,
        duration=booking_data.duration,
        purpose=booking_data.purpose,
        booking_type=booking_data.booking_type
    )
    
    booking_doc = booking.model_dump()
    booking_doc['date'] = booking_doc['date'].isoformat()
    booking_doc['created_at'] = booking_doc['created_at'].isoformat()
    await tenant_db.bookings.insert_one(booking_doc)
    
    return booking


@router.get("", response_model=List[Booking])
async def get_bookings(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get user's bookings - tenant isolated"""
    tenant_db, current_user = tenant_data
    
    bookings = await tenant_db.bookings.find({"student_id": str(current_user).id}, {"_id": 0}).sort("date", -1).to_list(50)
    
    for booking in bookings:
        if isinstance(booking.get('date'), str):
            booking['date'] = datetime.fromisoformat(booking['date'])
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = datetime.fromisoformat(booking['created_at'])
    
    return bookings
