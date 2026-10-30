import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ZapOff,
  RefreshCw,
  Sliders,
  TrendingDown,
  PieChart,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

export const RiskCenterPage = () => {
  const { addNotification } = useNotifications();

  const [riskData, setRiskData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Limits
  const [lossLimit, setLossLimit] = useState(500);
  const [exposureLimit, setExposureLimit] = useState(20);
  const [maxOrderQty, setMaxOrderQty] = useState(0.05);
  const [stopLossPct, setStopLossPct] = useState(2);
  const [takeProfitPct, setTakeProfitPct] = useState(4);
  const [isUpdating, setIsUpdating] = useState(false);

  // Kill Switch
  const [isTriggering, setIsTriggering] = useState(false);
  const [killReason, setKillReason] = useState('Manual Operator Risk Halt');

  const fetchRiskStatus = async () => {
    setIsLoading(true);
    try {
      const res = await api.risk.getStatus();
      if (res && res.limits) {
        setRiskData(res);
        setLossLimit(res.limits.daily_loss_limit);
        setExposureLimit(res.limits.max_position_exposure * 100);
        setMaxOrderQty(res.limits.max_order_qty);
        setStopLossPct(res.limits.stop_loss_pct * 100);
        setTakeProfitPct(res.limits.take_profit_pct * 100);
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskStatus();
  }, []);

  const handleUpdateLimits = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await api.risk.updateLimits({
        daily_loss_limit: parseFloat(lossLimit),
        max_position_exposure: parseFloat(exposureLimit) / 100,
        max_order_qty: parseFloat(maxOrderQty),
        stop_loss_pct: parseFloat(stopLossPct) / 100,
        take_profit_pct: parseFloat(takeProfitPct) / 100,
      });

      if (res.success) {
        addNotification({
          title: 'Risk Parameters Updated',
          message: `Daily loss limit set to $${lossLimit}, Max exposure to ${exposureLimit}%.`,
          type: 'success',
        });
        fetchRiskStatus();
      }
    } catch (err) {
      addNotification({
        title: 'Update Failed',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTriggerKillSwitch = async () => {
    if (!window.confirm('CRITICAL ACTION: This will immediately HALT all algorithmic execution and CANCEL eligible pending orders. Continue?')) {
      return;
    }

    setIsTriggering(true);
    try {
      const res = await api.risk.killSwitch(killReason, true);
      if (res.success) {
        addNotification({
          title: 'EMERGENCY KILL SWITCH ACTIVATED',
          message: 'All strategy loops halted. Pending orders cancelled.',
          type: 'error',
        });
        fetchRiskStatus();
      }
    } catch (err) {
      addNotification({
        title: 'Kill Switch Error',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleResetKillSwitch = async () => {
    try {
      const res = await api.risk.resetKillSwitch();
      if (res.success) {
        addNotification({
          title: 'Kill Switch Disengaged',
          message: 'Risk state normal. Strategy execution can now resume.',
          type: 'success',
        });
        fetchRiskStatus();
      }
    } catch (err) {
      addNotification({
        title: 'Reset Error',
        message: err.message,
        type: 'error',
      });
    }
  };

  const isEmergencyActive = riskData?.emergency_stop;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold text-white">Risk Command Center</h1>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                isEmergencyActive
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isEmergencyActive ? 'KILL SWITCH ENGAGED' : 'RISK ENGINE ACTIVE'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time portfolio exposure limits, pre-trade signal validation, and emergency circuit breakers.
          </p>
        </div>

        <button
          onClick={fetchRiskStatus}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Emergency Kill Switch Banner */}
      <div
        className={`rounded-2xl p-6 border transition-all ${
          isEmergencyActive
            ? 'bg-rose-950/40 border-rose-500/60 shadow-2xl shadow-rose-950/50'
            : 'bg-[#0e121e] border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className={`w-6 h-6 ${isEmergencyActive ? 'text-rose-400 animate-bounce' : 'text-slate-400'}`} />
              <h2 className="text-base font-heading font-bold text-white">Emergency Kill Switch (Circuit Breaker)</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Instantly terminates all automated order dispatching loops and cancels open orders across connected exchanges.
              {isEmergencyActive && (
                <span className="block mt-1 font-mono text-rose-300 font-semibold">
                  Reason: {riskData?.emergency_stop_reason || 'Manual Operator Trigger'}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isEmergencyActive ? (
              <button
                onClick={handleResetKillSwitch}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Disengage Kill Switch</span>
              </button>
            ) : (
              <button
                onClick={handleTriggerKillSwitch}
                disabled={isTriggering}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs transition-all shadow-lg shadow-rose-600/30"
              >
                <ZapOff className="w-4 h-4" />
                <span>{isTriggering ? 'HALTING...' : 'ENGAGE KILL SWITCH'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Current Exposure</span>
          <div className="text-xl font-mono font-bold text-white">
            {riskData?.live_metrics?.current_exposure || 0.0} BTC
          </div>
          <span className="text-[10px] text-slate-500">Max allowed: {riskData?.limits?.max_position_exposure * 100}% of equity</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Daily Realized P&amp;L</span>
          <div
            className={`text-xl font-mono font-bold ${
              (riskData?.live_metrics?.daily_realized_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${(riskData?.live_metrics?.daily_realized_pnl || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">Loss Limit: -${riskData?.limits?.daily_loss_limit || 500}</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Open Orders Managed</span>
          <div className="text-xl font-mono font-bold text-cyan-400">
            {riskData?.live_metrics?.open_orders_count || 0}
          </div>
          <span className="text-[10px] text-slate-500">Max concurrent: {riskData?.limits?.max_open_orders || 3}</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Risk Pre-Trade Filters</span>
          <div className="text-xl font-mono font-bold text-[#00FF66]">
            {riskData?.live_metrics?.signals_risk_approved || 0} PASS
          </div>
          <span className="text-[10px] text-rose-400">
            {riskData?.live_metrics?.signals_risk_rejected || 0} Blocked by Limits
          </span>
        </div>
      </div>

      {/* Dynamic Limits Configuration Form */}
      <div className="rounded-2xl border border-slate-800 bg-[#090d18] p-6 space-y-5 shadow-xl">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-heading font-bold text-white uppercase tracking-wider">
            Risk Guardrails &amp; Position Sizing Policy
          </h2>
        </div>

        <form onSubmit={handleUpdateLimits} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Daily Loss Ceiling ($)
              </label>
              <input
                type="number"
                step="50"
                min="50"
                value={lossLimit}
                onChange={(e) => setLossLimit(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Halts trading loop if exceeded</span>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Max Portfolio Exposure (%)
              </label>
              <input
                type="number"
                step="1"
                min="5"
                max="100"
                value={exposureLimit}
                onChange={(e) => setExposureLimit(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Maximum total position capital allocation</span>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Max Order Quantity (BTC)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={maxOrderQty}
                onChange={(e) => setMaxOrderQty(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Single order clip ceiling</span>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Default Stop Loss (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={stopLossPct}
                onChange={(e) => setStopLossPct(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Automatic invalidation distance</span>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Default Take Profit (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="50"
                value={takeProfitPct}
                onChange={(e) => setTakeProfitPct(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Target profit horizon</span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3">
            <button
              type="submit"
              disabled={isUpdating}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
            >
              {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Save Risk Guardrails</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RiskCenterPage;
