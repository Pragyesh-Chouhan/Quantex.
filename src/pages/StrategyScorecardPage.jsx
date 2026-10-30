import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  BarChart2,
  TrendingUp,
  Shield,
  Layers,
  ArrowUpDown,
  CheckCircle,
  Filter,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';

export const StrategyScorecardPage = () => {
  const [scorecardData, setScorecardData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('composite'); // 'composite' | 'sharpe' | 'return' | 'win_rate'
  const [selectedForComparison, setSelectedForComparison] = useState([]);

  const fetchScorecard = async () => {
    setIsLoading(true);
    try {
      const res = await api.strategies.getScorecard();
      if (res && Array.isArray(res.scorecard)) {
        setScorecardData(res.scorecard);
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(scorecardData.map((s) => s.category));
    return ['ALL', ...Array.from(set)];
  }, [scorecardData]);

  const filteredAndSorted = useMemo(() => {
    let list = scorecardData;
    if (selectedCategory !== 'ALL') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'sharpe') return b.sharpe_ratio - a.sharpe_ratio;
      if (sortBy === 'return') return b.net_return_pct - a.net_return_pct;
      if (sortBy === 'win_rate') return b.win_rate_pct - a.win_rate_pct;
      // Default: Composite score
      const scoreA = a.sharpe_ratio * 20 + a.net_return_pct * 0.5 + a.win_rate_pct * 0.3;
      const scoreB = b.sharpe_ratio * 20 + b.net_return_pct * 0.5 + b.win_rate_pct * 0.3;
      return scoreB - scoreA;
    });
  }, [scorecardData, selectedCategory, sortBy]);

  const toggleComparison = (id) => {
    if (selectedForComparison.includes(id)) {
      setSelectedForComparison(selectedForComparison.filter((x) => x !== id));
    } else {
      if (selectedForComparison.length >= 3) {
        alert('You can compare a maximum of 3 strategies simultaneously.');
        return;
      }
      setSelectedForComparison([...selectedForComparison, id]);
    }
  };

  const comparedStrategies = useMemo(() => {
    return scorecardData.filter((s) => selectedForComparison.includes(s.strategy_id));
  }, [scorecardData, selectedForComparison]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold text-white">Strategy Battle Arena</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
              18 QUANT MODELS AUDITED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Empirical multi-metric ranking across identical Delta BTC/ETH historical datasets with fees and slippage modeling.
          </p>
        </div>

        <button
          onClick={fetchScorecard}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Benchmarks</span>
        </button>
      </div>

      {/* Filter and Sorter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#090d18] border border-slate-800">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-500/20 text-[#00FF66] font-bold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
          <span>Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
          >
            <option value="composite">Quant Composite Score</option>
            <option value="sharpe">Sharpe Ratio (Risk-Adjusted)</option>
            <option value="return">Net Return (%)</option>
            <option value="win_rate">Win Rate (%)</option>
          </select>
        </div>
      </div>

      {/* Side-by-Side Comparison Box if strategies selected */}
      {comparedStrategies.length > 0 && (
        <div className="rounded-2xl border border-cyan-500/30 bg-[#091122] p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-heading font-bold text-white uppercase tracking-wider">
                Head-to-Head Comparison ({comparedStrategies.length}/3)
              </h2>
            </div>
            <button
              onClick={() => setSelectedForComparison([])}
              className="text-[10px] font-mono text-slate-400 hover:text-white"
            >
              Clear Comparison
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparedStrategies.map((s) => (
              <div key={s.strategy_id} className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-heading font-bold text-white text-sm">{s.strategy_name}</h3>
                    <span className="text-[10px] font-mono text-cyan-400">{s.category} • {s.timeframe}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    Sharpe: {s.sharpe_ratio}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Return:</span>
                    <span className="text-emerald-400 font-bold">+{s.net_return_pct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Win Rate:</span>
                    <span className="text-white font-semibold">{s.win_rate_pct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Profit Factor:</span>
                    <span className="text-white font-semibold">{s.profit_factor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Drawdown:</span>
                    <span className="text-rose-400 font-semibold">-{s.max_drawdown_pct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trades Tested:</span>
                    <span className="text-slate-300">{s.completed_trades}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Scorecard Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#070a12] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0b0f19] border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Rank &amp; Strategy</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Timeframe</th>
                <th className="py-3 px-3">Sharpe Ratio</th>
                <th className="py-3 px-3">Win Rate</th>
                <th className="py-3 px-3">Profit Factor</th>
                <th className="py-3 px-3">Max DD</th>
                <th className="py-3 px-3">Net Return</th>
                <th className="py-3 px-3">Trades</th>
                <th className="py-3 px-4 text-right">Compare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAndSorted.map((s, idx) => {
                const isSelected = selectedForComparison.includes(s.strategy_id);
                return (
                  <tr key={s.strategy_id} className={`hover:bg-slate-900/40 transition-colors ${isSelected ? 'bg-cyan-500/[0.04]' : ''}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                              : idx === 1
                              ? 'bg-slate-300/20 text-slate-200 border border-slate-400/30'
                              : idx === 2
                              ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                              : 'text-slate-500'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white text-xs leading-tight">{s.strategy_name}</div>
                          <span className="text-[10px] text-slate-500 font-sans">v{s.version}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px]">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-300">{s.timeframe}</td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-cyan-400">{s.sharpe_ratio.toFixed(2)}</span>
                    </td>
                    <td className="py-3.5 px-3 text-white font-semibold">{s.win_rate_pct}%</td>
                    <td className="py-3.5 px-3 text-emerald-400 font-semibold">{s.profit_factor}</td>
                    <td className="py-3.5 px-3 text-rose-400">-{s.max_drawdown_pct}%</td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-[#00FF66]">+{s.net_return_pct}%</span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-400">{s.completed_trades}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => toggleComparison(s.strategy_id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isSelected ? 'Selected' : '+ Compare'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StrategyScorecardPage;
