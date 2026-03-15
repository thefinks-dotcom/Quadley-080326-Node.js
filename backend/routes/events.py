"""Events and RSVP routes - Tenant isolated"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import csv
import io

from models import Event, EventCreate, EventRSVP, HousePoints
from utils.auth import get_tenant_db_for_user
from utils.csv_security import sanitize_csv_row

router = APIRouter(prefix="/events", tags=["events"])


def sanitize_csv_value(value: str) -> str:
    """
    Sanitize CSV input to prevent formula injection (OWASP A03).
    CSV formula injection can occur when a cell starts with =, +, -, @, or tab/carriage return.
    """
    if not value:
        return value
    
    # Characters that can trigger formula execution in spreadsheet apps
    formula_triggers = ('=', '+', '-', '@', '\t', '\r', '\n')
    
    # If value starts with a formula trigger, remove it
    if value.startswith(formula_triggers):
        return value.lstrip('=+-@\t\r\n').strip()
    
    return value.strip()


async def award_house_points(tenant_db, house_name: str, points: int):
    """Helper function to award points to a house"""
    current_year = datetime.now(timezone.utc).year
    house = await tenant_db.house_points.find_one({"house_name": house_name, "year": current_year})
    
    if house:
        new_points = house.get('points', 0) + points
        await tenant_db.house_points.update_one(
            {"house_name": house_name, "year": current_year},
            {"$set": {"points": new_points, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        house_point = HousePoints(house_name=house_name, points=points, year=current_year)
        house_doc = house_point.model_dump()
        house_doc['updated_at'] = house_doc['updated_at'].isoformat()
        await tenant_db.house_points.insert_one(house_doc)


@router.post("", response_model=Event)
async def create_event(
    event_data: EventCreate, 
    background_tasks: BackgroundTasks,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create a new event (RAs, admins, super_admins, and college_admins only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    event = Event(
        title=event_data.title,
        description=event_data.description,
        date=event_data.date,
        location=event_data.location,
        created_by=current_user.id,
        max_attendees=event_data.max_attendees,
        category=event_data.category,
        house_event=event_data.house_event,
        house_name=event_data.house_name,
        points=event_data.points,
        floor=event_data.floor,
        event_type=event_data.event_type
    )
    
    event_doc = event.model_dump()
    event_doc['date'] = event_doc['date'].isoformat()
    event_doc['created_at'] = event_doc['created_at'].isoformat()
    await tenant_db.events.insert_one(event_doc)
    
    return event


@router.put("/{event_id}", response_model=Event)
async def update_event(
    event_id: str,
    event_data: EventCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update an existing event (creator, RAs, admins only)"""
    tenant_db, current_user = tenant_data
    
    existing_event = await tenant_db.events.find_one({"id": str(event_id)}, {"_id": 0})
    if not existing_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if existing_event.get('created_by') != current_user.id and current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Not authorized to update this event")
    
    update_data = {
        "title": event_data.title,
        "description": event_data.description,
        "date": event_data.date,
        "location": event_data.location,
        "category": event_data.category,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if event_data.max_attendees is not None:
        update_data["max_attendees"] = event_data.max_attendees
    if hasattr(event_data, 'house_event') and event_data.house_event is not None:
        update_data["house_event"] = event_data.house_event
    if hasattr(event_data, 'house_name') and event_data.house_name:
        update_data["house_name"] = event_data.house_name
    if hasattr(event_data, 'points') and event_data.points is not None:
        update_data["points"] = event_data.points
    if hasattr(event_data, 'floor') and event_data.floor:
        update_data["floor"] = event_data.floor
    if hasattr(event_data, 'event_type') and event_data.event_type:
        update_data["event_type"] = event_data.event_type
    
    await tenant_db.events.update_one({"id": str(event_id)}, {"$set": update_data})
    
    updated_event = await tenant_db.events.find_one({"id": str(event_id)}, {"_id": 0})
    if isinstance(updated_event.get('date'), str):
        updated_event['date'] = datetime.fromisoformat(updated_event['date'])
    if isinstance(updated_event.get('created_at'), str):
        updated_event['created_at'] = datetime.fromisoformat(updated_event['created_at'])
    
    return updated_event


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete an event (creator, RAs, admins only)"""
    tenant_db, current_user = tenant_data
    
    existing_event = await tenant_db.events.find_one({"id": str(event_id)}, {"_id": 0})
    if not existing_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if existing_event.get('created_by') != current_user.id and current_user.role not in ['ra', 'admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
    
    await tenant_db.events.delete_one({"id": str(event_id)})
    await tenant_db.event_rsvps.delete_many({"event_id": str(event_id)})
    
    return {"message": "Event deleted successfully"}


@router.get("", response_model=List[Event])
async def get_events(
    include_past: bool = False,
    limit: int = Query(default=50, le=100, description="Max events to return"),
    skip: int = Query(default=0, ge=0, description="Number of events to skip"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get events for this tenant with pagination. By default, only returns upcoming events."""
    tenant_db, current_user = tenant_data
    
    # Build query - filter out past events unless include_past is True
    query = {}
    if not include_past:
        now = datetime.now(timezone.utc).isoformat()
        query["date"] = {"$gte": now}
    
    if category and category != 'all':
        query["category"] = category
    
    events = await tenant_db.events.find(query, {"_id": 0}).sort("date", 1).skip(skip).limit(limit).to_list(limit)
    
    for event in events:
        if isinstance(event.get('date'), str):
            event['date'] = datetime.fromisoformat(event['date'])
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
    
    return events


@router.get("/all", response_model=List[Event])
async def get_all_events(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get all events including past (for admin/archive view)"""
    tenant_db, current_user = tenant_data
    
    events = await tenant_db.events.find({}, {"_id": 0}).sort("date", -1).to_list(100)
    
    for event in events:
        if isinstance(event.get('date'), str):
            event['date'] = datetime.fromisoformat(event['date'])
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
    
    return events


@router.post("/{event_id}/rsvp")
async def rsvp_event(
    event_id: str, 
    rsvp: EventRSVP, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """RSVP to an event"""
    tenant_db, current_user = tenant_data
    
    event = await tenant_db.events.find_one({"id": str(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    rsvp_record = await tenant_db.event_rsvps.find_one({"event_id": str(event_id), "user_id": str(current_user).id})
    
    if rsvp_record:
        await tenant_db.event_rsvps.update_one(
            {"event_id": str(event_id), "user_id": str(current_user).id},
            {"$set": {"response": rsvp.response, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        rsvp_doc = {
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "user_id": current_user.id,
            "user_name": f"{current_user.first_name} {current_user.last_name}",
            "response": rsvp.response,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await tenant_db.event_rsvps.insert_one(rsvp_doc)
    
    attendees = event.get('attendees', [])
    if rsvp.response == 'attending' and current_user.id not in attendees:
        if event.get('max_attendees') and len(attendees) >= event['max_attendees']:
            raise HTTPException(status_code=400, detail="Event is full")
        attendees.append(current_user.id)
        await tenant_db.events.update_one({"id": str(event_id)}, {"$set": {"attendees": attendees}})
    elif rsvp.response != 'attending' and current_user.id in attendees:
        attendees.remove(current_user.id)
        await tenant_db.events.update_one({"id": str(event_id)}, {"$set": {"attendees": attendees}})
    
    if rsvp.response == 'attending' and event.get('house_event') and current_user.floor:
        await award_house_points(tenant_db, current_user.floor, event.get('points', 10))
    
    return {"message": f"RSVP updated to: {rsvp.response}"}


@router.get("/{event_id}/rsvp-summary")
async def get_event_rsvp_summary(
    event_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get RSVP summary for an event"""
    tenant_db, current_user = tenant_data
    
    rsvps = await tenant_db.event_rsvps.find({"event_id": str(event_id)}, {"_id": 0}).to_list(1000)
    
    summary = {
        "attending": 0,
        "maybe": 0,
        "unable": 0
    }
    
    for rsvp in rsvps:
        response = rsvp.get('response', '')
        if response in summary:
            summary[response] += 1
    
    return summary


@router.get("/{event_id}/rsvps")
async def get_event_rsvps(
    event_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get all RSVPs for an event (RAs and admins only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    rsvps = await tenant_db.event_rsvps.find({"event_id": str(event_id)}, {"_id": 0}).to_list(100)
    
    for rsvp in rsvps:
        if isinstance(rsvp.get('created_at'), str):
            rsvp['created_at'] = datetime.fromisoformat(rsvp['created_at'])
        if isinstance(rsvp.get('updated_at'), str):
            rsvp['updated_at'] = datetime.fromisoformat(rsvp['updated_at'])
    
    return rsvps


@router.get("/{event_id}/my-rsvp")
async def get_my_rsvp(
    event_id: str, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get current user's RSVP for an event"""
    tenant_db, current_user = tenant_data
    
    rsvp = await tenant_db.event_rsvps.find_one({"event_id": str(event_id), "user_id": str(current_user).id}, {"_id": 0})
    
    if not rsvp:
        return {"response": None}
    
    if isinstance(rsvp.get('created_at'), str):
        rsvp['created_at'] = datetime.fromisoformat(rsvp['created_at'])
    if isinstance(rsvp.get('updated_at'), str):
        rsvp['updated_at'] = datetime.fromisoformat(rsvp['updated_at'])
    
    return rsvp


# ============ EVENT REMINDERS ============

@router.post("/send-reminders")
async def trigger_event_reminders(
    background_tasks: BackgroundTasks,
    hours_before: int = 24,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Trigger event reminders for events happening within the specified hours."""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    reminder_window_start = now
    reminder_window_end = now + timedelta(hours=hours_before)
    
    events = await tenant_db.events.find({
        "date": {
            "$gte": reminder_window_start.isoformat(),
            "$lte": reminder_window_end.isoformat()
        }
    }).to_list(100)
    
    reminders_scheduled = 0
    
    for event in events:
        event_id = event.get("id")
        
        existing_reminder = await tenant_db.event_reminders.find_one({
            "event_id": event_id,
            "sent_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
        })
        
        if existing_reminder:
            continue
        
        reminders_scheduled += 1
    
    return {
        "success": True,
        "events_checked": len(events),
        "reminders_scheduled": reminders_scheduled,
        "window": f"{hours_before} hours"
    }


@router.get("/upcoming-reminders")
async def get_upcoming_reminders(
    hours: int = 48,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get list of events that will have reminders sent within the specified hours."""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=hours)
    
    events = await tenant_db.events.find({
        "date": {
            "$gte": now.isoformat(),
            "$lte": window_end.isoformat()
        }
    }, {"_id": 0}).to_list(50)
    
    upcoming = []
    for event in events:
        rsvp_count = await tenant_db.event_rsvps.count_documents({
            "event_id": event.get("id"),
            "response": "attending"
        })
        
        reminder_sent = await tenant_db.event_reminders.find_one({
            "event_id": event.get("id"),
            "sent_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
        })
        
        upcoming.append({
            "id": event.get("id"),
            "title": event.get("title"),
            "date": event.get("date"),
            "location": event.get("location"),
            "attending_count": rsvp_count,
            "reminder_sent_today": reminder_sent is not None
        })
    
    return {
        "window_hours": hours,
        "events": upcoming,
        "total": len(upcoming)
    }


# ============ BULK IMPORT ============

from fastapi import UploadFile, File


@router.post("/bulk-upload")
async def bulk_upload_events(
    file: UploadFile = File(...),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Bulk upload events from a CSV file."""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin', 'ra']:
        raise HTTPException(status_code=403, detail="Admin or RA access required")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")
    
    try:
        content = await file.read()
        try:
            text_content = content.decode('utf-8')
        except UnicodeDecodeError:
            text_content = content.decode('latin-1')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    try:
        csv_reader = csv.DictReader(io.StringIO(text_content))
        rows = list(csv_reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    required_headers = {'title', 'description', 'date', 'location', 'category'}
    actual_headers = set(rows[0].keys()) if rows else set()
    missing_headers = required_headers - actual_headers
    
    # Check if using new format (separate date/time) or old format (combined)
    has_separate_time = 'time' in actual_headers
    
    if missing_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing_headers)}"
        )
    
    valid_categories = ['social', 'academic', 'sports', 'cultural', 'floor_event', 'other']
    
    def parse_date(date_str):
        """Parse date from multiple formats"""
        date_str = date_str.strip()
        formats_to_try = [
            '%Y-%m-%d',      # 2026-02-04 (ISO)
            '%d/%m/%Y',      # 04/02/2026 (Australian/UK)
            '%m/%d/%Y',      # 02/04/2026 (US)
            '%Y.%m.%d',      # 2026.02.04 (dots)
            '%d.%m.%Y',      # 04.02.2026 (European dots)
            '%d-%m-%Y',      # 04-02-2026 (European dashes)
        ]
        for fmt in formats_to_try:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return None
    
    def parse_time(time_str):
        """Parse time from multiple formats"""
        time_str = time_str.strip()
        formats_to_try = [
            '%H:%M',         # 18:00 (24-hour)
            '%H:%M:%S',      # 18:00:00 (24-hour with seconds)
            '%I:%M %p',      # 6:00 PM (12-hour)
            '%I:%M%p',       # 6:00PM (12-hour no space)
        ]
        for fmt in formats_to_try:
            try:
                return datetime.strptime(time_str, fmt).time()
            except ValueError:
                continue
        return None
    
    results = {
        "total_rows": len(rows),
        "successful": 0,
        "failed": 0,
        "errors": [],
        "created_events": []
    }
    
    for row_num, row in enumerate(rows, start=2):
        # Sanitize all CSV inputs to prevent formula injection (OWASP A03)
        title = sanitize_csv_value(row.get('title', ''))
        description = sanitize_csv_value(row.get('description', ''))
        date_str = sanitize_csv_value(row.get('date', ''))
        time_str = sanitize_csv_value(row.get('time', '')) if has_separate_time else ''
        location = sanitize_csv_value(row.get('location', ''))
        category = sanitize_csv_value(row.get('category', '')).lower()
        max_attendees_str = sanitize_csv_value(row.get('max_attendees', ''))
        
        errors_for_row = []
        
        if not title:
            errors_for_row.append("Title is required")
        if not description:
            errors_for_row.append("Description is required")
        if not date_str:
            errors_for_row.append("Date is required")
        if not location:
            errors_for_row.append("Location is required")
        if not category:
            errors_for_row.append("Category is required")
        elif category not in valid_categories:
            errors_for_row.append(f"Invalid category. Must be one of: {', '.join(valid_categories)}")
        
        event_date = None
        if date_str:
            if has_separate_time and time_str:
                # Parse date and time separately
                parsed_date = parse_date(date_str)
                parsed_time = parse_time(time_str)
                
                if parsed_date and parsed_time:
                    event_date = datetime.combine(parsed_date.date(), parsed_time)
                elif parsed_date:
                    event_date = parsed_date.replace(hour=12, minute=0)
                    errors_for_row.append(f"Could not parse time: {time_str}, defaulting to 12:00")
                else:
                    errors_for_row.append(f"Invalid date format: {date_str}. Use DD/MM/YYYY")
            else:
                # Try combined date/time formats (backwards compatibility)
                try:
                    for fmt in ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d',
                                '%d/%m/%Y %H:%M', '%d/%m/%Y']:
                        try:
                            event_date = datetime.strptime(date_str, fmt)
                            if fmt in ['%Y-%m-%d', '%d/%m/%Y']:
                                event_date = event_date.replace(hour=12, minute=0)
                            break
                        except ValueError:
                            continue
                    if not event_date:
                        errors_for_row.append(f"Invalid date format: {date_str}")
                except Exception:
                    errors_for_row.append(f"Could not parse date: {date_str}")
        
        max_attendees = None
        if max_attendees_str:
            try:
                max_attendees = int(max_attendees_str)
                if max_attendees < 1:
                    errors_for_row.append("max_attendees must be at least 1")
            except ValueError:
                errors_for_row.append(f"Invalid max_attendees: {max_attendees_str}")
        
        if errors_for_row:
            results["failed"] += 1
            results["errors"].append({
                "row": row_num,
                "title": title or "N/A",
                "errors": errors_for_row
            })
            continue
        
        try:
            event_id = str(uuid.uuid4())
            event_doc = {
                "id": event_id,
                "title": title,
                "description": description,
                "date": event_date.isoformat() if event_date else None,
                "location": location,
                "category": category,
                "created_by": current_user.id,
                "max_attendees": max_attendees,
                "attendees": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await tenant_db.events.insert_one(event_doc)
            
            results["successful"] += 1
            results["created_events"].append({
                "id": event_id,
                "title": title,
                "date": event_date.strftime('%d/%m/%Y %H:%M') if event_date else None,
                "location": location,
                "category": category
            })
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "row": row_num,
                "title": title,
                "errors": [f"Database error: {str(e)}"]
            })
    
    return results


@router.get("/csv-template")
async def get_events_csv_template(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get the CSV template for bulk uploading events"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin', 'ra']:
        raise HTTPException(status_code=403, detail="Admin or RA access required")
    
    return {
        "template": "title,description,date,time,location,category,max_attendees",
        "example_rows": [
            "Welcome Party,Join us for the semester kickoff!,15/02/2026,18:00,Main Hall,social,100",
            "Study Group,Weekly exam prep session,16/02/2026,14:00,Library Room A,academic,20",
            "Floor Movie Night,Watch the latest blockbuster,17/02/2026,20:00,Common Room,floor_event,30"
        ],
        "categories": ["social", "academic", "sports", "cultural", "floor_event", "other"],
        "notes": [
            "date format: DD/MM/YYYY (e.g., 15/02/2026)",
            "time format: HH:MM in 24-hour format (e.g., 18:00 for 6pm)",
            "max_attendees is optional (leave empty for unlimited)",
            "category must be one of: social, academic, sports, cultural, floor_event, other"
        ]
    }


from fastapi.responses import StreamingResponse


@router.get("/export/csv")
async def export_events_csv(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Export all events as a CSV file"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin', 'ra']:
        raise HTTPException(status_code=403, detail="Admin or RA access required")
    
    events = await tenant_db.events.find({}, {"_id": 0}).sort("date", 1).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["id", "title", "description", "date", "location", "category", "max_attendees", "rsvp_count", "created_at"])
    
    for event in events:
        # Get RSVP count
        rsvp_count = await tenant_db.event_rsvps.count_documents({
            "event_id": event.get("id"),
            "response": "attending"
        })
        
        writer.writerow(sanitize_csv_row([
            event.get("id", ""),
            event.get("title", ""),
            event.get("description", ""),
            event.get("date", ""),
            event.get("location", ""),
            event.get("category", ""),
            event.get("max_attendees", ""),
            rsvp_count,
            event.get("created_at", "")
        ]))
    
    output.seek(0)
    filename = f"events_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
