"""System Events and immutable audit trail endpoints for QuantEX."""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.event import SystemEvent
from app.schemas.event import SystemEventResponse

router = APIRouter(prefix="/api/v1/events", tags=["System Events & Audit Trail"])


class AuditLogEntry(BaseModel):
    category: str = Field(default="USER_ACTION", description="Event category e.g. AUTH, RISK_LIMIT, EXCHANGE, KILL_SWITCH")
    severity: str = Field(default="INFO", description="INFO, WARNING, or CRITICAL")
    message: str = Field(..., min_length=3)
    details: Optional[str] = None


@router.get("", response_model=List[SystemEventResponse])
def get_events(
    category: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieves operational system audit logs with optional search filtering."""
    query = db.query(SystemEvent)
    if category:
        query = query.filter(SystemEvent.category == category.upper())
    if severity:
        query = query.filter(SystemEvent.severity == severity.upper())
    if search:
        query = query.filter(SystemEvent.message.ilike(f"%{search}%"))

    events = query.order_by(SystemEvent.id.desc()).limit(limit).all()
    return events


@router.post("/record", response_model=SystemEventResponse, status_code=status.HTTP_201_CREATED)
def record_audit_event(
    entry: AuditLogEntry,
    db: Session = Depends(get_db),
):
    """Appends an immutable audit event to the system event ledger."""
    event = SystemEvent(
        category=entry.category.upper(),
        severity=entry.severity.upper(),
        message=entry.message,
        details=entry.details,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/summary")
def get_audit_summary(db: Session = Depends(get_db)):
    """Returns high-level distribution of audit events."""
    total = db.query(SystemEvent).count()
    critical = db.query(SystemEvent).filter(SystemEvent.severity == "CRITICAL").count()
    warning = db.query(SystemEvent).filter(SystemEvent.severity == "WARNING").count()
    info = db.query(SystemEvent).filter(SystemEvent.severity == "INFO").count()

    return {
        "total_audit_events": total,
        "critical_events": critical,
        "warning_events": warning,
        "info_events": info,
    }
