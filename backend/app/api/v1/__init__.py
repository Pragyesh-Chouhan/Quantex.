"""API v1 router integration."""

from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.portfolio import router as portfolio_router
from app.api.v1.account import router as account_router
from app.api.v1.accounts import router as accounts_router
from app.api.v1.market import router as market_router
from app.api.v1.strategy import router as strategy_router
from app.api.v1.strategies import router as strategies_router
from app.api.v1.signals import router as signals_router
from app.api.v1.orders import router as orders_router
from app.api.v1.positions import router as positions_router
from app.api.v1.trades import router as trades_router
from app.api.v1.risk import router as risk_router
from app.api.v1.emergency import router as emergency_router
from app.api.v1.events import router as events_router
from app.api.v1.breakout_research import router as breakout_research_router
from app.api.v1.trend_research import router as trend_research_router
from app.api.v1.copilot import router as copilot_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(portfolio_router)
api_router.include_router(account_router)
api_router.include_router(accounts_router)
api_router.include_router(market_router)
api_router.include_router(strategy_router)
api_router.include_router(strategies_router)
api_router.include_router(signals_router)
api_router.include_router(orders_router)
api_router.include_router(positions_router)
api_router.include_router(trades_router)
api_router.include_router(risk_router)
api_router.include_router(emergency_router)
api_router.include_router(events_router)
api_router.include_router(breakout_research_router)
api_router.include_router(trend_research_router)
api_router.include_router(copilot_router)

__all__ = ["api_router"]
