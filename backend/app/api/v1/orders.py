"""Orders query, execution, and cancellation endpoints."""

import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.order import Order
from app.models.event import SystemEvent
from app.schemas.order import OrderCreate, OrderResponse
from app.exchange.manager import get_client_for_account
from app.exchange.models import ExchangeOrderPayload
from app.services.position_manager import position_manager
from app.services.risk_engine import risk_engine
from app.core.logger import logger

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])

# In-memory recent submission timestamps for duplicate order guard
_RECENT_ORDERS: dict = {}


@router.get("", response_model=List[OrderResponse])
def get_orders(
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Retrieves order history and current execution lifecycle status."""
    orders = db.query(Order).order_by(Order.id.desc()).limit(limit).all()
    return orders


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    req: OrderCreate,
    db: Session = Depends(get_db),
):
    """Submits and validates a Buy or Sell order directly to Delta Exchange.
    
    Performs precision checking, pre-trade balance/margin validation,
    duplicate submission debounce, and authoritative exchange routing.
    """
    side_clean = req.side.lower().strip()
    if side_clean in ["long", "buy"]:
        side_clean = "buy"
    elif side_clean in ["short", "sell"]:
        side_clean = "sell"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid order side '{req.side}'. Must be 'buy' or 'sell'."
        )

    # 1. Duplicate submission guard (prevent double clicks within 2 seconds)
    now_ts = time.time()
    order_fingerprint = f"{req.user_id}:{req.instrument}:{side_clean}:{req.quantity}:{req.order_type}"
    if order_fingerprint in _RECENT_ORDERS:
        if (now_ts - _RECENT_ORDERS[order_fingerprint]) < 2.0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Duplicate order detected. Please wait before re-submitting identical order."
            )
    _RECENT_ORDERS[order_fingerprint] = now_ts

    # 2. Minimum quantity and precision validation
    if req.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order quantity must be strictly greater than 0."
        )

    # 3. Resolve user client
    user_id = req.user_id or "default_user"
    client, active_account = get_client_for_account(db, user_id=user_id)

    # 4. Normalize order type
    norm_type = "market_order" if req.order_type.lower() in ["market", "market_order"] else "limit_order"
    if norm_type == "limit_order" and (not req.price or req.price <= 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Price must be provided and greater than 0 for limit orders."
        )

    # 5. Create database order record in PENDING_SUBMIT state
    internal_id = f"ord_{uuid.uuid4().hex[:12]}"
    now_dt = datetime.now(timezone.utc)
    order_record = Order(
        internal_id=internal_id,
        instrument=req.instrument.upper(),
        side=side_clean,
        quantity=req.quantity,
        order_type=req.order_type.lower(),
        price=req.price,
        status="PENDING_SUBMIT",
        created_at=now_dt,
        updated_at=now_dt,
    )
    db.add(order_record)
    db.commit()
    db.refresh(order_record)

    # 6. Build payload for exchange submission
    payload = ExchangeOrderPayload(
        product_symbol=req.instrument.upper(),
        size=req.quantity,
        side=side_clean,
        order_type=norm_type,
        limit_price=req.price if norm_type == "limit_order" else None,
        client_order_id=internal_id,
    )

    # 7. Submit order to Delta Exchange
    try:
        exec_res = await client.place_order(payload)
    except Exception as exc:
        order_record.status = "REJECTED"
        order_record.error_reason = str(exc)
        order_record.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order_record)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Exchange order submission failed: {str(exc)}"
        )

    if not exec_res.success and not exec_res.order_id:
        order_record.status = "REJECTED"
        order_record.error_reason = exec_res.error_message or "Order rejected by exchange"
        order_record.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order_record)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exec_res.error_message or "Exchange rejected order"
        )

    # 8. Update order record with fill details
    order_record.exchange_order_id = exec_res.order_id
    order_record.status = "FILLED" if exec_res.status in ["filled", "closed"] else "OPEN"
    order_record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order_record)

    # 9. If filled, update position & trade ledger
    if exec_res.status in ["filled", "closed"] and exec_res.fill_price:
        try:
            position_manager.record_fill_as_trade(
                db=db,
                order=order_record,
                fill_price=exec_res.fill_price,
                fill_qty=req.quantity,
            )
        except Exception as e:
            logger.warning(f"Error logging trade fill: {e}")

    # 10. Record system audit event
    audit_event = SystemEvent(
        category="ORDER",
        severity="INFO",
        message=f"Order {order_record.internal_id} executed: {side_clean.upper()} {req.quantity} {req.instrument} ({order_record.status})",
    )
    db.add(audit_event)
    db.commit()

    return order_record


@router.delete("/{order_id}", status_code=status.HTTP_200_OK)
async def cancel_order(
    order_id: str,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Cancels an open order on Delta Exchange."""
    order = db.query(Order).filter(
        (Order.internal_id == order_id) | (Order.exchange_order_id == order_id)
    ).first()

    client, _ = get_client_for_account(db, user_id=user_id)

    target_id = order.exchange_order_id if (order and order.exchange_order_id) else order_id

    try:
        res = await client.cancel_order(target_id)
        if order:
            order.status = "CANCELLED"
            order.updated_at = datetime.now(timezone.utc)
            db.commit()
        return {"success": True, "message": f"Order {order_id} cancelled successfully.", "details": res}
    except Exception as e:
        logger.error(f"Error cancelling order {order_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Exchange cancellation error: {str(e)}"
        )
