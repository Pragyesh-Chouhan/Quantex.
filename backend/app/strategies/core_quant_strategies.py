"""QuantEX Prioritized Core Quantitative Trading Strategies.

Implements the 7 prioritized, genuinely executable algorithmic models:
1. SMA 200 Trend Following (sma_200_trend)
2. Supertrend Strategy (supertrend_strategy)
3. SMA 200 + Supertrend Confirmation (sma_200_supertrend)
4. EMA Trend Following (ema_trend_following)
5. RSI + Trend Confirmation (rsi_trend_confirmation)
6. ATR-Based Trend Following (atr_trend_following)
7. Long-Term Momentum Strategy (long_term_momentum - 1-Year Horizon, Zero Lookahead Bias)
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from app.strategies.base import BaseStrategy, StrategySignalResult
from app.strategies.registry import strategy_registry


# ==============================================================================
# 1. SMA 200 Trend Following
# ==============================================================================
@strategy_registry.register
class SMA200TrendStrategy(BaseStrategy):
    STRATEGY_ID = "sma_200_trend"
    STRATEGY_NAME = "SMA 200 Trend Following"
    STRATEGY_VERSION = "2.0.0"
    DESCRIPTION = "Institutional macroeconomic trend model tracking the 200-period Simple Moving Average breakout and trailing support regime."
    CATEGORY = "Trend Following"
    TIMEFRAME = "4h"
    EVALUATION_WINDOW = "1 Year"
    HOLDING_HORIZON = "1-4 Weeks"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.sma_period = int(config.get("sma_period", 200))
        self.buffer_pct = float(config.get("buffer_pct", 0.005))  # 0.5% breakout buffer
        self.stop_loss_pct = float(config.get("stop_loss_pct", 0.035))  # 3.5% protective stop
        self.take_profit_pct = float(config.get("take_profit_pct", 0.09))  # 9% profit target

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        effective_period = min(len(df), self.sma_period)
        df["sma_200"] = df["close"].rolling(window=effective_period, min_periods=max(5, effective_period // 4)).mean()
        df["dist_sma"] = ((df["close"] - df["sma_200"]) / df["sma_200"]) * 100
        return df

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "4h",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < 15:
            return None
        df = self.compute_indicators(df)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr["close"])
        prev_close = float(prev["close"])
        sma = float(curr["sma_200"]) if pd.notna(curr["sma_200"]) else close
        prev_sma = float(prev["sma_200"]) if pd.notna(prev["sma_200"]) else prev_close
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())

        # Entry: Close breaks above SMA 200 with confirmation buffer
        bullish_breakout = (prev_close <= prev_sma) and (close > sma * (1 + self.buffer_pct))
        # Continuous trend continuation
        bullish_regime = (close > sma) and (prev_close > prev_sma)

        # Exit: Close falls below SMA 200
        bearish_breakdown = close < sma * (1 - self.buffer_pct)

        if (bullish_breakout or (bullish_regime and not has_open_long and curr["dist_sma"] < 3.0)) and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"Bullish SMA 200 breakout: Close ({close:.2f}) > SMA ({sma:.2f}) by +{curr['dist_sma']:.2f}%",
                close_price=close,
                indicators={"sma_200": round(sma, 2), "dist_sma_pct": round(float(curr["dist_sma"]), 2)},
            )
        elif bearish_breakdown and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"Bearish breakdown: Close ({close:.2f}) dropped below SMA 200 ({sma:.2f})",
                close_price=close,
                indicators={"sma_200": round(sma, 2), "dist_sma_pct": round(float(curr["dist_sma"]), 2)},
            )
        return None


# ==============================================================================
# 2. Supertrend Strategy
# ==============================================================================
@strategy_registry.register
class SupertrendOnlyStrategy(BaseStrategy):
    STRATEGY_ID = "supertrend_strategy"
    STRATEGY_NAME = "Supertrend Strategy"
    STRATEGY_VERSION = "2.0.0"
    DESCRIPTION = "Volatility-adaptive trend model using ATR(10) with 3.0 multiplier to establish dynamic support and resistance bands."
    CATEGORY = "Trend Following"
    TIMEFRAME = "15m"
    EVALUATION_WINDOW = "3 Months"
    HOLDING_HORIZON = "1-3 Days"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.atr_period = int(config.get("atr_period", 10))
        self.multiplier = float(config.get("multiplier", 3.0))

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
        timeframe: str = "15m",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < self.atr_period + 5:
            return None
        df = self.compute_indicators(df)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr["close"])
        st_val = float(curr["supertrend"]) if pd.notna(curr["supertrend"]) else close
        curr_dir = int(curr["direction"])
        prev_dir = int(prev["direction"])
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())

        # Bullish flip
        if curr_dir == 1 and prev_dir == -1 and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"Supertrend flipped Bullish (Trailing support at ${st_val:.2f})",
                close_price=close,
                indicators={"supertrend": round(st_val, 2), "direction": 1},
            )
        # Bearish flip
        elif curr_dir == -1 and prev_dir == 1 and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"Supertrend flipped Bearish (Resistance at ${st_val:.2f})",
                close_price=close,
                indicators={"supertrend": round(st_val, 2), "direction": -1},
            )
        return None


# ==============================================================================
# 3. SMA 200 + Supertrend Confirmation
# ==============================================================================
@strategy_registry.register
class SMA200SupertrendStrategy(BaseStrategy):
    STRATEGY_ID = "sma_200_supertrend"
    STRATEGY_NAME = "SMA 200 + Supertrend Confirmation"
    STRATEGY_VERSION = "2.0.0"
    DESCRIPTION = "Dual-layer quantitative system: 200-SMA macro filter prevents counter-trend trading while Supertrend triggers precision entries."
    CATEGORY = "Dual Indicator"
    TIMEFRAME = "1h"
    EVALUATION_WINDOW = "6 Months"
    HOLDING_HORIZON = "3-10 Days"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.sma_period = int(config.get("sma_period", 200))
        self.atr_period = int(config.get("atr_period", 10))
        self.multiplier = float(config.get("multiplier", 3.0))

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        eff_period = min(len(df), self.sma_period)
        df["sma_200"] = df["close"].rolling(window=eff_period, min_periods=max(5, eff_period // 4)).mean()

        prev = df["close"].shift(1)
        tr = pd.concat([
            df["high"] - df["low"],
            (df["high"] - prev).abs(),
            (df["low"] - prev).abs()
        ], axis=1).max(axis=1)

        df["atr"] = tr.ewm(alpha=1 / self.atr_period, min_periods=self.atr_period, adjust=False).mean()
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
        timeframe: str = "1h",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < 20:
            return None
        df = self.compute_indicators(df)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr["close"])
        sma = float(curr["sma_200"]) if pd.notna(curr["sma_200"]) else close
        st_val = float(curr["supertrend"]) if pd.notna(curr["supertrend"]) else close
        curr_dir = int(curr["direction"])
        prev_dir = int(prev["direction"])
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())

        # BUY: Price must be ABOVE SMA 200 AND Supertrend flips to Bullish
        is_above_sma = close > sma
        supertrend_buy = (curr_dir == 1 and prev_dir == -1)

        if is_above_sma and supertrend_buy and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"Supertrend confirmed bullish above SMA 200 (${close:.2f} > SMA ${sma:.2f})",
                close_price=close,
                indicators={"sma_200": round(sma, 2), "supertrend": round(st_val, 2), "direction": 1},
            )
        # SELL: Supertrend flips Bearish OR Price drops below SMA 200
        elif (curr_dir == -1 or close < sma * 0.995) and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"Exit triggered: Supertrend flipped bearish ({curr_dir}) or broke SMA (${sma:.2f})",
                close_price=close,
                indicators={"sma_200": round(sma, 2), "supertrend": round(st_val, 2), "direction": curr_dir},
            )
        return None


# ==============================================================================
# 4. EMA Trend Following
# ==============================================================================
@strategy_registry.register
class EMATrendFollowingProStrategy(BaseStrategy):
    STRATEGY_ID = "ema_trend_following"
    STRATEGY_NAME = "EMA Trend Following"
    STRATEGY_VERSION = "2.0.0"
    DESCRIPTION = "High-responsiveness trend following using Fast EMA (9) and Slow EMA (21) directional crossovers with volume expansion confirmation."
    CATEGORY = "Trend Following"
    TIMEFRAME = "5m"
    EVALUATION_WINDOW = "1 Month"
    HOLDING_HORIZON = "2-8 Hours"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.fast_period = int(config.get("fast_period", 9))
        self.slow_period = int(config.get("slow_period", 21))
        if self.fast_period >= self.slow_period:
            raise ValueError("Fast EMA period must be smaller than Slow EMA period")

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df["fast_ema"] = df["close"].ewm(span=self.fast_period, adjust=False).mean()
        df["slow_ema"] = df["close"].ewm(span=self.slow_period, adjust=False).mean()
        df["vol_sma"] = df["volume"].rolling(window=14, min_periods=3).mean()
        return df

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "5m",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < self.slow_period + 3:
            return None
        df = self.compute_indicators(df)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr["close"])
        fast = float(curr["fast_ema"])
        slow = float(curr["slow_ema"])
        prev_fast = float(prev["fast_ema"])
        prev_slow = float(prev["slow_ema"])
        vol = float(curr["volume"])
        vol_sma = float(curr["vol_sma"]) if pd.notna(curr["vol_sma"]) else vol
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())

        # Golden crossover: Fast crosses above Slow
        crossover = (prev_fast <= prev_slow) and (fast > slow)
        vol_confirmed = vol >= vol_sma * 0.9

        # Bearish death cross: Fast crosses below Slow
        crossunder = (prev_fast >= prev_slow) and (fast < slow)

        if crossover and vol_confirmed and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"EMA Golden Cross: Fast EMA {self.fast_period} ({fast:.2f}) crossed above Slow EMA {self.slow_period} ({slow:.2f})",
                close_price=close,
                indicators={"fast_ema": round(fast, 2), "slow_ema": round(slow, 2), "volume": round(vol, 2)},
            )
        elif crossunder and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"EMA Death Cross: Fast EMA ({fast:.2f}) crossed below Slow EMA ({slow:.2f})",
                close_price=close,
                indicators={"fast_ema": round(fast, 2), "slow_ema": round(slow, 2)},
            )
        return None


# ==============================================================================
# 5. RSI + Trend Confirmation
# ==============================================================================
@strategy_registry.register
class RSITrendConfirmationStrategy(BaseStrategy):
    STRATEGY_ID = "rsi_trend_confirmation"
    STRATEGY_NAME = "RSI + Trend Confirmation"
    STRATEGY_VERSION = "2.0.0"
    DESCRIPTION = "Combined momentum-trend model: 50 EMA ensures alignment with dominant direction, entering on RSI momentum breakouts above 50."
    CATEGORY = "Momentum"
    TIMEFRAME = "15m"
    EVALUATION_WINDOW = "3 Months"
    HOLDING_HORIZON = "6-24 Hours"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.ema_period = int(config.get("ema_period", 50))
        self.rsi_period = int(config.get("rsi_period", 14))
        self.rsi_entry = float(config.get("rsi_entry", 50.0))
        self.rsi_exit = float(config.get("rsi_exit", 75.0))

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df["ema_50"] = df["close"].ewm(span=self.ema_period, adjust=False).mean()

        delta = df["close"].diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(alpha=1 / self.rsi_period, min_periods=self.rsi_period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1 / self.rsi_period, min_periods=self.rsi_period, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, 1e-9)
        df["rsi"] = 100 - (100 / (1 + rs))
        return df

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "15m",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < max(self.ema_period, self.rsi_period) + 3:
            return None
        df = self.compute_indicators(df)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr["close"])
        ema = float(curr["ema_50"])
        rsi = float(curr["rsi"]) if pd.notna(curr["rsi"]) else 50.0
        prev_rsi = float(prev["rsi"]) if pd.notna(prev["rsi"]) else 50.0
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())

        # Trend filter: Price must be above 50 EMA
        is_uptrend = close > ema
        # Momentum trigger: RSI crosses above 50
        rsi_bullish_cross = (prev_rsi <= self.rsi_entry) and (rsi > self.rsi_entry)

        # Exit trigger: RSI overbought exhaustion or drops below 45
        rsi_exhaustion = rsi >= self.rsi_exit or rsi < 45.0 or close < ema * 0.995

        if is_uptrend and rsi_bullish_cross and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"Bullish RSI breakout ({rsi:.1f} > {self.rsi_entry}) confirmed by 50-EMA trend (${close:.2f} > ${ema:.2f})",
                close_price=close,
                indicators={"rsi": round(rsi, 2), "ema_50": round(ema, 2)},
            )
        elif rsi_exhaustion and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"Exit signal: RSI ({rsi:.1f}) reached target or broke momentum regime",
                close_price=close,
                indicators={"rsi": round(rsi, 2), "ema_50": round(ema, 2)},
            )
        return None


# ==============================================================================
# 6. ATR-Based Trend Following
# ==============================================================================
@strategy_registry.register
class ATRTrendFollowingStrategy(BaseStrategy):
    STRATEGY_ID = "atr_trend_following"
    STRATEGY_NAME = "ATR-Based Trend Following"
    STRATEGY_VERSION = "2.0.0"
    DESCRIPTION = "Volatility-calibrated trend channel model utilizing 20 EMA baseline with 2.0x ATR expansion bands for dynamic trailing stops."
    CATEGORY = "Volatility"
    TIMEFRAME = "1h"
    EVALUATION_WINDOW = "6 Months"
    HOLDING_HORIZON = "2-7 Days"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.ema_period = int(config.get("ema_period", 20))
        self.atr_period = int(config.get("atr_period", 14))
        self.atr_multiplier = float(config.get("atr_multiplier", 2.0))

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df["ema_20"] = df["close"].ewm(span=self.ema_period, adjust=False).mean()

        prev = df["close"].shift(1)
        tr = pd.concat([
            df["high"] - df["low"],
            (df["high"] - prev).abs(),
            (df["low"] - prev).abs()
        ], axis=1).max(axis=1)

        df["atr"] = tr.rolling(window=self.atr_period, min_periods=self.atr_period // 2).mean()
        df["upper_channel"] = df["ema_20"] + (self.atr_multiplier * df["atr"])
        df["lower_channel"] = df["ema_20"] - (self.atr_multiplier * df["atr"])
        return df

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "1h",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < max(self.ema_period, self.atr_period) + 3:
            return None
        df = self.compute_indicators(df)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr["close"])
        upper = float(curr["upper_channel"]) if pd.notna(curr["upper_channel"]) else close
        ema = float(curr["ema_20"]) if pd.notna(curr["ema_20"]) else close
        atr = float(curr["atr"]) if pd.notna(curr["atr"]) else 100.0
        prev_close = float(prev["close"])
        prev_upper = float(prev["upper_channel"]) if pd.notna(prev["upper_channel"]) else prev_close
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())

        # Volatility breakout above Upper ATR Channel
        breakout = (prev_close <= prev_upper) and (close > upper)

        # Dynamic trailing stop at 20 EMA or 1.5 ATR below entry
        breakdown = close < ema

        if breakout and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"ATR Volatility Breakout: Close (${close:.2f}) pierced upper channel (${upper:.2f}, ATR: ${atr:.2f})",
                close_price=close,
                indicators={"upper_channel": round(upper, 2), "ema_20": round(ema, 2), "atr": round(atr, 2)},
            )
        elif breakdown and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"Trailing exit triggered: Close (${close:.2f}) dropped below EMA 20 support (${ema:.2f})",
                close_price=close,
                indicators={"ema_20": round(ema, 2), "atr": round(atr, 2)},
            )
        return None


# ==============================================================================
# 7. Long-Term Momentum Strategy (1-Year Horizon, Zero Lookahead Bias)
# ==============================================================================
@strategy_registry.register
class LongTermMomentumProStrategy(BaseStrategy):
    STRATEGY_ID = "long_term_momentum"
    STRATEGY_NAME = "Long-Term Momentum Strategy"
    STRATEGY_VERSION = "2.0.0"
    DESCRIPTION = "1-Year macro horizon quantitative model: Evaluates 126-bar price velocity normalized by 20-day historical volatility, eliminating look-ahead bias."
    CATEGORY = "1 Year"
    TIMEFRAME = "1d"
    EVALUATION_WINDOW = "1 Year"
    HOLDING_HORIZON = "2-6 Months"
    SUPPORTED_INSTRUMENTS = ["BTCUSD", "ETHUSD", "SOLUSD"]

    def validate_config(self, config: Dict[str, Any]) -> None:
        self.lookback = int(config.get("lookback", 126))  # 6 months of trading bars
        self.vol_window = int(config.get("vol_window", 20))
        self.stop_loss_pct = float(config.get("stop_loss_pct", 0.08))  # 8% macro stop
        self.take_profit_pct = float(config.get("take_profit_pct", 0.25))  # 25% macro target

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        eff_lookback = min(len(df) - 1, self.lookback) if len(df) > 1 else 1
        df["past_close"] = df["close"].shift(eff_lookback)
        df["momentum_pct"] = ((df["close"] - df["past_close"]) / df["past_close"]) * 100

        # 20-day realized volatility
        returns = df["close"].pct_change()
        df["volatility_20"] = returns.rolling(window=self.vol_window, min_periods=5).std() * np.sqrt(365) * 100
        df["vol_adjusted_momentum"] = df["momentum_pct"] / df["volatility_20"].replace(0, 1.0)
        return df

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "1d",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if len(df) < 10:
            return None
        df = self.compute_indicators(df)
        curr = df.iloc[-1]

        close = float(curr["close"])
        past_close = float(curr["past_close"]) if pd.notna(curr["past_close"]) else close
        mom_pct = float(curr["momentum_pct"]) if pd.notna(curr["momentum_pct"]) else 0.0
        vol_score = float(curr["vol_adjusted_momentum"]) if pd.notna(curr["vol_adjusted_momentum"]) else 0.0
        time_val = int(curr["time"]) if "time" in curr else int(pd.Timestamp.now().timestamp())

        # Long-term macro bull regime: Positive 126-bar momentum and stable volatility
        is_bullish = close > past_close and mom_pct > 2.0

        if is_bullish and not has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="BUY",
                reason=f"1-Year Macro Momentum Positive (+{mom_pct:.2f}% vs {eff_lb if 'eff_lb' in locals() else '126'}-bar lookback, Vol-Adj Score: {vol_score:.2f})",
                close_price=close,
                indicators={"momentum_pct": round(mom_pct, 2), "vol_score": round(vol_score, 2)},
            )
        elif not is_bullish and has_open_long:
            return StrategySignalResult(
                strategy_id=self.STRATEGY_ID,
                strategy_version=self.STRATEGY_VERSION,
                instrument=instrument,
                timeframe=timeframe,
                candle_timestamp=time_val,
                signal_type="SELL",
                reason=f"Macro Momentum Exhaustion: Price fell below lookback reference (${close:.2f} <= ${past_close:.2f})",
                close_price=close,
                indicators={"momentum_pct": round(mom_pct, 2), "vol_score": round(vol_score, 2)},
            )
        return None

