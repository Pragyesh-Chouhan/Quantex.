"""SuperTrend EMA 200 - 3-Month Trend Following Strategy.

Origin: QuantEX_3month_strategy / 3-Month-SuperTrend-Strategy.py
Preserves genuine ATR(10, 3.0) + EMA(200) trend regime on 4h candles.
Signals: BUY / OPEN_LONG, SELL / CLOSE_LONG, HOLD.
"""
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
from app.strategies.base import BaseStrategy, StrategySignalResult
from app.strategies.registry import strategy_registry


@strategy_registry.register
class SuperTrendEMA3MStrategy(BaseStrategy):
    STRATEGY_ID = "supertrend_ema_3m"
    STRATEGY_NAME = "SuperTrend EMA 200 (3M)"
    STRATEGY_VERSION = "1.0.0"
    DESCRIPTION = "3-Month swing trend strategy using ATR-based SuperTrend (10, 3.0) confirmed by 200-EMA directional regime."
    CATEGORY = "3 Months"
    TIMEFRAME = "4h"
    EVALUATION_WINDOW = "3 Months"
    HOLDING_HORIZON = "2-6 Days"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.atr_period = int(config.get("atr_period", 10))
        self.multiplier = float(config.get("multiplier", 3.0))
        self.ema_period = int(config.get("ema_period", 200))
        self.stop_atr = float(config.get("stop_atr", 1.5))
        self.reward_risk = float(config.get("reward_risk", 2.0))
        if self.atr_period < 1 or self.ema_period < 1:
            raise ValueError("Periods must be positive integers")
        if self.multiplier <= 0 or self.stop_atr <= 0 or self.reward_risk <= 0:
            raise ValueError("Multipliers must be positive numbers")

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        prev = df["close"].shift(1)
        tr = pd.concat([
            df["high"] - df["low"],
            (df["high"] - prev).abs(),
            (df["low"] - prev).abs()
        ], axis=1).max(axis=1)

        df["atr"] = tr.ewm(alpha=1 / self.atr_period, min_periods=self.atr_period, adjust=False).mean()
        df["ema_200"] = df["close"].ewm(span=self.ema_period, min_periods=min(self.ema_period, len(df)), adjust=False).mean()

        mid = (df["high"] + df["low"]) / 2
        bu = mid + self.multiplier * df["atr"]
        bl = mid - self.multiplier * df["atr"]

        fu = pd.Series(float("nan"), index=df.index)
        fl = pd.Series(float("nan"), index=df.index)
        direction = pd.Series(0, index=df.index, dtype=int)
        st = pd.Series(float("nan"), index=df.index)

        valid = [i for i, ok in enumerate(df["atr"].notna()) if ok]
        if valid:
            s = valid[0]
            fu.iloc[s], fl.iloc[s] = bu.iloc[s], bl.iloc[s]
            direction.iloc[s] = 1 if df["close"].iloc[s] >= mid.iloc[s] else -1
            st.iloc[s] = fl.iloc[s] if direction.iloc[s] == 1 else fu.iloc[s]

            for i in range(s + 1, len(df)):
                if pd.isna(df["atr"].iloc[i]):
                    continue
                p = i - 1
                fu.iloc[i] = bu.iloc[i] if bu.iloc[i] < fu.iloc[p] or df["close"].iloc[p] > fu.iloc[p] else fu.iloc[p]
                fl.iloc[i] = bl.iloc[i] if bl.iloc[i] > fl.iloc[p] or df["close"].iloc[p] < fl.iloc[p] else fl.iloc[p]

                if direction.iloc[p] == -1:
                    direction.iloc[i] = 1 if df["close"].iloc[i] > fu.iloc[i] else -1
                else:
                    direction.iloc[i] = -1 if df["close"].iloc[i] < fl.iloc[i] else 1

                st.iloc[i] = fl.iloc[i] if direction.iloc[i] == 1 else fu.iloc[i]

        df["supertrend"] = st
        df["direction"] = direction
        return df

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str,
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < self.atr_period + 5:
            return None

        df = self.compute_indicators(df)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr["close"])
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())
        direction = int(curr["direction"])
        ema_val = float(curr["ema_200"]) if pd.notna(curr["ema_200"]) else close
        atr_val = float(curr["atr"]) if pd.notna(curr["atr"]) else close * 0.02
        st_val = float(curr["supertrend"]) if pd.notna(curr["supertrend"]) else close

        is_bullish = direction == 1 and close >= ema_val
        is_bearish = direction == -1 or close < ema_val

        if is_bullish and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"SuperTrend bullish (ST: {st_val:.2f}) confirmed above 200 EMA ({ema_val:.2f})",
                close_price=close,
                indicators={
                    "supertrend": st_val,
                    "ema_200": ema_val,
                    "atr": atr_val,
                    "direction": float(direction)
                }
            )
        elif is_bearish and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"SuperTrend flipped bearish (dir: {direction}) or closed below 200 EMA",
                close_price=close,
                indicators={
                    "supertrend": st_val,
                    "ema_200": ema_val,
                    "atr": atr_val,
                    "direction": float(direction)
                }
            )

        return None
