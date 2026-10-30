import React, { useState } from 'react';
import { Sparkles, ShieldAlert, Wifi, Globe, Terminal, History, ChevronDown } from 'lucide-react';

export const DataModeSelector = ({ activeMode = 'LIVE', onModeChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const MODES = [
    {
      id: 'LIVE',
      label: 'LIVE MARKET DATA',
      sublabel: 'Delta India Real-Time Stream',
      icon: Wifi,
      color: 'emerald',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
    },
    {
      id: 'CONNECTED',
      label: 'LIVE ACCOUNT',
      sublabel: 'User Authenticated Delta Key',
      icon: Globe,
      color: 'cyan',
      badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      dotClass: 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]',
    },
    {
      id: 'PAPER',
      label: 'PAPER TRADING',
      sublabel: 'Isolated Virtual Executions',
      icon: Terminal,
      color: 'violet',
      badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      dotClass: 'bg-purple-400',
    },
    {
      id: 'HISTORICAL',
      label: 'BACKTESTING',
      sublabel: 'Historical OHLCV Datasets',
      icon: History,
      color: 'amber',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      dotClass: 'bg-amber-400',
    },
  ];

  const current = MODES.find((m) => m.id === activeMode) || MODES[0];
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all ${current.badgeClass}`}
      >
        <span className={`w-2 h-2 rounded-full ${current.dotClass} animate-pulse`} />
        <span className="font-bold tracking-wider">{current.label}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#0c1120] border border-white/[0.09] shadow-2xl z-50 p-2">
          <div className="text-[10px] font-mono uppercase text-slate-400 px-3 py-1.5 font-semibold">
            Strict Operating Modes
          </div>
          <div className="space-y-1">
            {MODES.map((m) => {
              const MIcon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onModeChange && onModeChange(m.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${
                    activeMode === m.id ? 'bg-white/[0.08] text-white font-semibold' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  <MIcon className="w-4 h-4 mt-0.5 shrink-0 text-slate-300" />
                  <div>
                    <div className="text-xs font-mono font-bold leading-tight">{m.label}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">{m.sublabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const DemoModePill = () => {
  return <DataModeSelector activeMode="LIVE" />;
};

export const DemoBadge = ({ size = 'sm', showIcon = true, variant = 'cyan' }) => {
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold tracking-wider',
  }[size] || 'text-xs px-2 py-0.5';

  const variantStyles = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  }[variant] || 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';

  return (
    <span
      title="Verified QuantEX data pipeline"
      className={`inline-flex items-center gap-1 rounded-md border uppercase tracking-wider font-mono select-none ${variantStyles} ${sizeClasses}`}
    >
      {showIcon && (variant === 'amber' ? <ShieldAlert className="w-3 h-3" /> : <Sparkles className="w-3 h-3 animate-pulse" />)}
      <span>REAL EXCHANGE DATA</span>
    </span>
  );
};

export default DemoModePill;
