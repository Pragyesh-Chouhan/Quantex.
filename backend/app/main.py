"""Main FastAPI application entry point for QuantEX Algorithmic Trading Platform."""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.logger import logger
from app.core.state import runtime_state
from app.database import init_db, SessionLocal
from app.api.v1 import api_router
from app.api.aliases import router as aliases_router
from app.exchange.client import exchange_client
from app.services.position_manager import position_manager
from app.services.trading_loop import trading_loop

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager handling startup connectivity verification and clean shutdown."""
    logger.info(f"Initializing {settings.APP_NAME} v{settings.APP_VERSION} ({settings.APP_ENV})...")

    # 1. Initialize SQLite Database Tables
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    # 2. Verify Exchange Connectivity Gate
    try:
        connected = await exchange_client.ping_connectivity()
        runtime_state.set_exchange_status(connected)
        logger.info(f"Initial exchange connectivity check: {'CONNECTED' if connected else 'DISCONNECTED'}")
    except Exception as e:
        logger.warning(f"Could not connect to exchange during startup: {e}")
        runtime_state.set_exchange_status(False, str(e))

    # 3. Synchronize Initial Positions
    try:
        db = SessionLocal()
        await position_manager.synchronize_positions(db)
        db.close()
        logger.info("Initial position reconciliation complete.")
    except Exception as e:
        logger.warning(f"Initial position synchronization failed: {e}")

    yield

    # Clean Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}...")
    trading_loop.stop()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="QuantEX — Real-Time Crypto Algorithmic Trading & Quantitative Research Platform",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files & Web Dashboard
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
def serve_dashboard():
    """Serves the live interactive dashboard."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "QuantEX API Running. Visit /docs for Swagger UI."}


# Mount API Routes
app.include_router(api_router)
app.include_router(aliases_router)
