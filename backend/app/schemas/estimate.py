from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class FlaggedItemBase(BaseModel):
    issue_type: str
    confidence_score: int
    explanation: str
    severity: str

class FlaggedItem(FlaggedItemBase):
    id: int
    line_item_id: int

    class Config:
        from_attributes = True

class LineItemBase(BaseModel):
    part_name: str
    part_number: Optional[str] = None
    quantity: int = 1
    unit_price: float = 0.0
    labor_hours: float = 0.0
    operation_type: str

class LineItem(LineItemBase):
    id: int
    estimate_id: int
    flags: List[FlaggedItem] = []

    class Config:
        from_attributes = True

class EstimateBase(BaseModel):
    filename: str
    total_amount: Optional[float] = None
    vehicle_year: Optional[int] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    impact_zone: Optional[str] = None

class EstimateCreate(EstimateBase):
    pass

class Estimate(EstimateBase):
    id: int
    status: str
    created_at: datetime
    line_items: List[LineItem] = []

    class Config:
        from_attributes = True
