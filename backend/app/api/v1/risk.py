"""Risk management status, controls, and Emergency Kill Switch endpoints for QuantEX."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.config import settings
from app.core.state import runtime_state
from app.core.logger import logger
from app.database import get_db
from app.models.order import Order
from app.models.position import Position
from app.models.event import SystemEvent
from app.services.trading_loop import trading_loop

router = APIRouter(prefix="/api/v1/risk", tags=["Risk Management"])


class RiskLimitsUpdate(BaseModel):
    max_order_qty: Optional[float] = Field(None, gt=0, le=10.0)
    max_position_exposure: Optional[float] = Field(None, gt=0, le=1.0)
    max_open_orders: Optional[int] = Field(None, ge=1, le=50)
    daily_loss_limit: Optional[float] = Field(None, gt=0)
    stop_loss_pct: Optional[float] = Field(None, gt=0, le=0.5)
    take_profit_pct: Optional[float] = Field(None, gt=0, le=1.0)


class KillSwitchRequest(BaseModel):
    reason: str = Field(default="Manual Operator Kill Switch Activation", min_length=3)
    cancel_orders: bool = True


@router.get("/status")
def get_risk_status(db: Session = Depends(get_db)):
    """Returns active risk management limits and real-time live exposure metrics."""
    open_orders_count = db.query(Order).filter(
        Order.status.in_(["PENDING_SUBMIT", "SUBMITTED", "OPEN", "PARTIALLY_FILLED", "RECONCILING"])
    ).count()

    positions = db.query(Position).all()
    current_exposure = sum(abs(p.size) for p in positions)

    return {
        "emergency_stop": runtime_state.emergency_stop,
        "emergency_stop_reason": runtime_state.emergency_stop_reason,
        "limits": {
            "max_order_qty": settings.MAX_ORDER_QTY,
            "max_position_exposure": settings.MAX_POSITION_EXPOSURE,
            "max_open_orders": settings.MAX_OPEN_ORDERS,
            "daily_loss_limit": settings.DAILY_LOSS_LIMIT,
            "stop_loss_pct": settings.STOP_LOSS_PCT,
            "take_profit_pct": settings.TAKE_PROFIT_PCT,
        },
        "live_metrics": {
            "current_exposure": round(current_exposure, 4),
            "open_orders_count": open_orders_count,
            "daily_realized_pnl": round(runtime_state.daily_realized_pnl, 2),
            "loss_limit_breached": runtime_state.daily_realized_pnl <= -settings.DAILY_LOSS_LIMIT,
            "signals_risk_approved": runtime_state.metrics.get("signals_risk_approved", 0),
            "signals_risk_rejected": runtime_state.metrics.get("signals_risk_rejected", 0),
        },
    }


@router.post("/kill-switch")
def trigger_kill_switch(
    req: KillSwitchRequest,
    db: Session = Depends(get_db),
):
    """Emergency Kill Switch: instantly halts strategy execution and cancels eligible pending orders."""
    runtime_state.emergency_stop = True
    runtime_state.emergency_stop_reason = req.reason
    trading_loop.stop()

    cancelled_count = 0
    if req.cancel_orders:
        pending_orders = db.query(Order).filter(
            Order.status.in_(["PENDING_SUBMIT", "SUBMITTED", "OPEN"])
        ).all()
        for o in pending_orders:
            o.status = "CANCELLED"
            cancelled_count += 1

    event = SystemEvent(
        category="EMERGENCY",
        severity="CRITICAL",
        message=f"KILL SWITCH TRIGGERED: {req.reason}. Suspended loop and cancelled {cancelled_count} orders.",
    )
    db.add(event)
    db.commit()

    logger.warning(f"KILL SWITCH ACTIVATED: {req.reason}. Cancelled orders: {cancelled_count}")
    return {
        "success": True,
        "emergency_stop": True,
        "reason": req.reason,
        "cancelled_orders_count": cancelled_count,
        "message": "Emergency Kill Switch activated. All algorithmic execution halted.",
    }


@router.post("/reset")
def reset_kill_switch(db: Session = Depends(get_db)):
    """Resets the Emergency Kill Switch, allowing strategy execution to be safely resumed."""
    runtime_state.emergency_stop = False
    runtime_state.emergency_stop_reason = ""

    event = SystemEvent(
        category="EMERGENCY",
        severity="INFO",
        message="Kill Switch disengaged. Risk state normal.",
    )
    db.add(event)
    db.commit()

    logger.info("Kill Switch disengaged by operator.")
    return {
        "success": True,
        "emergency_stop": False,
        "message": "Kill Switch disengaged. Algorithmic execution can now be resumed.",
    }


@router.post("/limits")
def update_risk_limits(
    req: RiskLimitsUpdate,
    db: Session = Depends(get_db),
):
    """Updates dynamic risk thresholds."""
    if req.max_order_qty is not None:
        settings.MAX_ORDER_QTY = req.max_order_qty
    if req.max_position_exposure is not None:
        settings.MAX_POSITION_EXPOSURE = req.max_position_exposure
    if req.max_open_orders is not None:
        settings.MAX_OPEN_ORDERS = req.max_open_orders
    if req.daily_loss_limit is not None:
        settings.DAILY_LOSS_LIMIT = req.daily_loss_limit
    if req.stop_loss_pct is not None:
        settings.STOP_LOSS_PCT = req.stop_loss_pct
    if req.take_profit_pct is not None:
        settings.TAKE_PROFIT_PCT = req.take_profit_pct

    event = SystemEvent(
        category="RISK_LIMIT",
        severity="INFO",
        message=f"Risk parameters updated: Loss Limit=${settings.DAILY_LOSS_LIMIT}, Max Exposure={settings.MAX_POSITION_EXPOSURE*100}%",
    )
    db.add(event)
    db.commit()

    return {
        "success": True,
        "message": "Risk parameters updated successfully.",
        "limits": {
            "max_order_qty": settings.MAX_ORDER_QTY,
            "max_position_exposure": settings.MAX_POSITION_EXPOSURE,
            "max_open_orders": settings.MAX_OPEN_ORDERS,
            "daily_loss_limit": settings.DAILY_LOSS_LIMIT,
            "stop_loss_pct": settings.STOP_LOSS_PCT,
            "take_profit_pct": settings.TAKE_PROFIT_PCT,
        },
    }
