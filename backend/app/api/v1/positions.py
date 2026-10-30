"""Positions query, tracking, and close position endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.position import Position
from app.schemas.position import PositionResponse
from app.services.position_manager import position_manager
from app.exchange.manager import get_client_for_account

router = APIRouter(prefix="/api/v1/positions", tags=["Positions"])


class ClosePositionRequest(BaseModel):
    instrument: str
    user_id: Optional[str] = "default_user"


@router.get("", response_model=List[PositionResponse])
async def get_positions(
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Retrieves current open positions, entry prices, mark prices, and P&L."""
    client, _ = get_client_for_account(db, user_id=user_id)
    await position_manager.synchronize_positions(db, client=client)
    positions = db.query(Position).all()
    return positions


@router.post("/close")
async def close_position(
    req: ClosePositionRequest,
    db: Session = Depends(get_db),
):
    """Authoritatively closes an open position on the connected exchange and realizes P&L."""
    client, _ = get_client_for_account(db, user_id=req.user_id or "default_user")
    result = await position_manager.close_position(db, instrument=req.instrument, client=client)
    if not result.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Failed to close position"),
        )
    return result


@router.post("/{instrument}/close")
async def close_position_by_param(
    instrument: str,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Authoritatively closes an open position by symbol on the connected exchange."""
    client, _ = get_client_for_account(db, user_id=user_id)
    result = await position_manager.close_position(db, instrument=instrument, client=client)
    if not result.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Failed to close position"),
        )
    return result
