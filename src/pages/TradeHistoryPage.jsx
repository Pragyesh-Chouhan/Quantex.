import React, { useState, useMemo } from 'react';
import {
  History,
  Filter,
  ArrowUpDown,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { formatCurrency, formatPercent } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { DemoBadge } from '../components/common/DemoBadge';

export const TradeHistoryPage = () => {
  const { trades, instruments } = useTrading();

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedInstrument, setSelectedInstrument] = useState('ALL');
  const [sideFilter, setSideFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Filter and sort logic
  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => {
        const matchesSearch =
          t.instrument.toLowerCase().includes(search.toLowerCase()) ||
          t.strategy.toLowerCase().includes(search.toLowerCase()) ||
          t.id.toLowerCase().includes(search.toLowerCase());
        const matchesInstrument = selectedInstrument === 'ALL' || t.instrument === selectedInstrument;
        const matchesSide = sideFilter === 'ALL' || t.side === sideFilter;
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

        return matchesSearch && matchesInstrument && matchesSide && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.timestamp) - new Date(a.timestamp);
        if (sortBy === 'date-asc') return new Date(a.timestamp) - new Date(b.timestamp);
        if (sortBy === 'pnl-desc') return b.pnl - a.pnl;
        if (sortBy === 'pnl-asc') return a.pnl - b.pnl;
        return 0;
      });
  }, [trades, search, selectedInstrument, sideFilter, statusFilter, sortBy]);

  const totalPages = Math.ceil(filteredTrades.length / pageSize) || 1;
  const paginatedTrades = filteredTrades.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCSV = () => {
    const headers = 'ID,Timestamp,Instrument,Side,Quantity,EntryPrice,ExitPrice,PnL,Status,Strategy\n';
    const rows = filteredTrades
      .map(
        (t) =>
          `${t.id},${t.timestamp},${t.instrument},${t.side},"${t.quantity}",${t.entryPrice},${t.exitPrice},${t.pnl},${t.status},"${t.strategy}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuantEX_trade_history_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#090e1c] border border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-heading font-extrabold text-white tracking-wide">
              Execution Ledger & Trade History
            </h1>
            <DemoBadge size="sm" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Auditable log of executed algorithmic orders, fills, stop-loss triggers, and realized P&L.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4 text-cyan-400" />}
          >
            Export Filtered CSV
          </Button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <Card noPadding>
        <div className="p-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by trade ID, symbol, strategy..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Instrument Filter */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <select
              value={selectedInstrument}
              onChange={(e) => {
                setSelectedInstrument(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-200 font-mono focus:outline-none"
            >
              <option value="ALL">All Instruments</option>
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol}
                </option>
              ))}
            </select>

            {/* Side Filter */}
            <select
              value={sideFilter}
              onChange={(e) => {
                setSideFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-200 font-mono focus:outline-none"
            >
              <option value="ALL">All Sides (BUY / SELL)</option>
              <option value="BUY">BUY Only</option>
              <option value="SELL">SELL Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-200 font-mono focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="STOP_LOSS">Stop Loss Triggered</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-200 font-mono focus:outline-none"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="pnl-desc">Highest P&L</option>
              <option value="pnl-asc">Lowest P&L</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-400 font-mono text-[11px] bg-white/[0.01]">
                <th className="py-3 px-4">Trade ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-4">Side</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Entry Price</th>
                <th className="py-3 px-4">Exit Price</th>
                <th className="py-3 px-4">Realized PnL</th>
                <th className="py-3 px-4">Fee</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {paginatedTrades.length > 0 ? (
                paginatedTrades.map((trd) => {
                  const isProfit = trd.pnl >= 0;
                  return (
                    <tr key={trd.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{trd.id}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{trd.timestamp}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{trd.instrument}</div>
                        <div className="text-[10px] text-slate-500">{trd.strategy}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            trd.side === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {trd.side}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{trd.quantity}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {formatCurrency(trd.entryPrice)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-white">
                        {formatCurrency(trd.exitPrice)}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className={`font-semibold ${
                            isProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfit ? '+' : ''}{formatCurrency(trd.pnl)} ({trd.pnlPercent.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">${trd.fee.toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={trd.status === 'COMPLETED' ? 'green' : 'red'}
                          size="xs"
                        >
                          {trd.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-500">
                    No trades match the current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredTrades.length)} of {filteredTrades.length} trades
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="font-mono text-white px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TradeHistoryPage;
