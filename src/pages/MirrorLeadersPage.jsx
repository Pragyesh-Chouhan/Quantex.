import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Activity,
  Play,
  Square,
  BarChart2,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  TrendingUp,
  Cpu,
  ArrowRight,
  ChevronRight,
  Sliders,
  FileCode,
  Info,
  X,
  Compass,
  Users,
  Copy,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useTrading } from '../context/TradingContext';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { api } from '../services/api';

// MirrorPip-inspired timeframe filters (1D, 1W, 1M, 3M, 1Y, All)
const TIMEFRAME_FILTERS = [
  { id: '1D', label: '1D', category: 'Day', expectedCount: 6 },
  { id: '1W', label: '1W', category: '1 Month', expectedCount: 6 },
  { id: '1M', label: '1M', category: '1 Month', expectedCount: 6 },
  { id: '3M', label: '3M', category: '3 Months', expectedCount: 6 },
  { id: '1Y', label: '1Y', category: '1 Year', expectedCount: 6 },
  { id: 'All', label: 'All', category: null, expectedCount: 24 },
];

export const MirrorLeadersPage = () => {
  const { addToast } = useNotifications();
  const { user } = useAuth();
  const currentUserId = user?.user_id || user?.id || 'default_user';
  const { activeAccountStatus, refreshRealData } = useTrading();

  // Main navigation tab: 'leaders' (Verified Quantitative Leaders) | 'registry' (All 24 Strategy Slots)
  const [activeMainTab, setActiveMainTab] = useState('leaders');

  // Mirror Leaders State
  const [leaders, setLeaders] = useState([]);
  const [leadersLoading, setLeadersLoading] = useState(true);
  const [leadersError, setLeadersError] = useState(null);
  const [selectedLeaderForMirror, setSelectedLeaderForMirror] = useState(null);
  const [mirrorAllocation, setMirrorAllocation] = useState(1000);
  const [mirrorSlippage, setMirrorSlippage] = useState(0.002);
  const [isMirrorSubmitting, setIsMirrorSubmitting] = useState(false);

  // Strategy Registry State
  const [strategies, setStrategies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | ACTIVE | STOPPED
  const [sortBy, setSortBy] = useState('name'); // name | category | timeframe

  // Modals state
  const [inspectStrategy, setInspectStrategy] = useState(null);
  const [backtestStrategy, setBacktestStrategy] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestCapital, setBacktestCapital] = useState(10000);
  const [actionLoading, setActionLoading] = useState({});

  // Fetch verified mirror leaders
  const fetchMirrorLeaders = async () => {
    setLeadersLoading(true);
    setLeadersError(null);
    try {
      const res = await api.mirror.getLeaders();
      if (res && res.error) {
        setLeadersError(res.error);
      } else if (Array.isArray(res)) {
        setLeaders(res);
      } else {
        setLeaders([]);
      }
    } catch (err) {
      setLeadersError(err.message || 'Failed to fetch verified leaders');
    } finally {
      setLeadersLoading(false);
    }
  };

  // Fetch strategies from backend API
  const fetchStrategies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.strategies.list();
      if (res && res.error) {
        setError(res.error);
        addToast({ type: 'error', message: `Failed to load strategies: ${res.error}` });
      } else if (Array.isArray(res)) {
        setStrategies(res);
      } else {
        setStrategies([]);
      }
    } catch (err) {
      setError(err.message || 'Network error fetching strategies');
      addToast({ type: 'error', message: 'Unable to reach backend strategy registry' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
    fetchMirrorLeaders();
  }, []);

  // Execute mirror strategy subscription
  const handleConfirmMirror = async () => {
    if (!selectedLeaderForMirror) return;
    setIsMirrorSubmitting(true);
    try {
      const res = await api.mirror.follow(selectedLeaderForMirror.leader_id, {
        leader_id: selectedLeaderForMirror.leader_id,
        user_id: currentUserId,
        allocation_usd: Number(mirrorAllocation) || 1000,
        max_slippage_pct: Number(mirrorSlippage) || 0.002,
      });

      if (res && res.error) {
        addToast({ type: 'error', message: `Mirror activation failed: ${res.error}` });
      } else {
        addToast({
          type: 'success',
          message: `Successfully mirrored "${selectedLeaderForMirror.name}". Real-time signal routing enabled.`,
        });
        setSelectedLeaderForMirror(null);
        if (refreshRealData) refreshRealData();
      }
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Mirror execution failed' });
    } finally {
      setIsMirrorSubmitting(false);
    }
  };

  // Toggle strategy start / stop
  const handleToggleStrategy = async (strategy) => {
    const sid = strategy.strategy_id;
    const isCurrentlyEnabled = strategy.enabled;
    setActionLoading((prev) => ({ ...prev, [sid]: true }));

    try {
      if (isCurrentlyEnabled) {
        const res = await api.strategies.stop(sid);
        if (res && res.error) {
          addToast({ type: 'error', message: `Stop failed: ${res.error}` });
        } else {
          addToast({ type: 'info', message: `${strategy.strategy_name} stopped (Standby)` });
          setStrategies((prev) =>
            prev.map((s) => (s.strategy_id === sid ? { ...s, enabled: false } : s))
          );
        }
      } else {
        const res = await api.strategies.start(sid);
        if (res && res.error) {
          addToast({ type: 'error', message: `Start failed: ${res.error}` });
        } else {
          addToast({
            type: 'success',
            message: `${strategy.strategy_name} started in Paper Trading mode`,
          });
          setStrategies((prev) =>
            prev.map((s) => (s.strategy_id === sid ? { ...s, enabled: true } : s))
          );
        }
      }
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to toggle strategy' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [sid]: false }));
    }
  };

  // Run backtest
  const handleRunBacktest = async (strategy) => {
    setBacktestStrategy(strategy);
    setBacktestResult(null);
    setBacktestLoading(true);

    try {
      // Fetch real recent candles from Delta Exchange market API for backtesting
      const candleRes = await api.markets.getCandles('BTCUSD', '5m', 100);
      let candles = [];
      if (candleRes && candleRes.candles && Array.isArray(candleRes.candles)) {
        candles = candleRes.candles;
      } else if (Array.isArray(candleRes)) {
        candles = candleRes;
      }

      if (!candles || candles.length < 5) {
        throw new Error('Insufficient historical market candles returned from Delta Exchange');
      }

      const res = await api.strategies.backtest(strategy.strategy_id, {
        candles: candles,
        initial_capital: Number(backtestCapital) || 10000,
        fee_pct: 0.0005,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }
      setBacktestResult(res);
      addToast({
        type: 'success',
        message: `Backtest completed for ${strategy.strategy_name} (${res.total_trades} trades)`,
      });
    } catch (err) {
      setBacktestResult({
        error: err.message || 'Backtest failed with provided parameters',
      });
      addToast({ type: 'error', message: err.message || 'Backtest failed' });
    } finally {
      setBacktestLoading(false);
    }
  };

  // Filtered strategies matching MirrorPip timeframes (1D, 1W, 1M, 3M, 1Y, All)
  const filteredStrategies = useMemo(() => {
    return strategies.filter((s) => {
      // Timeframe filters
      if (activeCategory === '1D' && s.category !== 'Day') return false;
      if (activeCategory === '1W' && s.category !== '1 Month') return false;
      if (activeCategory === '1M' && s.category !== '1 Month') return false;
      if (activeCategory === '3M' && s.category !== '3 Months') return false;
      if (activeCategory === '1Y' && s.category !== '1 Year') return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && !s.enabled) return false;
      if (statusFilter === 'STOPPED' && s.enabled) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (s.strategy_name || '').toLowerCase().includes(q);
        const matchDesc = (s.description || '').toLowerCase().includes(q);
        const matchId = (s.strategy_id || '').toLowerCase().includes(q);
        const matchInst = (s.supported_instruments || []).some((i) =>
          i.toLowerCase().includes(q)
        );
        if (!matchName && !matchDesc && !matchId && !matchInst) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return (a.strategy_name || '').localeCompare(b.strategy_name || '');
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      if (sortBy === 'timeframe') return (a.timeframe || '').localeCompare(b.timeframe || '');
      return 0;
    });
  }, [strategies, activeCategory, statusFilter, searchQuery, sortBy]);

  // Calculate missing slots for honest display
  const categorySummary = useMemo(() => {
    const summary = {
      Day: { present: 0, target: 6 },
      '1 Month': { present: 0, target: 6 },
      '3 Months': { present: 0, target: 6 },
      '1 Year': { present: 0, target: 6 },
    };
    strategies.forEach((s) => {
      if (summary[s.category]) {
        summary[s.category].present += 1;
      }
    });
    return summary;
  }, [strategies]);

  const activeCount = useMemo(() => strategies.filter((s) => s.enabled).length, [strategies]);

  // Determine missing card placeholders for active timeframe filter
  const missingSlots = useMemo(() => {
    if (activeCategory === 'All') return [];
    let cat = null;
    if (activeCategory === '1D') cat = 'Day';
    else if (activeCategory === '1W' || activeCategory === '1M') cat = '1 Month';
    else if (activeCategory === '3M') cat = '3 Months';
    else if (activeCategory === '1Y') cat = '1 Year';
    if (!cat) return [];

    const info = categorySummary[cat];
    if (!info) return [];
    const missingCount = Math.max(0, info.target - info.present);
    return Array.from({ length: missingCount }, (_, idx) => ({
      slotIndex: info.present + idx + 1,
      target: info.target,
      category: cat,
    }));
  }, [activeCategory, categorySummary]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top View Selector Switcher: Verified Leaders vs Registry Hub */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-3xl bg-[#080c14] border border-white/[0.08] shadow-2xl">
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-white/[0.06] w-full sm:w-auto">
          <button
            onClick={() => setActiveMainTab('leaders')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeMainTab === 'leaders'
                ? 'bg-[#00FF66] text-black shadow-lg shadow-[#00FF66]/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Quant Leaders</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                activeMainTab === 'leaders' ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {leaders.length} Active
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('registry')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeMainTab === 'registry'
                ? 'bg-[#00FF66] text-black shadow-lg shadow-[#00FF66]/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Strategy Registry (24 Slots)</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                activeMainTab === 'registry' ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {strategies.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />
          <span>Execution Target:</span>
          <span className="font-bold text-white px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">
            {activeAccountStatus?.has_active_account ? 'Delta Exchange India Live' : 'Paper Trading Engine'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: VERIFIED QUANTITATIVE STRATEGY LEADERS                            */}
      {/* ========================================================================= */}
      {activeMainTab === 'leaders' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-3xl bg-[#080c14] border border-white/[0.08] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00FF66]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-2xl font-heading font-extrabold text-white tracking-tight">
                    Verified Strategy Leaders & Quant Mirroring
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] font-mono text-[11px] font-bold">
                    VERIFIED QUANT MODELS
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[11px] font-bold">
                    ZERO SYNTHETIC PROFILES
                  </span>
                </div>
                <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
                  Systematic quantitative models with verified execution logic. Mirror any strategy directly onto your authenticated Delta Exchange India account or virtual paper trading portfolio. All metrics reflect actual backtest executions.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchMirrorLeaders}
                disabled={leadersLoading}
                className="border-white/[0.1] bg-slate-900/60 hover:bg-slate-800 text-slate-200 self-start lg:self-center"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${leadersLoading ? 'animate-spin' : ''}`} />}
              >
                Refresh Leaders
              </Button>
            </div>

            {/* Mandatory Platform Transparency Disclosure */}
            <div className="mt-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-200 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">Platform Quantitative Disclosure: </span>
                All listed strategies are platform-provided algorithmic quantitative templates. We do not host speculative retail social traders or fabricated influencer accounts. Mirroring executes deterministic mathematical rules with your configured capital allocation.
              </div>
            </div>
          </div>

          {/* Leaders Grid */}
          {leadersLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-[#00FF66] animate-spin mb-3" />
              <div className="text-sm font-mono text-white font-semibold">Loading Verified Strategy Leaders...</div>
              <div className="text-xs font-mono text-slate-400 mt-1">Connecting to QuantEX Verified Leader Registry</div>
            </div>
          ) : leadersError ? (
            <div className="p-8 rounded-3xl bg-rose-950/20 border border-rose-500/20 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-white">Failed to Load Leaders</h3>
              <p className="text-xs font-mono text-rose-300 mt-1">{leadersError}</p>
              <Button variant="primary" size="sm" onClick={fetchMirrorLeaders} className="mt-4">
                Retry Connection
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {leaders.map((leader) => (
                <div
                  key={leader.leader_id}
                  className="rounded-3xl bg-[#090d16] border border-white/[0.08] hover:border-[#00FF66]/30 p-6 flex flex-col justify-between shadow-xl transition-all duration-200 relative group"
                >
                  <div className="space-y-4">
                    {/* Header: Name, Template Type & Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[10px] font-bold">
                            {leader.is_platform_template ? 'PLATFORM QUANT TEMPLATE' : 'EXTERNAL LEADER'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] font-mono text-[10px] font-bold">
                            {leader.badge}
                          </span>
                        </div>
                        <h3 className="text-xl font-heading font-bold text-white group-hover:text-[#00FF66] transition-colors">
                          {leader.name}
                        </h3>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Strategy: <span className="text-slate-300 font-semibold">{leader.strategy_id}</span> • Pair: <span className="text-cyan-400 font-bold">{leader.instrument}</span> • Frame: <span className="text-amber-400 font-bold">{leader.timeframe}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-mono uppercase text-slate-500">1Y Net ROI</div>
                        <div className="text-xl font-mono font-bold text-[#00FF66]">
                          +{leader.net_roi_1y_pct}%
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 font-mono leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-white/[0.04]">
                      {leader.description}
                    </p>

                    {/* Primary Empirical Metrics Scorecard */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="text-[9px] uppercase font-mono text-slate-500">Win Rate</div>
                        <div className="text-base font-bold font-mono text-white mt-0.5">
                          {leader.win_rate_pct}%
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="text-[9px] uppercase font-mono text-slate-500">Profit Factor</div>
                        <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
                          {leader.profit_factor}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="text-[9px] uppercase font-mono text-slate-500">Max Drawdown</div>
                        <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                          {leader.max_drawdown_pct}%
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="text-[9px] uppercase font-mono text-slate-500">Completed Trades</div>
                        <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                          {leader.completed_trades}
                        </div>
                      </div>
                    </div>

                    {/* Sample Historical Trades Ledger */}
                    {leader.sample_trades && leader.sample_trades.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Verified Trade Ledger Samples</span>
                          <span className="text-slate-500">{leader.followers_count} Active Accounts Following</span>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-slate-950 overflow-hidden">
                          <table className="w-full text-left font-mono text-[11px]">
                            <thead className="bg-white/[0.02] text-slate-500 border-b border-white/[0.06]">
                              <tr>
                                <th className="p-2">Date</th>
                                <th className="p-2">Side</th>
                                <th className="p-2">Price</th>
                                <th className="p-2 text-right">Realized PnL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                              {leader.sample_trades.map((t, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.01]">
                                  <td className="p-2 text-slate-400">{t.date}</td>
                                  <td className="p-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-bold ${
                                        t.side === 'BUY'
                                          ? 'bg-[#00FF66]/10 text-[#00FF66]'
                                          : 'bg-rose-500/10 text-rose-400'
                                      }`}
                                    >
                                      {t.side}
                                    </span>
                                  </td>
                                  <td className="p-2 text-white">${t.price?.toLocaleString()}</td>
                                  <td className="p-2 text-right font-bold text-[#00FF66]">
                                    {t.pnl}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mirror Action Button */}
                  <div className="pt-5 mt-4 border-t border-white/[0.06]">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedLeaderForMirror(leader)}
                      leftIcon={<Copy className="w-4 h-4" />}
                    >
                      Mirror This Strategy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: FULL STRATEGY REGISTRY (24 SLOTS)                                */}
      {/* ========================================================================= */}
      {activeMainTab === 'registry' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-[#080c14] border border-white/[0.08] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00FF66]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/20 text-[#00FF66]">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-heading font-extrabold text-white tracking-tight">
                      Strategy Discovery Hub
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] font-mono text-[11px] font-bold">
                      GENUINE REPO
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[11px] font-bold">
                      PAPER TRADING
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    Explore, backtest, and deploy verified algorithmic strategies across 4 timeframes. Zero fabricated metrics or simulated copy trading.
                  </p>
                </div>
              </div>
            </div>

            {/* Global Controls & Refresh */}
            <div className="flex items-center gap-3 relative z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStrategies}
                disabled={isLoading}
                className="border-white/[0.1] bg-slate-900/60 hover:bg-slate-800 text-slate-200"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              >
                Sync Registry
              </Button>
            </div>
          </div>

          {/* Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#090d16] border border-white/[0.08] flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase font-mono text-slate-400">Total Genuine Strategies</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {strategies.length} <span className="text-xs text-slate-500 font-normal">/ 24 slots</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] text-slate-300">
                <Layers className="w-5 h-5 text-emerald-400" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d16] border border-white/[0.08] flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase font-mono text-slate-400">Active (Running)</div>
                <div className="text-2xl font-bold font-mono text-[#00FF66] mt-1">
                  {activeCount}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#00FF66]/10 text-[#00FF66]">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d16] border border-white/[0.08] flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase font-mono text-slate-400">Timeframe Categories</div>
                <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                  4 <span className="text-xs text-slate-500 font-normal">(Day, 1M, 3M, 1Y)</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#090d16] border border-white/[0.08] flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase font-mono text-slate-400">Safety Execution Mode</div>
                <div className="text-base font-bold font-mono text-amber-400 mt-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Paper Trading
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Cpu className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Timeframe Tabs (MirrorPip Reference: 1D, 1W, 1M, 3M, 1Y, All) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-white/[0.08]">
            {TIMEFRAME_FILTERS.map((tab) => {
              const isSelected = activeCategory === tab.id;
              let count = 0;
              if (tab.id === 'All') count = strategies.length;
              else if (tab.category && categorySummary[tab.category]) count = categorySummary[tab.category].present;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#00FF66] text-black shadow-md shadow-[#00FF66]/20'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                      isSelected ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}/{tab.expectedCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[#090d16] border border-white/[0.08]">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search strategy by name, ID or asset..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/[0.08] text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]/50"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-[#00FF66]/50"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Running Only</option>
                  <option value="STOPPED">Standby Only</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-[#00FF66]/50"
                >
                  <option value="name">Strategy Name</option>
                  <option value="category">Category</option>
                  <option value="timeframe">Timeframe</option>
                </select>
              </div>
            </div>
          </div>

          {/* Strategy Grid */}
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-[#00FF66] animate-spin mb-3" />
              <div className="text-sm font-mono text-white font-semibold">Loading Registered Strategies...</div>
              <div className="text-xs font-mono text-slate-400 mt-1">Connecting to QuantEX Registry Engine</div>
            </div>
          ) : error ? (
            <div className="p-8 rounded-3xl bg-rose-950/20 border border-rose-500/20 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-white">Registry Loading Error</h3>
              <p className="text-xs font-mono text-rose-300 mt-1">{error}</p>
              <Button variant="primary" size="sm" onClick={fetchStrategies} className="mt-4">
                Retry Connection
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStrategies.map((strategy) => {
                const isEnabled = strategy.enabled;
                const isActionLoading = actionLoading[strategy.strategy_id];

                return (
                  <motion.div
                    key={strategy.strategy_id}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    className={`rounded-3xl bg-[#090d16] border p-6 flex flex-col justify-between transition-all duration-200 shadow-xl relative group ${
                      isEnabled
                        ? 'border-[#00FF66]/40 shadow-[#00FF66]/5'
                        : 'border-white/[0.08] hover:border-white/[0.16]'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Category, Timeframe & Status Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold">
                            {strategy.category || 'Strategy'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/[0.06] font-mono text-[10px]">
                            {strategy.timeframe || '1h'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isEnabled ? 'bg-[#00FF66] animate-pulse' : 'bg-slate-600'
                            }`}
                          />
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                              isEnabled ? 'text-[#00FF66]' : 'text-slate-500'
                            }`}
                          >
                            {isEnabled ? 'Running' : 'Standby'}
                          </span>
                        </div>
                      </div>

                      {/* Strategy Name & ID */}
                      <h3 className="font-heading font-bold text-white text-lg group-hover:text-[#00FF66] transition-colors">
                        {strategy.strategy_name}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-500 mb-2">
                        ID: {strategy.strategy_id} • v{strategy.strategy_version || '1.0.0'}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                        {strategy.description || 'Algorithmic quantitative trading strategy.'}
                      </p>

                      {/* Spec Sheet */}
                      <div className="grid grid-cols-2 gap-2 py-3 border-y border-white/[0.06] text-xs font-mono mb-4">
                        <div className="p-2 rounded-xl bg-white/[0.02]">
                          <div className="text-[9px] uppercase text-slate-500">Evaluation</div>
                          <div className="text-slate-200 font-bold mt-0.5 truncate">
                            {strategy.evaluation_window || strategy.category}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-white/[0.02]">
                          <div className="text-[9px] uppercase text-slate-500">Holding Horizon</div>
                          <div className="text-slate-200 font-bold mt-0.5 truncate">
                            {strategy.holding_horizon || 'Session'}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-white/[0.02]">
                          <div className="text-[9px] uppercase text-slate-500">Execution Mode</div>
                          <div className="text-amber-400 font-bold mt-0.5 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Paper
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-white/[0.02]">
                          <div className="text-[9px] uppercase text-slate-500">Instruments</div>
                          <div className="text-cyan-300 font-bold mt-0.5 truncate">
                            {(strategy.supported_instruments || ['BTCUSD']).join(', ')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="space-y-2 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectStrategy(strategy)}
                          className="border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.06] text-slate-300 text-xs"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRunBacktest(strategy)}
                          className="border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-900/30 text-cyan-300 text-xs"
                          leftIcon={<BarChart2 className="w-3.5 h-3.5 text-cyan-400" />}
                        >
                          Run Backtest
                        </Button>
                      </div>

                      <Button
                        variant={isEnabled ? 'danger' : 'primary'}
                        size="sm"
                        className="w-full"
                        disabled={isActionLoading}
                        onClick={() => handleToggleStrategy(strategy)}
                        leftIcon={
                          isActionLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isEnabled ? (
                            <Square className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        {isActionLoading
                          ? 'Processing...'
                          : isEnabled
                          ? 'Stop Strategy'
                          : 'Deploy in Paper Mode'}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}

              {/* Missing Strategy Placeholders — Transparent & Honest */}
              {missingSlots.map((missing) => (
                <div
                  key={`missing-${missing.category}-${missing.slotIndex}`}
                  className="rounded-3xl bg-[#090d16]/40 border border-dashed border-amber-500/30 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">
                        {missing.category} Slot #{missing.slotIndex}
                      </span>
                      <span className="text-[10px] font-mono text-amber-500/80 font-semibold uppercase">
                        Missing Source
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      <h3 className="font-heading font-bold text-slate-300 text-base">
                        Pending Strategy Script
                      </h3>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Slot {missing.slotIndex} of {missing.target} in {missing.category}. No genuine implementation found in workspace folder.
                      We never generate fake cards or artificial performance.
                    </p>

                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] font-mono text-amber-200/80">
                      <span className="font-bold text-amber-300">Action:</span> Provide python script in <code className="text-white">backend/app/strategies/</code> implementing BaseStrategy to activate.
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={true}
                      className="w-full border-white/[0.06] text-slate-500 cursor-not-allowed text-xs"
                    >
                      Unpopulated Slot
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: MIRROR LEADER SUBSCRIPTION CONFIGURATION                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedLeaderForMirror && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-[#090d16] border border-white/[0.12] p-6 shadow-2xl space-y-6"
            >
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-heading font-bold text-white">
                      Mirror Strategy: {selectedLeaderForMirror.name}
                    </h2>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    System Model: <span className="text-[#00FF66] font-bold">{selectedLeaderForMirror.strategy_id}</span> ({selectedLeaderForMirror.instrument} • {selectedLeaderForMirror.timeframe})
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLeaderForMirror(null)}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Execution Account Routing Indicator */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/[0.06] space-y-2">
                <div className="text-[10px] font-mono uppercase text-slate-500">Order Routing Target</div>
                {activeAccountStatus?.has_active_account ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-[#00FF66]">
                    <CheckCircle2 className="w-4 h-4 text-[#00FF66]" />
                    <span className="font-bold">Delta Exchange India (Live Account Connected)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold">Paper Trading Sandbox (Safe Simulation)</span>
                  </div>
                )}
                <div className="text-[11px] font-mono text-slate-400">
                  {activeAccountStatus?.has_active_account
                    ? 'Orders will execute using your authenticated Delta Exchange India API credentials with protective risk bounds.'
                    : 'No exchange account is linked yet. Mirrored signals will execute within your virtual paper trading balance.'}
                </div>
              </div>

              {/* Parameters: Allocation & Max Slippage */}
              <div className="space-y-4 text-xs font-mono">
                <div>
                  <label className="text-slate-400 uppercase text-[10px] block mb-1">
                    Allocation Capital (USD $)
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="100"
                    value={mirrorAllocation}
                    onChange={(e) => setMirrorAllocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-white font-mono focus:outline-none focus:border-[#00FF66]/50"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Maximum position size allocated to this quantitative strategy.
                  </span>
                </div>

                <div>
                  <label className="text-slate-400 uppercase text-[10px] block mb-1">
                    Max Slippage Tolerance (Fraction, e.g. 0.002 = 0.2%)
                  </label>
                  <input
                    type="number"
                    step="0.0005"
                    min="0.0005"
                    max="0.01"
                    value={mirrorSlippage}
                    onChange={(e) => setMirrorSlippage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-white font-mono focus:outline-none focus:border-[#00FF66]/50"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Executions exceeding this slippage limit will be automatically aborted.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLeaderForMirror(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isMirrorSubmitting}
                  onClick={handleConfirmMirror}
                  leftIcon={
                    isMirrorSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )
                  }
                >
                  {isMirrorSubmitting ? 'Subscribing...' : 'Confirm & Start Mirroring'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: STRATEGY INSPECTOR MODAL                                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {inspectStrategy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl bg-[#090d16] border border-white/[0.12] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-heading font-bold text-white">
                      {inspectStrategy.strategy_name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#00FF66]/10 text-[#00FF66] font-mono text-xs font-bold">
                      {inspectStrategy.category}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    System Identifier: <span className="text-white font-bold">{inspectStrategy.strategy_id}</span>
                  </div>
                </div>
                <button
                  onClick={() => setInspectStrategy(null)}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <div className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Description & Methodology
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/[0.06] text-slate-300 leading-relaxed">
                    {inspectStrategy.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/[0.06]">
                    <div className="text-slate-500 uppercase text-[9px]">Candle Resolution</div>
                    <div className="text-white font-bold text-sm mt-1">{inspectStrategy.timeframe}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/[0.06]">
                    <div className="text-slate-500 uppercase text-[9px]">Evaluation Period</div>
                    <div className="text-white font-bold text-sm mt-1">{inspectStrategy.evaluation_window}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/[0.06]">
                    <div className="text-slate-500 uppercase text-[9px]">Holding Duration</div>
                    <div className="text-white font-bold text-sm mt-1">{inspectStrategy.holding_horizon}</div>
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Operational Safety & Risk Bounds
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/[0.06] space-y-1.5 text-slate-300">
                    <div>• <span className="text-slate-400">Position Sizing:</span> Maximum 5% equity allocation per signal</div>
                    <div>• <span className="text-slate-400">Execution Intent:</span> Strict BUY / SELL / HOLD pipeline with idempotency</div>
                    <div>• <span className="text-slate-400">Order Routing:</span> Paper Trading Engine (No real funds risked)</div>
                    <div>• <span className="text-slate-400">Supported Pairs:</span> {(inspectStrategy.supported_instruments || []).join(', ')}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button variant="outline" size="sm" onClick={() => setInspectStrategy(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const target = inspectStrategy;
                    setInspectStrategy(null);
                    handleRunBacktest(target);
                  }}
                  leftIcon={<BarChart2 className="w-4 h-4" />}
                >
                  Backtest Strategy
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: HISTORICAL BACKTESTING MODAL                                     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {backtestStrategy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl bg-[#090d16] border border-white/[0.12] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-heading font-bold text-white">
                      Historical Backtester
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono text-xs font-bold">
                      {backtestStrategy.strategy_name}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    Powered by Delta Exchange Historical OHLCV Candles
                  </div>
                </div>
                <button
                  onClick={() => setBacktestStrategy(null)}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Backtest Parameters */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <label className="text-slate-400 uppercase text-[10px] block mb-1">Initial Capital ($)</label>
                  <input
                    type="number"
                    value={backtestCapital}
                    onChange={(e) => setBacktestCapital(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-white font-mono focus:outline-none focus:border-[#00FF66]/50"
                  />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[10px] block mb-1">Asset Pair</label>
                  <input
                    type="text"
                    disabled={true}
                    value="BTCUSD (Delta Perpetual)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Status or Results */}
              {backtestLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                  <div className="text-sm font-mono text-white font-semibold">Running Backtest Simulation...</div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    Evaluating signals against historical candle series
                  </div>
                </div>
              ) : backtestResult ? (
                backtestResult.error ? (
                  <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/20 text-xs font-mono text-rose-300">
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-4 h-4 text-rose-400" /> Backtest Simulation Notice
                    </div>
                    {backtestResult.error}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-2xl bg-slate-950 border border-white/[0.06]">
                        <div className="text-slate-500 uppercase text-[9px]">Final Capital</div>
                        <div className="text-base font-bold text-white mt-1">
                          {formatCurrency(backtestResult.final_capital)}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-950 border border-white/[0.06]">
                        <div className="text-slate-500 uppercase text-[9px]">Net Return</div>
                        <div
                          className={`text-base font-bold mt-1 ${
                            backtestResult.net_profit >= 0 ? 'text-[#00FF66]' : 'text-rose-400'
                          }`}
                        >
                          {backtestResult.roi_pct >= 0 ? '+' : ''}
                          {backtestResult.roi_pct}%
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-950 border border-white/[0.06]">
                        <div className="text-slate-500 uppercase text-[9px]">Total Trades</div>
                        <div className="text-base font-bold text-cyan-400 mt-1">
                          {backtestResult.total_trades}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-950 border border-white/[0.06]">
                        <div className="text-slate-500 uppercase text-[9px]">Win Rate</div>
                        <div className="text-base font-bold text-emerald-400 mt-1">
                          {backtestResult.win_rate_pct}%
                        </div>
                      </div>
                    </div>

                    {backtestResult.trades && backtestResult.trades.length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                          Recent Backtest Execution Fills ({backtestResult.trades.length})
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-slate-950">
                          <table className="w-full text-left font-mono text-[11px]">
                            <thead className="bg-white/[0.02] text-slate-500 border-b border-white/[0.06]">
                              <tr>
                                <th className="p-2">Action</th>
                                <th className="p-2">Price</th>
                                <th className="p-2">Quantity</th>
                                <th className="p-2 text-right">Realized PnL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                              {backtestResult.trades.map((t, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.01]">
                                  <td className="p-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-bold ${
                                        t.action === 'BUY'
                                          ? 'bg-[#00FF66]/10 text-[#00FF66]'
                                          : 'bg-rose-500/10 text-rose-400'
                                      }`}
                                    >
                                      {t.action}
                                    </span>
                                  </td>
                                  <td className="p-2 text-white">${t.price}</td>
                                  <td className="p-2 text-slate-300">{t.qty}</td>
                                  <td
                                    className={`p-2 text-right font-bold ${
                                      (t.realized_pnl || 0) >= 0
                                        ? 'text-[#00FF66]'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    {t.realized_pnl !== undefined
                                      ? `${t.realized_pnl >= 0 ? '+' : ''}$${t.realized_pnl}`
                                      : '--'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : null}

              <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                <div className="text-[11px] font-mono text-slate-500">
                  Historical backtesting simulates fills with 0.05% fee assumptions.
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBacktestStrategy(null)}>
                    Dismiss
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={backtestLoading}
                    onClick={() => handleRunBacktest(backtestStrategy)}
                    leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${backtestLoading ? 'animate-spin' : ''}`} />}
                  >
                    Rerun Simulation
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MirrorLeadersPage;
