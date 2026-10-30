# Developer Guide: How to Add a New Strategy to QuantEX

QuantEX features a plugin architecture designed to allow new algorithmic strategies to be introduced without modifying the execution engine, risk manager, database, or API layer.

---

## Architecture Overview

```
app/strategies/
├── base.py                 # BaseStrategy ABC and StrategySignalResult dataclass
├── registry.py             # StrategyRegistry for auto-discovery and lifecycle
├── loader.py               # Auto-imports all strategy modules on startup
├── ema_crossover.py        # Reference Strategy A
└── rsi_mean_reversion.py   # Reference Strategy B
```

---

## 5-Step Process to Add a Strategy

### Step 1: Create the Strategy File
Create a new file in `app/strategies/`, for example `app/strategies/bollinger_bands.py`.

### Step 2: Implement `BaseStrategy` and Decorate with `@StrategyRegistry.register`
Subclass `BaseStrategy` and implement the abstract methods:
1. `validate_config(config: Dict[str, Any]) -> None`
2. `compute_indicators(df: pd.DataFrame) -> pd.DataFrame`
3. `generate_signal(df: pd.DataFrame, instrument: str, timeframe: str, has_open_long: bool) -> Optional[StrategySignalResult]`

### Example Skeleton

```python
"""Bollinger Bands Mean Reversion Strategy."""
from typing import Optional, Dict, Any
import pandas as pd
from app.strategies.base import BaseStrategy, StrategySignalResult
from app.strategies.registry import StrategyRegistry


@StrategyRegistry.register
class BollingerBandsStrategy(BaseStrategy):
    STRATEGY_ID = "bollinger_bands"
    STRATEGY_NAME = "Bollinger Bands Mean Reversion"
    STRATEGY_VERSION = "1.0.0"
    DESCRIPTION = "Enters long on lower band touch, exits at upper band."

    def validate_config(self, config: Dict[str, Any]) -> None:
        period = int(config.get("period", 20))
        std_dev = float(config.get("std_dev", 2.0))
        if not (5 <= period <= 100):
            raise ValueError("period must be 5-100")
        if not (1.0 <= std_dev <= 4.0):
            raise ValueError("std_dev must be 1.0-4.0")

    def compute_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty or len(df) < 20:
            return df
        data = df.copy()
        period = int(self._config.get("period", 20))
        std = float(self._config.get("std_dev", 2.0))
        data["sma"] = data["close"].rolling(period).mean()
        rolling_std = data["close"].rolling(period).std()
        data["upper_band"] = data["sma"] + (std * rolling_std)
        data["lower_band"] = data["sma"] - (std * rolling_std)
        return data

    def generate_signal(
        self,
        df: pd.DataFrame,
        instrument: str,
        timeframe: str = "5m",
        has_open_long: bool = False,
    ) -> Optional[StrategySignalResult]:
        if df.empty or len(df) < 25:
            return None
        data = self.compute_indicators(df)
        curr = data.iloc[-1]
        prev = data.iloc[-2]
        close = float(curr["close"])
        lower = float(curr["lower_band"])
        upper = float(curr["upper_band"])

        signal_type = "HOLD"
        reason = "Inside bands"

        if not has_open_long and close <= lower:
            signal_type = "BUY"
            reason = f"Price ({close}) breached lower band ({lower:.2f})"
        elif has_open_long and close >= upper:
            signal_type = "SELL"
            reason = f"Price ({close}) breached upper band ({upper:.2f})"

        return StrategySignalResult(
            strategy_id=self.STRATEGY_ID,
            strategy_version=self.STRATEGY_VERSION,
            instrument=instrument,
            timeframe=timeframe,
            candle_timestamp=int(curr["time"]),
            signal_type=signal_type,
            reason=reason,
            close_price=close,
            indicators={"lower_band": lower, "upper_band": upper, "sma": float(curr["sma"])},
        )
```

### Step 3: Register in `app/strategies/loader.py`
Add the import:
```python
from app.strategies import ema_crossover, rsi_mean_reversion, bollinger_bands  # noqa: F401
```

### Step 4: Write Unit Tests in `tests/unit/test_strategies.py`
Verify:
1. `validate_config` raises `ValueError` on bad inputs.
2. `compute_indicators` adds expected indicator columns.
3. `generate_signal` returns `BUY`, `SELL`, and `HOLD` appropriately.
4. Insufficient history returns `None`.

### Step 5: Test via the Strategy Management API
The strategy is immediately available at:
- `GET /api/v1/strategies`
- `GET /api/v1/strategies/bollinger_bands`
- `PUT /api/v1/strategies/bollinger_bands/config`
- `POST /api/v1/strategies/bollinger_bands/backtest`
- Visible in the interactive dashboard under **API Connections & Accounts -> Algorithmic Strategy Plugins**.
