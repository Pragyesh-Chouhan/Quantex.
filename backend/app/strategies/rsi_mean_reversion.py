"""RSI Mean Reversion Strategy — QuantEX strategy plugin.

Generates BUY when RSI recovers from oversold conditions and SELL when RSI
reaches overbought territory. Long-only policy. Uses Wilder's smoothing.
"""
from typing import Optional, Dict, Any
import pandas as pd

from app.strategies.base import BaseStrategy, StrategySignalResult
from app.strategies.registry import StrategyRegistry


@StrategyRegistry.register
class RSIMeanReversionStrategy(BaseStrategy):
    """RSI Mean Reversion — oversold BUY / overbought SELL, long-only."""

    STRATEGY_ID = "rsi_mean_reversion"
    STRATEGY_NAME = "RSI Mean Reversion"
    STRATEGY_VERSION = "1.0.0"
    DESCRIPTION = (
        "Buys when RSI recovers from oversold conditions and sells when RSI "
        "reaches overbought territory. Long-only. Uses Wilder's smoothing (EWM)."
    )

    def validate_config(self, config: Dict[str, Any]) -> None:
        rsi_period = int(config.get("rsi_period", 14))
        if not (2 <= rsi_period <= 100):
            raise ValueError(f"rsi_period must be 2–100, got {rsi_period}")

        oversold = float(config.get("oversold_threshold", 30))
        overbought = float(config.get("overbought_threshold", 70))
        if not (10 <= oversold <= 45):
            raise ValueError(f"oversold_threshold must be 10–45, got {oversold}")
        if not (55 <= overbought <= 90):
            raise ValueError(f"overbought_threshold must be 55–90, got {overbought}")
        if oversold >= overbought:
            raise ValueError(
                f"oversold_threshold ({oversold}) must be less than overbought_threshold ({overbought})"
            )

        recovery_candles = int(config.get("recovery_candles", 1))
        if not (1 <= recovery_candles <= 5):
            raise ValueError(f"recovery_candles must be 1–5, got {recovery_candles}")

        trend_ema_period = int(config.get("trend_ema_period", 50))
        if not (2 <= trend_ema_period <= 500):
            raise ValueError(f"trend_ema_period must be 2–500, got {trend_ema_period}")

    @property
    def rsi_period(self) -> int:
        return int(self._config.get("rsi_period", 14))

    @property
    def oversold_threshold(self) -> float:
        return float(self._config.get("oversold_threshold", 30))

    @property
    def overbought_threshold(self) -> float:
        return float(self._config.get("overbought_threshold", 70))

    @property
    def recovery_candles(self) -> int:
        return int(self._config.get("recovery_candles", 1))

    @property
    def use_trend_filter(self) -> bool:
        return bool(self._config.get("use_trend_filter", False))

    @property
    def trend_ema_period(self) -> int:
        return int(self._config.get("trend_ema_period", 50))

    def _compute_rsi(self, close: pd.Series) -> pd.Series:
        """Compute RSI using Wilder's smoothing (EWM with alpha=1/period, adjust=False)."""
        import numpy as np
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        alpha = 1.0 / self.rsi_period
        avg_gain = gain.ewm(alpha=alpha, adjust=False).mean()
        avg_loss = loss.ewm(alpha=alpha, adjust=False).mean()
        # Handle zero gain / zero loss properly
        rs = np.where(avg_loss == 0, np.where(avg_gain == 0, 1.0, np.inf), avg_gain / avg_loss)
        rsi = np.where(np.isinf(rs), 100.0, 100.0 - (100.0 / (1.0 + rs)))
        return pd.Series(rsi, index=close.index).fillna(50.0)

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute RSI and optionally trend EMA."""
        if df.empty or len(df) < self.rsi_period + 1:
            return df
        data = df.copy()
        data["rsi"] = self._compute_rsi(data["close"])
        if self.use_trend_filter:
            data["trend_ema"] = data["close"].ewm(
                span=self.trend_ema_period, adjust=False
            ).mean()
        return data

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "5m",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        """Generate BUY (oversold recovery) or SELL (overbought) signal."""
        min_rows = self.rsi_period + self.recovery_candles + 2
        if df.empty or len(df) < min_rows:
            return None

        data = self.compute_indicators(df)

        if "rsi" not in data.columns:
            return None

        curr = data.iloc[-1]
        prev = data.iloc[-2]
        curr_rsi = float(curr["rsi"])
        prev_rsi = float(prev["rsi"])
        curr_price = float(curr["close"])
        candle_ts = int(curr["time"])

        # Trend filter: price above trend EMA required for BUY
        trend_ok = True
        if self.use_trend_filter and "trend_ema" in data.columns:
            trend_ema_val = float(curr["trend_ema"])
            trend_ok = curr_price > trend_ema_val

        signal_type = "HOLD"
        reason = "RSI in neutral zone"

        # BUY: RSI was oversold and has recovered above oversold threshold
        if (
            not has_open_long
            and prev_rsi <= self.oversold_threshold
            and curr_rsi > self.oversold_threshold
            and trend_ok
        ):
            signal_type = "BUY"
            reason = (
                f"RSI recovered from oversold: prev_rsi={prev_rsi:.2f} "
                f"-> curr_rsi={curr_rsi:.2f} (threshold={self.oversold_threshold})"
            )

        # SELL: RSI overbought or already crossed below overbought from above
        elif has_open_long and (
            curr_rsi >= self.overbought_threshold
            or (prev_rsi >= self.overbought_threshold and curr_rsi < self.overbought_threshold)
        ):
            signal_type = "SELL"
            reason = (
                f"RSI overbought exit: curr_rsi={curr_rsi:.2f} "
                f"(threshold={self.overbought_threshold})"
            )

        indicators: Dict[str, float] = {
            "rsi": round(curr_rsi, 4),
            "rsi_prev": round(prev_rsi, 4),
        }
        if self.use_trend_filter and "trend_ema" in data.columns:
            indicators["trend_ema"] = round(float(curr["trend_ema"]), 4)

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
