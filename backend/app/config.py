"""Centralized configuration management for QuantEX.

Loads settings from environment variables and .env file with validated defaults.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic import Field
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    from pydantic import BaseModel as BaseSettings
    SettingsConfigDict = None

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    if SettingsConfigDict:
        model_config = SettingsConfigDict(
            env_file=str(BASE_DIR / ".env"),
            env_file_encoding="utf-8",
            extra="ignore",
        )
    else:
        class Config:
            env_file = str(BASE_DIR / ".env")
            extra = "ignore"
    # Application Info
    APP_NAME: str = "QuantEX"
    APP_VERSION: str = "2.5.0"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Delta Exchange India (Official Endpoints)
    DELTA_INDIA_BASE_URL: str = "https://api.india.delta.exchange"
    DELTA_INDIA_WS_URL: str = "wss://public-socket.india.delta.exchange"
    DELTA_TESTNET_BASE_URL: str = "https://cdn-ind.testnet.deltaex.org"
    DELTA_TESTNET_WS_URL: str = "wss://socket-ind.testnet.deltaex.org"

    # Active Delta Configuration
    DELTA_API_KEY: str = Field(default="", description="Delta Exchange API Key")
    DELTA_API_SECRET: str = Field(default="", description="Delta Exchange API Secret")
    DELTA_BASE_URL: str = "https://api.india.delta.exchange"
    DELTA_WS_URL: str = "wss://public-socket.india.delta.exchange"
    USE_LIVE_TESTNET: bool = False

    # Secondary Exchange - Binance Spot
    BINANCE_BASE_URL: str = "https://api.binance.com"
    BINANCE_WS_URL: str = "wss://stream.binance.com:9443/ws"

    # Instrument and Strategy Parameters
    DEFAULT_INSTRUMENT: str = "BTCUSD"
    DEFAULT_TIMEFRAME: str = "5m"
    FAST_EMA_PERIOD: int = 9
    SLOW_EMA_PERIOD: int = 21
    CANDLE_LIMIT: int = 100
    MAX_DATA_AGE_SECONDS: int = 300

    # Risk Management Limits
    MAX_ORDER_QTY: float = 0.05
    MAX_POSITION_EXPOSURE: float = 0.20
    MAX_OPEN_ORDERS: int = 3
    DAILY_LOSS_LIMIT: float = 500.0
    STOP_LOSS_PCT: float = 0.02
    TAKE_PROFIT_PCT: float = 0.04
    DEFAULT_ORDER_TYPE: str = "market"

    # Execution Engine & Loop
    TRADING_LOOP_INTERVAL_SECONDS: float = 5.0
    ORDER_TIMEOUT_SECONDS: float = 15.0
    RECONCILE_INTERVAL_SECONDS: float = 15.0

    # Persistence
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'tokeniq.db'}"


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
