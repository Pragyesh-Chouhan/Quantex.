"""Ensures all genuine strategies across Day, 1 Month, 3 Months, and 1 Year are imported and registered."""
import logging
from app.strategies.registry import strategy_registry

# Import all strategy modules to trigger @strategy_registry.register
from app.strategies import (
    core_quant_strategies,   # 7 Prioritized Core Quantitative Strategies
    day_strategies,          # 6 Day strategies
    trend_following,         # 1 Month strategy 1
    liquidity_sweep,         # 1 Month strategy 2
    breakout_retest,         # 1 Month strategy 3
    mean_reversion,          # 1 Month strategy 4
    momentum,                # 1 Month strategy 5
    volume_confirmed_vwap,   # 1 Month strategy 6
    supertrend_ema_3m,       # 3 Months strategy 1
    year_strategies,         # 5 1-Year strategies
)

logger = logging.getLogger("QuantEX")


def load_all_strategies():
    """Call on startup to ensure all strategies are registered."""
    strategies = strategy_registry.list_strategies()
    logger.info(f"Loaded {len(strategies)} registered strategies across 4 timeframes.")
    return strategies
