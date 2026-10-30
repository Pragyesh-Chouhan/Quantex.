"""Automated Trading Loop Orchestrator for QuantEX.

Continuously runs the end-to-end trading pipeline:
Market Data Ingestion -> Data Validation -> Strategy Evaluation ->
Risk Engine Validation -> Order Execution -> Position & Trade Reconciliation.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional
from app.config import settings
from app.core.logger import logger
from app.core.state import runtime_state
from app.database import SessionLocal
from app.exchange.client import exchange_client
from app.exchange.manager import get_client_for_account
from app.services.market_data import market_data_service
from app.services.strategy_engine import strategy_engine, StrategySignal
from app.services.risk_engine import risk_engine, RiskDecision
from app.services.execution_engine import execution_engine
from app.services.position_manager import position_manager
from app.models.event import SystemEvent
from app.models.position import Position
from app.strategies.loader import load_all_strategies
from app.strategies.registry import strategy_registry
from app.strategies.base import StrategySignalResult


class TradingLoop:
    """Orchestrates asynchronous periodic trading pipeline iterations."""

    def __init__(self):
        self._running = False
        self._task: asyncio.Task = None

    def start(self):
        """Starts the autonomous trading loop task."""
        if self._running:
            logger.info("Trading loop is already running.")
            return

        self._running = True
        runtime_state.strategy_active = True
        runtime_state.strategy_started_at = datetime.now(timezone.utc).isoformat()
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._run_loop())
        except RuntimeError:
            # If no running loop in current thread, state is updated
            self._task = None
        logger.info("Autonomous trading loop started.")

    def stop(self):
        """Halts the autonomous trading loop."""
        self._running = False
        runtime_state.strategy_active = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Autonomous trading loop stopped.")

    async def _run_loop(self):
        """Continuous execution loop."""
        while self._running:
            try:
                await self.execute_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error in trading loop iteration: {e}", exc_info=True)

            await asyncio.sleep(settings.TRADING_LOOP_INTERVAL_SECONDS)

    async def execute_cycle(self):
        """Executes one complete cycle of the algorithmic trading pipeline."""
        db = SessionLocal()
        try:
            # 0. Resolve active client for connected account
            client, active_account = get_client_for_account(db)

            # 1. Exchange Connectivity Check
            connected = await client.ping_connectivity()
            runtime_state.set_exchange_status(connected=connected)
            if not connected:
                logger.warning("Cycle skipped: Exchange connection unavailable.")
                return

            # 2. Synchronize Positions & Check Stop-Loss / Take-Profit
            positions = await position_manager.synchronize_positions(db, client=client)
            balances = await client.get_wallet_balances()

            # Check stop loss on active positions
            current_price = runtime_state.latest_market_price
            for pos in positions:
                exit_check = position_manager.check_stop_loss_or_take_profit(pos, current_price)
                if exit_check:
                    exit_side, exit_reason = exit_check
                    logger.warning(f"Position exit triggered for {pos.instrument}: {exit_reason}")
                    exit_signal = StrategySignal(
                        instrument=pos.instrument,
                        signal_type=exit_side,
                        fast_ema=0.0,
                        slow_ema=0.0,
                        candle_timestamp=runtime_state.last_candle_timestamp,
                        close_price=current_price,
                    )
                    # Emergency/risk exit bypasses duplicate position check
                    exit_decision = RiskDecision(
                        approved=True,
                        reason=exit_reason,
                        allowed_quantity=abs(pos.size),
                        risk_rule="STOP_LOSS_TAKE_PROFIT",
                    )
                    success, order, msg = await execution_engine.execute_approved_signal(
                        signal=exit_signal,
                        decision=exit_decision,
                        db=db,
                        client=client,
                    )
                    if success and order and order.status == "FILLED":
                        position_manager.record_fill_as_trade(
                            db=db,
                            order=order,
                            fill_price=current_price,
                            fill_qty=abs(pos.size),
                        )
                    # Skip normal signal evaluation if an exit was just handled
                    return

            # 3. Market Data Ingestion & Freshness Validation
            is_valid, df, err_msg = await market_data_service.fetch_and_validate_candles(
                symbol=settings.DEFAULT_INSTRUMENT,
                resolution=settings.DEFAULT_TIMEFRAME,
                limit=settings.CANDLE_LIMIT,
            )

            if not is_valid:
                logger.warning(f"Market data invalid ({err_msg}). Halting cycle.")
                return

            # 4. Deduplication: only evaluate newly completed candles
            latest_candle_time = int(df.iloc[-1]["time"])
            if not market_data_service.is_new_completed_candle(latest_candle_time):
                # Candle already processed; avoid duplicate signals
                return

            # Check if we currently have an open long position for this instrument
            has_open_long = any(p.instrument == settings.DEFAULT_INSTRUMENT and p.size > 0 for p in positions)

            # 5. Multi-Strategy Evaluation across all enabled strategies in StrategyRegistry
            load_all_strategies()
            all_meta = strategy_registry.list_strategies()
            active_strategies = [m for m in all_meta if m.get("enabled")]

            signals_to_process = []
            if active_strategies:
                for smeta in active_strategies:
                    sid = smeta["strategy_id"]
                    try:
                        inst = strategy_registry.get_instance(sid)
                        sig_res = inst.generate_signal(
                            df=df,
                            instrument=settings.DEFAULT_INSTRUMENT,
                            timeframe=smeta.get("timeframe", "5m"),
                            has_open_long=has_open_long,
                        )
                        if sig_res and sig_res.signal_type in ("BUY", "SELL"):
                            signals_to_process.append(signal_from_strategy_result(sig_res))
                    except Exception as ex:
                        logger.error(f"Strategy {sid} evaluation failed: {ex}")
            else:
                # Baseline fallback evaluation
                default_sig = strategy_engine.evaluate(
                    df=df,
                    instrument=settings.DEFAULT_INSTRUMENT,
                    has_open_long=has_open_long,
                )
                if default_sig and default_sig.signal_type in ("BUY", "SELL"):
                    signals_to_process.append(default_sig)

            # 6. Process generated signals through Risk & Execution Engines
            for signal in signals_to_process:
                decision: RiskDecision = risk_engine.validate_signal(
                    signal=signal,
                    db=db,
                    wallet_balances=balances,
                )

                # Record signal in database
                status = "APPROVED" if decision.approved else "REJECTED"
                strategy_engine.record_signal(
                    db=db,
                    signal=signal,
                    validation_status=status,
                    rejection_reason=None if decision.approved else decision.reason,
                )

                # 7. Execution Engine (if risk approved)
                if decision.approved:
                    logger.info(f"Signal {signal.signal_id} APPROVED by Risk Engine. Initiating order placement...")
                    success, order, msg = await execution_engine.execute_approved_signal(
                        signal=signal,
                        decision=decision,
                        db=db,
                        client=client,
                    )

                    if success and order and order.status == "FILLED":
                        position_manager.record_fill_as_trade(
                            db=db,
                            order=order,
                            fill_price=signal.close_price,
                            fill_qty=decision.allowed_quantity,
                        )
                        # Resync positions after fill
                        await position_manager.synchronize_positions(db, client=client)

        finally:
            db.close()


trading_loop = TradingLoop()


def signal_from_strategy_result(result: StrategySignalResult) -> StrategySignal:
    """Convert a StrategySignalResult (plugin output) to a StrategySignal for the risk/execution pipeline."""
    fast_ema = result.indicators.get("fast_ema", 0.0)
    slow_ema = result.indicators.get("slow_ema", 0.0)
    return StrategySignal(
        instrument=result.instrument,
        signal_type=result.signal_type,
        fast_ema=fast_ema,
        slow_ema=slow_ema,
        candle_timestamp=result.candle_timestamp,
        close_price=result.close_price,
        timeframe=result.timeframe,
    )