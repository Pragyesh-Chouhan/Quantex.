"""EMA Crossover Strategy — QuantEX strategy plugin.

Implements a Golden Cross / Death Cross EMA crossover strategy with an optional
trend filter and ATR-based stop multiplier. Long-only position policy.
"""
from typing import Optional, Dict, Any
import pandas as pd

from app.strategies.base import BaseStrategy, StrategySignalResult
from app.strategies.registry import StrategyRegistry


@StrategyRegistry.register
class EMACrossoverStrategy(BaseStrategy):
    """EMA Crossover strategy (Golden Cross / Death Cross), long-only."""

    STRATEGY_ID = "ema_crossover"
    STRATEGY_NAME = "EMA Crossover"
    STRATEGY_VERSION = "1.0.0"
    DESCRIPTION = (
        "Generates BUY on golden cross (fast EMA crosses above slow EMA) and "
        "SELL on death cross (fast EMA crosses below slow EMA). Long-only policy."
    )

    def validate_config(self, config: Dict[str, Any]) -> None:
        fast = int(config.get("fast_period", 9))
        slow = int(config.get("slow_period", 21))
        if not (2 <= fast <= 50):
            raise ValueError(f"fast_period must be 2–50, got {fast}")
        if not (fast + 1 <= slow <= 200):
            raise ValueError(f"slow_period must be fast_period+1 to 200, got {slow}")
        atr_mul = float(config.get("atr_stop_multiplier", 2.0))
        if not (0.1 <= atr_mul <= 10.0):
            raise ValueError(f"atr_stop_multiplier must be 0.1–10.0, got {atr_mul}")

    @property
    def fast_period(self) -> int:
        return int(self._config.get("fast_period", 9))

    @property
    def slow_period(self) -> int:
        return int(self._config.get("slow_period", 21))

    @property
    def use_trend_filter(self) -> bool:
        return bool(self._config.get("use_trend_filter", False))

    @property
    def atr_stop_multiplier(self) -> float:
        return float(self._config.get("atr_stop_multiplier", 2.0))

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute fast EMA, slow EMA, and optionally ATR."""
        if df.empty or len(df) < self.slow_period:
            return df
        data = df.copy()
        data["fast_ema"] = data["close"].ewm(span=self.fast_period, adjust=False).mean()
        data["slow_ema"] = data["close"].ewm(span=self.slow_period, adjust=False).mean()
        # ATR (14-period)
        if len(data) >= 2:
            high_low = data["high"] - data["low"]
            high_close = (data["high"] - data["close"].shift()).abs()
            low_close = (data["low"] - data["close"].shift()).abs()
            true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            data["atr"] = true_range.ewm(span=14, adjust=False).mean()
        return data

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "5m",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        """Generate a BUY, SELL, or HOLD signal based on EMA crossover."""
        min_rows = self.slow_period + 2
        if df.empty or len(df) < min_rows:
            return None

        data = self.compute_indicators(df)

        if "fast_ema" not in data.columns or "slow_ema" not in data.columns:
            return None

        prev = data.iloc[-2]
        curr = data.iloc[-1]

        prev_fast = float(prev["fast_ema"])
        prev_slow = float(prev["slow_ema"])
        curr_fast = float(curr["fast_ema"])
        curr_slow = float(curr["slow_ema"])
        curr_price = float(curr["close"])
        candle_ts = int(curr["time"])
        atr = float(curr.get("atr", 0.0)) if "atr" in curr.index else 0.0

        signal_type = "HOLD"
        reason = "No crossover detected"

        # Golden Cross — BUY
        if prev_fast <= prev_slow and curr_fast > curr_slow:
            if not has_open_long:
                signal_type = "BUY"
                reason = f"Golden cross: fast_ema({curr_fast:.2f}) crossed above slow_ema({curr_slow:.2f})"
            else:
                signal_type = "HOLD"
                reason = "Golden cross detected but long position already open"

        # Death Cross — SELL (close long)
        elif prev_fast >= prev_slow and curr_fast < curr_slow:
            if has_open_long:
                signal_type = "SELL"
                reason = f"Death cross: fast_ema({curr_fast:.2f}) crossed below slow_ema({curr_slow:.2f})"
            else:
                signal_type = "HOLD"
                reason = "Death cross detected but no open long to close"

        indicators: Dict[str, float] = {
            "fast_ema": round(curr_fast, 4),
            "slow_ema": round(curr_slow, 4),
        }
        if atr > 0:
            indicators["atr"] = round(atr, 4)
            indicators["atr_stop"] = round(curr_price - self.atr_stop_multiplier * atr, 4)

        return StrategySignalResult(
            strategy_id=self.STRATEGY_ID,
            strategy_version=self.STRATEGY_VERSION,
            instrument=instrument,
            timeframe=timeframe,
            candle_timestamp=candle_ts,
            signal_type=signal_type,
            reason=reason,
            close_price=curr_price,
            indicators=indicators,
        )
