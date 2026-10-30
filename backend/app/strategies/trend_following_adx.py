"""Trend Following with ADX and EMA Strategy — QuantEX strategy plugin.

Identifies strong trends using the Average Directional Index (ADX) combined with
+DI/-DI directional indicators and an EMA trend filter. Generates BUY on strong bullish
momentum and SELL on trend exhaustion or bearish reversal. Long-only policy.
"""
from typing import Optional, Dict, Any
import numpy as np
import pandas as pd

from app.strategies.base import BaseStrategy, StrategySignalResult
from app.strategies.registry import StrategyRegistry


@StrategyRegistry.register
class TrendFollowingADXStrategy(BaseStrategy):
    """Trend Following using ADX, +DI/-DI, and EMA trend filter (Long-only)."""

    STRATEGY_ID = "trend_following_adx"
    STRATEGY_NAME = "Trend Following (ADX + EMA)"
    STRATEGY_VERSION = "1.0.0"
    DESCRIPTION = (
        "Identifies strong trends using Average Directional Index (ADX) and +DI/-DI "
        "directional movement coupled with an EMA trend filter. Long-only policy."
    )

    def validate_config(self, config: Dict[str, Any]) -> None:
        adx_period = int(config.get("adx_period", 14))
        if not (5 <= adx_period <= 50):
            raise ValueError(f"adx_period must be 5–50, got {adx_period}")

        adx_threshold = float(config.get("adx_threshold", 25.0))
        if not (15.0 <= adx_threshold <= 50.0):
            raise ValueError(f"adx_threshold must be 15.0–50.0, got {adx_threshold}")

        ema_trend_period = int(config.get("ema_trend_period", 50))
        if not (10 <= ema_trend_period <= 200):
            raise ValueError(f"ema_trend_period must be 10–200, got {ema_trend_period}")

        atr_stop_multiplier = float(config.get("atr_stop_multiplier", 2.0))
        if not (0.5 <= atr_stop_multiplier <= 5.0):
            raise ValueError(f"atr_stop_multiplier must be 0.5–5.0, got {atr_stop_multiplier}")

    @property
    def adx_period(self) -> int:
        return int(self._config.get("adx_period", 14))

    @property
    def adx_threshold(self) -> float:
        return float(self._config.get("adx_threshold", 25.0))

    @property
    def ema_trend_period(self) -> int:
        return int(self._config.get("ema_trend_period", 50))

    @property
    def atr_stop_multiplier(self) -> float:
        return float(self._config.get("atr_stop_multiplier", 2.0))

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Computes True Range, +DI, -DI, ADX, and EMA trend filter."""
        min_required = max(self.adx_period * 2, self.ema_trend_period)
        if df.empty or len(df) < min_required:
            return df

        data = df.copy()

        # 1. EMA Trend Filter
        data["ema_trend"] = data["close"].ewm(span=self.ema_trend_period, adjust=False).mean()

        # 2. True Range (TR)
        prev_close = data["close"].shift(1)
        prev_high = data["high"].shift(1)
        prev_low = data["low"].shift(1)

        tr1 = data["high"] - data["low"]
        tr2 = (data["high"] - prev_close).abs()
        tr3 = (data["low"] - prev_close).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        data["tr"] = tr

        # 3. Directional Movement (+DM, -DM)
        up_move = data["high"] - prev_high
        down_move = prev_low - data["low"]

        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
        data["plus_dm"] = plus_dm
        data["minus_dm"] = minus_dm

        # 4. Wilder's Smoothing (alpha = 1 / period)
        alpha = 1.0 / self.adx_period
        smooth_tr = data["tr"].ewm(alpha=alpha, adjust=False).mean()
        smooth_plus_dm = data["plus_dm"].ewm(alpha=alpha, adjust=False).mean()
        smooth_minus_dm = data["minus_dm"].ewm(alpha=alpha, adjust=False).mean()

        # 5. +DI and -DI
        safe_tr = np.where(smooth_tr == 0, 1e-9, smooth_tr)
        data["plus_di"] = (smooth_plus_dm / safe_tr) * 100.0
        data["minus_di"] = (smooth_minus_dm / safe_tr) * 100.0

        # 6. DX & ADX
        di_sum = data["plus_di"] + data["minus_di"]
        di_diff = (data["plus_di"] - data["minus_di"]).abs()
        safe_di_sum = np.where(di_sum == 0, 1e-9, di_sum)
        dx = (di_diff / safe_di_sum) * 100.0
        data["adx"] = pd.Series(dx, index=data.index).ewm(alpha=alpha, adjust=False).mean()

        # 7. ATR (for stop calculations)
        data["atr"] = smooth_tr

        return data

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str,
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        """Generates BUY on strong bullish trend, SELL on reversal/breakdown, or HOLD."""
        min_candles = max(self.adx_period * 2, self.ema_trend_period) + 2
        if df.empty or len(df) < min_candles:
            return None

        enriched = self.compute_indicators(df)
        if "adx" not in enriched.columns or "ema_trend" not in enriched.columns:
            return None

        curr = enriched.iloc[-1]
        prev = enriched.iloc[-2]

        curr_time = int(curr.get("time", curr.name if isinstance(curr.name, int) else 0))
        close_price = float(curr["close"])
        adx_val = float(curr["adx"])
        plus_di_val = float(curr["plus_di"])
        minus_di_val = float(curr["minus_di"])
        ema_val = float(curr["ema_trend"])
        atr_val = float(curr.get("atr", 0.0))

        indicators = {
            "adx": round(adx_val, 2),
            "plus_di": round(plus_di_val, 2),
            "minus_di": round(minus_di_val, 2),
            "ema_trend": round(ema_val, 2),
            "atr": round(atr_val, 2),
        }

        # Long Entry: Strong trend + Bullish Directional Bias + Price above EMA filter
        is_strong_trend = adx_val >= self.adx_threshold
        is_bullish_bias = plus_di_val > minus_di_val
        is_above_trend_ema = close_price > ema_val

        # Long Exit: Bearish cross OR price below EMA filter OR trend exhaustion
        is_bearish_cross = minus_di_val > plus_di_val
        is_below_trend_ema = close_price < ema_val

        if not has_open_long:
            if is_strong_trend and is_bullish_bias and is_above_trend_ema:
                return StrategySignalResult(
                    strategy_id=self.STRATEGY_ID,
                    strategy_version=self.STRATEGY_VERSION,
                    instrument=instrument,
                    timeframe=timeframe,
                    candle_timestamp=curr_time,
                    signal_type="BUY",
                    reason=(
                        f"Strong bullish trend: ADX={adx_val:.1f} >= {self.adx_threshold}, "
                        f"+DI({plus_di_val:.1f}) > -DI({minus_di_val:.1f}), "
                        f"Price({close_price}) > EMA({ema_val:.1f})"
                    ),
                    close_price=close_price,
                    indicators=indicators,
                )
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=curr_time,
                signal_type="HOLD",
                reason=(
                    f"No entry condition met: ADX={adx_val:.1f}, "
                    f"+DI={plus_di_val:.1f}, -DI={minus_di_val:.1f}, EMA={ema_val:.1f}"
                ),
                close_price=close_price,
                indicators=indicators,
            )

        # In open long position -> check exit triggers
        if is_bearish_cross or is_below_trend_ema:
            exit_reason = (
                f"Bearish momentum shift: -DI({minus_di_val:.1f}) > +DI({plus_di_val:.1f})"
                if is_bearish_cross
                else f"Price({close_price}) dropped below trend EMA({ema_val:.1f})"
            )
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=curr_time,
                signal_type="SELL",
                reason=exit_reason,
                close_price=close_price,
                indicators=indicators,
            )

        return StrategySignalResult(
            strategy_id=self.STRATEGY_ID,
            strategy_version=self.STRATEGY_VERSION,
            instrument=instrument,
            timeframe=timeframe,
            candle_timestamp=curr_time,
            signal_type="HOLD",
            reason=f"Holding trend: ADX={adx_val:.1f}, +DI > -DI, Price > EMA",
            close_price=close_price,
            indicators=indicators,
        )
