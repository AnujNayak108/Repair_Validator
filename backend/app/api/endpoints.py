from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import time
import traceback

from ..core.database import get_db, SessionLocal
from ..models.estimate import Estimate as DBEstimate, LineItem as DBLineItem, FlaggedItem as DBFlaggedItem
from ..schemas.estimate import Estimate, EstimateCreate
from ..services.pdf_service import extract_text_from_pdf
from ..services.ai_service import parse_estimate_text, validate_estimate

router = APIRouter()

def process_estimate_background(estimate_id: int, file_bytes: bytes, impact_zone: str):
    db: Session = SessionLocal()
    try:
        # 1. Extract Text
        raw_text = extract_text_from_pdf(file_bytes)
        if not raw_text:
            db_estimate = db.query(DBEstimate).filter(DBEstimate.id == estimate_id).first()
            if db_estimate:
                db_estimate.status = "failed_extraction"
                db.commit()
            return

        # 2. AI Parsing
        parsed_data = parse_estimate_text(raw_text)
        
        db_estimate = db.query(DBEstimate).filter(DBEstimate.id == estimate_id).first()
        if not db_estimate:
            return
            
        db_estimate.total_amount = parsed_data.get("total_amount")
        db_estimate.vehicle_year = parsed_data.get("vehicle_year")
        db_estimate.vehicle_make = parsed_data.get("vehicle_make")
        db_estimate.vehicle_model = parsed_data.get("vehicle_model")
        
        line_items_data = parsed_data.get("line_items", [])
        
        for item in line_items_data:
            db_item = DBLineItem(
                estimate_id=estimate_id,
                part_name=item.get("part_name", "Unknown Part"),
                part_number=item.get("part_number"),
                quantity=item.get("quantity", 1),
                unit_price=item.get("unit_price", 0.0),
                labor_hours=item.get("labor_hours", 0.0),
                operation_type=item.get("operation_type", "Repair")
            )
            db.add(db_item)
            
        db.commit()

        # 3. AI Validation
        line_items_for_ai = []
        for i, item in enumerate(line_items_data):
            line_items_for_ai.append({
                "index": i,
                "part_name": item.get("part_name"),
                "operation_type": item.get("operation_type")
            })

        flags = validate_estimate(line_items_for_ai, impact_zone)
        
        # Reload line items to get their DB IDs (ordered to match AI indices)
        db_line_items = db.query(DBLineItem).filter(DBLineItem.estimate_id == estimate_id).order_by(DBLineItem.id).all()
        
        for flag in flags:
            idx = flag.get("line_item_index")
            if idx is not None and 0 <= idx < len(db_line_items):
                db_flag = DBFlaggedItem(
                    line_item_id=db_line_items[idx].id,
                    issue_type=flag.get("issue_type", "Unknown"),
                    explanation=flag.get("reason", ""),
                    confidence_score=flag.get("confidence", 50),
                    severity=flag.get("severity", "Medium")
                )
                db.add(db_flag)
                
        db_estimate.status = "completed"
        db.commit()
    except Exception as e:
        print(f"Error in process_estimate_background: {e}")
        print(traceback.format_exc())
        db.rollback()
        db_estimate = db.query(DBEstimate).filter(DBEstimate.id == estimate_id).first()
        if db_estimate:
            db_estimate.status = "failed_processing"
            db.commit()
    finally:
        db.close()


@router.post("/estimates/upload", response_model=Estimate)
async def upload_estimate(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    impact_zone: str = Form(...),
    db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail=f"Only PDF files are supported. Received: {file.filename}")
        
    file_bytes = await file.read()
    
    # Create Estimate entry
    db_estimate = DBEstimate(
        filename=file.filename,
        impact_zone=impact_zone,
        status="processing"
    )
    db.add(db_estimate)
    db.commit()
    db.refresh(db_estimate)
    
    # Process in background using a fresh DB session (not the request session)
    background_tasks.add_task(process_estimate_background, db_estimate.id, file_bytes, impact_zone)
    
    return db_estimate

@router.get("/estimates/{estimate_id}", response_model=Estimate)
def get_estimate(estimate_id: int, db: Session = Depends(get_db)):
    estimate = db.query(DBEstimate).filter(DBEstimate.id == estimate_id).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return estimate

@router.get("/estimates", response_model=List[Estimate])
def get_estimates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    estimates = db.query(DBEstimate).offset(skip).limit(limit).all()
    return estimates
