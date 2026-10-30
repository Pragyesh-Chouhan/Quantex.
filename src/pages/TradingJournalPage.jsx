import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Download,
  Tag,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

export const TradingJournalPage = () => {
  const { addNotification } = useNotifications();
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'WIN' | 'LOSS'

  // Notes state stored in localStorage
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('quantex_journal_notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeTradeNoteModal, setActiveTradeNoteModal] = useState(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [tempTag, setTempTag] = useState('');

  const loadTrades = async () => {
    setIsLoading(true);
    try {
      const res = await api.portfolio.getTrades(100);
      if (Array.isArray(res)) {
        setTrades(res);
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, []);

  const handleSaveNote = (tradeId) => {
    const updated = {
      ...notes,
      [tradeId]: {
        note: tempNoteText,
        tag: tempTag || 'Breakout',
        updatedAt: new Date().toLocaleDateString(),
      },
    };
    setNotes(updated);
    localStorage.setItem('quantex_journal_notes', JSON.stringify(updated));
    setActiveTradeNoteModal(null);
    addNotification({
      title: 'Journal Entry Saved',
      message: `Note and reflections added for trade ${tradeId}.`,
      type: 'success',
    });
  };

  const handleExportCsv = () => {
    if (trades.length === 0) return;

    const headers = ['Trade ID', 'Order ID', 'Instrument', 'Side', 'Fill Price', 'Quantity', 'Fees', 'Realized PnL', 'Timestamp', 'Journal Notes', 'Journal Tag'];
    const rows = trades.map((t) => [
      t.trade_id,
      t.order_id,
      t.instrument,
      t.side,
      t.fill_price,
      t.fill_quantity,
      t.fees,
      t.realized_pnl,
      t.timestamp,
      notes[t.trade_id]?.note || '',
      notes[t.trade_id]?.tag || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QuantEX_Trading_Journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const matchesSearch =
        t.trade_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.instrument?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (notes[t.trade_id]?.note || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (filterMode === 'WIN') return matchesSearch && t.realized_pnl > 0;
      if (filterMode === 'LOSS') return matchesSearch && t.realized_pnl < 0;
      return matchesSearch;
    });
  }, [trades, searchQuery, filterMode, notes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold text-white">AI Trading Journal</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
              EXECUTION LEDGER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Searchable trade records, execution psychology reflections, strategy attribution, and CSV data export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Journal (CSV)</span>
          </button>

          <button
            onClick={loadTrades}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#090d18] border border-slate-800">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Trade ID, instrument, notes, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterMode === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Trades ({trades.length})
          </button>
          <button
            onClick={() => setFilterMode('WIN')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterMode === 'WIN' ? 'bg-emerald-500/20 text-[#00FF66] font-bold border border-emerald-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Winners
          </button>
          <button
            onClick={() => setFilterMode('LOSS')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterMode === 'LOSS' ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Losses
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#070a12] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0b0f19] border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Trade ID &amp; Time</th>
                <th className="py-3 px-3">Instrument</th>
                <th className="py-3 px-3">Side</th>
                <th className="py-3 px-3">Fill Price</th>
                <th className="py-3 px-3">Quantity</th>
                <th className="py-3 px-3">Realized P&amp;L</th>
                <th className="py-3 px-3">Journal Notes &amp; Reflections</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTrades.length > 0 ? (
                filteredTrades.map((t) => {
                  const entry = notes[t.trade_id];
                  const isWin = t.realized_pnl > 0;
                  return (
                    <tr key={t.trade_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{t.trade_id}</div>
                        <span className="text-[10px] text-slate-500">{t.timestamp ? new Date(t.timestamp).toLocaleString() : 'Recent'}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-bold text-white text-[11px]">
                          {t.instrument}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`font-bold ${
                            t.side.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {t.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-200">${t.fill_price?.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-slate-300">{t.fill_quantity}</td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`font-bold ${
                            isWin ? 'text-[#00FF66]' : t.realized_pnl < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {t.realized_pnl >= 0 ? '+' : ''}${t.realized_pnl?.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 max-w-xs">
                        {entry ? (
                          <div className="space-y-1">
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {entry.tag}
                            </span>
                            <p className="text-[11px] text-slate-300 truncate">{entry.note}</p>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">No notes added</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setActiveTradeNoteModal(t.trade_id);
                            setTempNoteText(entry?.note || '');
                            setTempTag(entry?.tag || 'Strategy Trend');
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] ml-auto transition-colors"
                        >
                          <MessageSquare className="w-3 h-3 text-cyan-400" />
                          <span>{entry ? 'Edit' : '+ Note'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    No trades found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note Modal */}
      {activeTradeNoteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0c1120] border border-slate-700 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-heading font-bold text-white">
              Trading Journal Reflection ({activeTradeNoteModal})
            </h3>
            <p className="text-xs text-slate-400">
              Record your technical rationale, emotional discipline, and lessons learned for future strategy tuning.
            </p>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Tag / Category</label>
              <select
                value={tempTag}
                onChange={(e) => setTempTag(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none"
              >
                <option value="Breakout Follow-Through">Breakout Follow-Through</option>
                <option value="EMA Trend Riding">EMA Trend Riding</option>
                <option value="Mean Reversion Extreme">Mean Reversion Extreme</option>
                <option value="Volume VWAP Confluence">Volume VWAP Confluence</option>
                <option value="Liquidity Sweep Trap">Liquidity Sweep Trap</option>
                <option value="Premature Exit / Error">Premature Exit / Error</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Trade Notes &amp; Rationale</label>
              <textarea
                rows="4"
                value={tempNoteText}
                onChange={(e) => setTempNoteText(e.target.value)}
                placeholder="Enter notes on entry trigger, stop-loss placement, market condition..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveTradeNoteModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveNote(activeTradeNoteModal)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-emerald-500/20"
              >
                Save Reflection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingJournalPage;
