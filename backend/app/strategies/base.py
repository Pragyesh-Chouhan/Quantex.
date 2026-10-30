"""Base strategy interface for QuantEX strategy plugin architecture."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import pandas as pd


@dataclass
class StrategySignalResult:
    """Standardized signal output from any strategy."""
    strategy_id: str
    strategy_version: str
    instrument: str
    timeframe: str
    candle_timestamp: int
    signal_type: str  # BUY, SELL, HOLD, OPEN_LONG, CLOSE_LONG, OPEN_SHORT, CLOSE_SHORT
    reason: str
    close_price: float
    indicators: Dict[str, float] = field(default_factory=dict)
    signal_id: str = ""
    generated_at: str = ""

    def __post_init__(self):
        if not self.signal_id:
            self.signal_id = (
                f"sig_{self.strategy_id}_{self.instrument}_{self.timeframe}"
                f"_{self.candle_timestamp}_{self.signal_type.lower()}"
            )
        if not self.generated_at:
            self.generated_at = datetime.now(timezone.utc).isoformat()


@dataclass
class StrategyConfig:
    """Typed, validated per-strategy configuration."""
    enabled: bool = False
    instrument: str = "BTCUSD"
    timeframe: str = "5m"
    extra: Dict[str, Any] = field(default_factory=dict)


class BaseStrategy(ABC):
    """Abstract base for all QuantEX trading strategies."""

    # Subclasses define these class attributes
    STRATEGY_ID: str = ""
    STRATEGY_NAME: str = ""
    STRATEGY_VERSION: str = "1.0.0"
    DESCRIPTION: str = ""
    CATEGORY: str = "1 Month"  # "Day", "1 Month", "3 Months", "1 Year"
    TIMEFRAME: str = "1h"       # "1D", "1h", "4h", "5m"
    EVALUATION_WINDOW: str = "1 Month"
    HOLDING_HORIZON: str = "Swing (Hours to Days)"
    SUPPORTED_INSTRUMENTS: List[str] = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self._config = config or {}
        self._enabled = False
        self.validate_config(self._config)

    @abstractmethod
    def validate_config(self, config: Dict[str, Any]) -> None:
        """Validate strategy parameters. Raise ValueError if invalid."""
        pass

    @abstractmethod
    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute strategy indicators and add them as columns to df."""
        pass

    @abstractmethod
    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str,
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        """Generate a signal from the indicator-enriched DataFrame."""
        pass

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "strategy_id": self.STRATEGY_ID,
            "strategy_name": self.STRATEGY_NAME,
            "strategy_version": self.STRATEGY_VERSION,
            "description": self.DESCRIPTION,
            "category": self.CATEGORY,
            "timeframe": self.TIMEFRAME,
            "evaluation_window": self.EVALUATION_WINDOW,
            "holding_horizon": self.HOLDING_HORIZON,
            "supported_instruments": self.SUPPORTED_INSTRUMENTS,
            "enabled": self._enabled,
            "config": self._config,
        }

    def enable(self) -> None:
        self._enabled = True

    def disable(self) -> None:
        self._enabled = False

    @property
    def is_enabled(self) -> bool:
        return self._enabled
