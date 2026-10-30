"""Dedicated Backtesting Service for QuantEX.

Simulates strategy execution over historical candle series with realistic fee and slippage models,
calculating institutional-grade performance metrics: ROI, Max Drawdown, Win Rate, and Profit Factor.
"""

from datetime import datetime, timezone
import json
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.models.backtest_run import BacktestRun
from app.strategies.registry import StrategyRegistry
from app.strategies.loader import load_all_strategies


class BacktestingService:
    """Historical strategy backtesting engine."""

    @staticmethod
    def run_backtest(
        strategy_id: str,
        candles: List[Dict[str, Any]],
        initial_capital: float = 10000.0,
        fee_pct: float = 0.0005,
        slippage_pct: float = 0.0002,
        user_id: str = "default_user",
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Runs historical backtest for a registered strategy."""
        load_all_strategies()
        strategy = StrategyRegistry.get_instance(strategy_id)

        if not candles or len(candles) < 5:
            raise ValueError("Insufficient candle history provided (minimum 5 candles required)")

        df = pd.DataFrame(candles)
        for req_col in ["time", "open", "high", "low", "close"]:
            if req_col not in df.columns:
                raise ValueError(f"Candle data missing required column: '{req_col}'")
        df = df.sort_values("time").reset_index(drop=True)

        capital = float(initial_capital)
        peak_capital = capital
        max_drawdown = 0.0
        max_drawdown_pct = 0.0

        position_open = False
        entry_price = 0.0
        entry_time = 0
        entry_qty = 0.0
        trade_log = []
        equity_curve = [{"time": int(df.iloc[0]["time"]), "equity": round(capital, 2)}]

        for i in range(2, len(df)):
            chunk = df.iloc[: i + 1]
            signal = strategy.generate_signal(chunk, "BACKTEST", "5m", has_open_long=position_open)
            current_candle = df.iloc[i]
            price = float(current_candle["close"])
            candle_time = int(current_candle["time"])

            if signal and signal.signal_type == "BUY" and not position_open:
                # Execution with slippage and fee
                exec_price = price * (1.0 + slippage_pct)
                fee = exec_price * fee_pct
                allocated = capital * 0.95
                qty = allocated / (exec_price + fee)
                capital -= qty * (exec_price + fee)

                entry_price = exec_price
                entry_time = candle_time
                entry_qty = qty
                position_open = True

                trade_log.append({
                    "action": "BUY",
                    "time": candle_time,
                    "price": round(exec_price, 2),
                    "qty": round(qty, 6),
                    "fee": round(fee * qty, 4),
                    "reason": signal.reason,
                })

            elif signal and signal.signal_type == "SELL" and position_open:
                # Sell execution
                exec_price = price * (1.0 - slippage_pct)
                fee = exec_price * fee_pct
                gross_proceeds = exec_price * entry_qty
                net_proceeds = gross_proceeds - (fee * entry_qty)
                capital += net_proceeds

                realized_pnl = net_proceeds - (entry_price * entry_qty)
                pnl_pct = (realized_pnl / (entry_price * entry_qty)) * 100.0

                trade_log.append({
                    "action": "SELL",
                    "time": candle_time,
                    "entry_time": entry_time,
                    "price": round(exec_price, 2),
                    "qty": round(entry_qty, 6),
                    "fee": round(fee * entry_qty, 4),
                    "realized_pnl": round(realized_pnl, 2),
                    "pnl_pct": round(pnl_pct, 2),
                    "reason": signal.reason,
                })

                position_open = False
                entry_price = 0.0
                entry_qty = 0.0

            # Mark to market equity
            current_equity = capital + (entry_qty * price if position_open else 0.0)
            if current_equity > peak_capital:
                peak_capital = current_equity

            dd = peak_capital - current_equity
            dd_pct = (dd / peak_capital) * 100.0 if peak_capital > 0 else 0.0
            if dd > max_drawdown:
                max_drawdown = dd
            if dd_pct > max_drawdown_pct:
                max_drawdown_pct = dd_pct

            equity_curve.append({"time": candle_time, "equity": round(current_equity, 2)})

        # Close any open position at last price
        if position_open and entry_qty > 0:
            last_price = float(df.iloc[-1]["close"])
            net_proceeds = (last_price * entry_qty) * (1.0 - fee_pct - slippage_pct)
            capital += net_proceeds
            realized_pnl = net_proceeds - (entry_price * entry_qty)
            trade_log.append({
                "action": "SELL",
                "time": int(df.iloc[-1]["time"]),
                "entry_time": entry_time,
                "price": round(last_price, 2),
                "qty": round(entry_qty, 6),
                "fee": round(last_price * entry_qty * fee_pct, 4),
                "realized_pnl": round(realized_pnl, 2),
                "pnl_pct": round((realized_pnl / (entry_price * entry_qty)) * 100.0, 2),
                "reason": "Backtest period end close",
            })

        completed_trades = [t for t in trade_log if t["action"] == "SELL"]
        winning_trades = [t for t in completed_trades if t.get("realized_pnl", 0) > 0]
        losing_trades = [t for t in completed_trades if t.get("realized_pnl", 0) <= 0]

        gross_profit = sum(t["realized_pnl"] for t in winning_trades)
        gross_loss = abs(sum(t["realized_pnl"] for t in losing_trades))
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)

        net_profit = capital - initial_capital
        net_profit_pct = (net_profit / initial_capital) * 100.0
        win_rate = (len(winning_trades) / len(completed_trades) * 100.0) if completed_trades else 0.0

        result = {
            "strategy_id": strategy_id,
            "initial_capital": round(initial_capital, 2),
            "final_capital": round(capital, 2),
            "net_profit": round(net_profit, 2),
            "net_profit_pct": round(net_profit_pct, 2),
            "roi_pct": round(net_profit_pct, 2),
            "max_drawdown": round(max_drawdown, 2),
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "total_trades": len(completed_trades),
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "win_rate_pct": round(win_rate, 2),
            "profit_factor": profit_factor,
            "trades": trade_log,
            "equity_curve": equity_curve,
        }

        # Persist to database if db session provided
        if db:
            try:
                run_record = BacktestRun(
                    strategy_id=strategy_id,
                    user_id=user_id,
                    instrument="BTCUSD",
                    timeframe="5m",
                    initial_capital=initial_capital,
                    final_capital=round(capital, 2),
                    net_profit=round(net_profit, 2),
                    net_profit_pct=round(net_profit_pct, 2),
                    max_drawdown=round(max_drawdown, 2),
                    max_drawdown_pct=round(max_drawdown_pct, 2),
                    total_trades=len(completed_trades),
                    winning_trades=len(winning_trades),
                    losing_trades=len(losing_trades),
                    win_rate_pct=round(win_rate, 2),
                    profit_factor=profit_factor,
                    config_json=json.dumps(strategy.get_metadata().get("config", {})),
                    metrics_json=json.dumps(result),
                    created_at=datetime.now(timezone.utc),
                )
                db.add(run_record)
                db.commit()
                db.refresh(run_record)
                result["backtest_id"] = run_record.backtest_id
            except Exception as e:
                logger.error(f"Failed to persist BacktestRun: {e}")

        return result


backtesting_service = BacktestingService()
