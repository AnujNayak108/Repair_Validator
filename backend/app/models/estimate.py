from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base

class Estimate(Base):
    __tablename__ = "estimates"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    total_amount = Column(Float, nullable=True)
    vehicle_year = Column(Integer, nullable=True)
    vehicle_make = Column(String, nullable=True)
    vehicle_model = Column(String, nullable=True)
    impact_zone = Column(String, nullable=True)
    status = Column(String, default="processing")
    created_at = Column(DateTime, default=datetime.utcnow)

    line_items = relationship("LineItem", back_populates="estimate")

class LineItem(Base):
    __tablename__ = "line_items"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("estimates.id"))
    part_name = Column(String)
    part_number = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    labor_hours = Column(Float, default=0.0)
    operation_type = Column(String) # Repair, Replace, Paint

    estimate = relationship("Estimate", back_populates="line_items")
    flags = relationship("FlaggedItem", back_populates="line_item")

class FlaggedItem(Base):
    __tablename__ = "flagged_items"

    id = Column(Integer, primary_key=True, index=True)
    line_item_id = Column(Integer, ForeignKey("line_items.id"))
    issue_type = Column(String) # duplicate, unrelated, inflated
    confidence_score = Column(Integer) # 1-100
    explanation = Column(String)
    severity = Column(String) # High, Medium, Low

    line_item = relationship("LineItem", back_populates="flags")
