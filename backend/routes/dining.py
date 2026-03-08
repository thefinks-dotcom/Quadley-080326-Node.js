"""Dining and meals routes - Tenant isolated"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List, Optional
from datetime import datetime, timezone
import csv
import io
import uuid

from models import MenuItem, MenuItemCreate, LateMealRequest, LateMealRequestCreate
from utils.auth import get_tenant_db_for_user
from utils.csv_security import sanitize_csv_row

router = APIRouter(prefix="/dining", tags=["dining"])


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


@router.get("/menu", response_model=List[MenuItem])
async def get_menu(
    date: Optional[str] = None,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Get dining hall menu for this tenant"""
    tenant_db, current_user = tenant_data
    
    query = {"date": date} if date else {}
    menu = await tenant_db.menu.find(query, {"_id": 0}).sort("meal_type", 1).to_list(100)
    
    for item in menu:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    
    return menu


@router.post("/menu", response_model=MenuItem)
async def create_menu_item(
    item_data: MenuItemCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Create menu item (RAs and admins only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    item = MenuItem(
        name=item_data.name,
        description=item_data.description,
        meal_type=item_data.meal_type,
        date=item_data.date,
        dietary_tags=item_data.dietary_tags,
        nutrition_info=item_data.nutrition_info
    )
    
    item_doc = item.model_dump()
    item_doc['created_at'] = item_doc['created_at'].isoformat()
    await tenant_db.menu.insert_one(item_doc)
    
    return item


@router.put("/menu/{item_id}", response_model=MenuItem)
async def update_menu_item(
    item_id: str,
    item_data: MenuItemCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update a menu item (RAs and admins only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await tenant_db.menu.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    await tenant_db.menu.update_one(
        {"id": item_id},
        {"$set": {
            "name": item_data.name,
            "description": item_data.description,
            "meal_type": item_data.meal_type,
            "date": item_data.date,
            "dietary_tags": item_data.dietary_tags,
            "nutrition_info": item_data.nutrition_info,
        }}
    )
    
    updated = await tenant_db.menu.find_one({"id": item_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return updated


@router.delete("/menu/{item_id}")
async def delete_menu_item(
    item_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Delete a menu item (RAs and admins only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await tenant_db.menu.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    await tenant_db.menu.delete_one({"id": item_id})
    
    return {"message": "Menu item deleted"}


@router.post("/menu/bulk-upload")
async def bulk_upload_menu(
    file: UploadFile = File(...),
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Bulk upload menu items from CSV file (RAs and admins only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['ra', 'admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    
    try:
        decoded = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            decoded = content.decode('latin-1')
        except Exception:
            raise HTTPException(status_code=400, detail="Could not decode file. Please use UTF-8 encoding.")
    
    reader = csv.DictReader(io.StringIO(decoded))
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": [],
        "items_created": []
    }
    
    required_fields = ['name', 'meal_type', 'date']
    
    def parse_date(date_str):
        """Parse date from multiple formats and return YYYY-MM-DD format"""
        date_str = date_str.strip()
        
        # Try different date formats
        formats_to_try = [
            '%Y-%m-%d',      # 2026-02-04 (ISO)
            '%d/%m/%Y',      # 04/02/2026 (Australian/UK)
            '%m/%d/%Y',      # 02/04/2026 (US)
            '%Y.%m.%d',      # 2026.02.04 (dots)
            '%d.%m.%Y',      # 04.02.2026 (European dots)
            '%d-%m-%Y',      # 04-02-2026 (European dashes)
            '%Y/%m/%d',      # 2026/02/04
        ]
        
        for fmt in formats_to_try:
            try:
                parsed = datetime.strptime(date_str, fmt)
                return parsed.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        # If no format matched, return original (will likely cause issues but provides feedback)
        return date_str
    
    for row_num, row in enumerate(reader, start=2):
        try:
            # Sanitize all CSV inputs to prevent formula injection (OWASP A03)
            row = {k.strip().lstrip('\ufeff'): sanitize_csv_value(v) if v else '' for k, v in row.items()}
            
            missing = [f for f in required_fields if not row.get(f)]
            if missing:
                results["failed"] += 1
                results["errors"].append(f"Row {row_num}: Missing required fields: {', '.join(missing)}")
                continue
            
            dietary_tags = []
            if row.get('dietary_tags'):
                dietary_tags = [sanitize_csv_value(tag) for tag in row['dietary_tags'].split('|') if tag.strip()]
            
            valid_meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
            meal_type = row['meal_type']
            matched_type = next((t for t in valid_meal_types if t.lower() == meal_type.lower()), None)
            if not matched_type:
                results["failed"] += 1
                results["errors"].append(f"Row {row_num}: Invalid meal_type '{meal_type}'. Must be one of: {', '.join(valid_meal_types)}")
                continue
            
            # Parse date from various formats
            parsed_date = parse_date(row['date'])
            
            item = {
                "id": str(uuid.uuid4()),
                "name": row['name'],
                "description": row.get('description', ''),
                "meal_type": matched_type,
                "date": parsed_date,
                "dietary_tags": dietary_tags,
                "nutrition_info": row.get('nutrition_info', ''),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await tenant_db.menu.insert_one(item)
            results["success"] += 1
            results["items_created"].append({
                "name": item["name"],
                "meal_type": item["meal_type"],
                "date": item["date"]
            })
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"Row {row_num}: {str(e)}")
    
    return {
        "message": f"Processed {results['success'] + results['failed']} items",
        "success_count": results["success"],
        "failed_count": results["failed"],
        "errors": results["errors"][:20],
        "items_created": results["items_created"][:50]
    }


@router.get("/menu/csv-template")
async def get_menu_csv_template():
    """Get a sample CSV template for menu uploads"""
    return {
        "template": "name,description,meal_type,date,dietary_tags,nutrition_info",
        "example_rows": [
            "Scrambled Eggs,Fluffy scrambled eggs with herbs,Breakfast,2025-01-20,Vegetarian|Gluten-Free,250 cal",
            "Grilled Chicken Salad,Fresh greens with grilled chicken,Lunch,2025-01-20,Gluten-Free,350 cal",
            "Pasta Primavera,Penne with seasonal vegetables,Dinner,2025-01-20,Vegetarian,450 cal"
        ],
        "meal_types": ["Breakfast", "Lunch", "Dinner", "Snacks"],
        "dietary_tags": ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut-Free", "Halal", "Kosher"],
        "notes": [
            "date format: YYYY-MM-DD",
            "dietary_tags: separate multiple tags with | (pipe)",
            "meal_type must be one of: Breakfast, Lunch, Dinner, Snacks"
        ]
    }


@router.delete("/menu/clear-date/{date}")
async def clear_menu_for_date(
    date: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Clear all menu items for a specific date (admins only)"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await tenant_db.menu.delete_many({"date": date})
    
    return {
        "message": f"Cleared menu for {date}",
        "items_deleted": result.deleted_count
    }


from fastapi.responses import StreamingResponse


@router.get("/menu/export/csv")
async def export_dining_menu_csv(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Export all dining menu items as a CSV file"""
    tenant_db, current_user = tenant_data
    
    if current_user.role not in ['admin', 'super_admin', 'college_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    menu_items = await tenant_db.menu.find({}, {"_id": 0}).sort("date", 1).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["name", "description", "meal_type", "date", "dietary_tags", "nutrition_info"])
    
    for item in menu_items:
        # Convert dietary_tags list to pipe-separated string
        dietary_tags = item.get("dietary_tags", [])
        if isinstance(dietary_tags, list):
            dietary_tags = "|".join(dietary_tags)
        
        writer.writerow(sanitize_csv_row([
            item.get("name", ""),
            item.get("description", ""),
            item.get("meal_type", ""),
            item.get("date", ""),
            dietary_tags,
            item.get("nutrition_info", "")
        ]))
    
    output.seek(0)
    filename = f"dining_menu_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/late-meals", response_model=List[LateMealRequest])
async def get_late_meal_requests(tenant_data: tuple = Depends(get_tenant_db_for_user)):
    """Get late meal requests - Admin sees all, others see their own"""
    tenant_db, current_user = tenant_data
    
    is_admin = current_user.role in ['admin', 'super_admin']
    
    if is_admin:
        requests = await tenant_db.late_meals.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    else:
        requests = await tenant_db.late_meals.find(
            {"student_id": current_user.id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    
    for req in requests:
        if isinstance(req.get('created_at'), str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
    
    return requests


@router.post("/late-meals", response_model=LateMealRequest)
async def request_late_meal(
    request_data: LateMealRequestCreate, 
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Request a late meal"""
    tenant_db, current_user = tenant_data
    
    request = LateMealRequest(
        student_id=current_user.id,
        student_name=f"{current_user.first_name} {current_user.last_name}",
        meal_type=request_data.meal_type,
        date=request_data.date,
        reason=request_data.reason,
        dietary_requirements=request_data.dietary_requirements
    )
    
    req_doc = request.model_dump()
    req_doc['created_at'] = req_doc['created_at'].isoformat()
    await tenant_db.late_meals.insert_one(req_doc)
    
    return request


@router.put("/late-meals/{request_id}")
async def update_late_meal_request(
    request_id: str,
    request_data: LateMealRequestCreate,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Update a pending late meal request (only if status is pending)"""
    tenant_db, current_user = tenant_data
    
    existing = await tenant_db.late_meals.find_one({"id": request_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Late meal request not found")
    
    is_admin = current_user.role in ['admin', 'super_admin']
    if not is_admin and existing.get("student_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own requests")
    
    if existing.get("status", "pending") != "pending":
        raise HTTPException(status_code=400, detail="Can only update pending requests")
    
    await tenant_db.late_meals.update_one(
        {"id": request_id},
        {"$set": {
            "meal_type": request_data.meal_type,
            "date": request_data.date,
            "reason": request_data.reason,
            "dietary_requirements": request_data.dietary_requirements,
        }}
    )
    
    updated = await tenant_db.late_meals.find_one({"id": request_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return updated


@router.delete("/late-meals/{request_id}")
async def cancel_late_meal_request(
    request_id: str,
    tenant_data: tuple = Depends(get_tenant_db_for_user)
):
    """Cancel/delete a late meal request (only if status is pending)"""
    tenant_db, current_user = tenant_data
    
    existing = await tenant_db.late_meals.find_one({"id": request_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Late meal request not found")
    
    is_admin = current_user.role in ['admin', 'super_admin']
    if not is_admin and existing.get("student_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own requests")
    
    if existing.get("status", "pending") != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await tenant_db.late_meals.delete_one({"id": request_id})
    
    return {"message": "Late meal request cancelled"}
