import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  Info,
  Calendar,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';

export const AuditTrailPage = () => {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.allSettled([
        api.events.list({
          category: selectedCategory,
          severity: selectedSeverity,
          search: searchQuery,
          limit: 100,
        }),
        api.events.summary(),
      ]);

      if (listRes.status === 'fulfilled' && Array.isArray(listRes.value)) {
        setEvents(listRes.value);
      }
      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [selectedCategory, selectedSeverity]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAuditLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold text-white">Immutable Audit Trail</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
              SECURITY LEDGER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident system activity log recording authentication, exchange key modifications, risk events, and kill switch activations.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Total Audit Events</span>
          <div className="text-xl font-mono font-bold text-white">
            {summary?.total_audit_events || events.length}
          </div>
          <span className="text-[10px] text-slate-500">Append-only ledger entries</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Critical Alerts</span>
          <div className="text-xl font-mono font-bold text-rose-400">
            {summary?.critical_events || 0}
          </div>
          <span className="text-[10px] text-slate-500">Emergency halts &amp; breaches</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Warnings</span>
          <div className="text-xl font-mono font-bold text-amber-400">
            {summary?.warning_events || 0}
          </div>
          <span className="text-[10px] text-slate-500">Disconnections &amp; throttles</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400">Info Events</span>
          <div className="text-xl font-mono font-bold text-emerald-400">
            {summary?.info_events || events.length}
          </div>
          <span className="text-[10px] text-slate-500">Keys, logins, and parameters</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#090d18] border border-slate-800">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit message text (e.g. Delta, Key, Kill Switch)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="CONNECTIVITY">CONNECTIVITY</option>
            <option value="EMERGENCY">EMERGENCY</option>
            <option value="RISK_LIMIT">RISK_LIMIT</option>
            <option value="AUTH">AUTH</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#070a12] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0b0f19] border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-4">Audit Event Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.length > 0 ? (
                events.map((ev) => {
                  const isCrit = ev.severity === 'CRITICAL';
                  const isWarn = ev.severity === 'WARNING';
                  return (
                    <tr key={ev.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isCrit
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : isWarn
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {ev.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                          {ev.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {ev.message}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500">
                    No audit records matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditTrailPage;
