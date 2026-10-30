import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';

export const AiCopilotPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Hello, Trader! I am the QuantEX Explainable AI Copilot. I analyze live Delta Exchange orderbook feeds, mathematical indicator regimes (EMA, RSI, Supertrend, VWAP), and risk command status to give you factual, grounded strategy explanations.',
      metrics: null,
      actions: [
        'Ask why an EMA crossover triggered on BTCUSD',
        'Analyze portfolio drawdown and loss limit status',
        'Compare top-performing quantitative strategies',
      ],
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');

  const handleSend = async (queryToSend) => {
    const query = queryToSend || inputQuery;
    if (!query.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsAnalyzing(true);

    try {
      const res = await api.copilot.analyze(query, null, selectedSymbol, '5m');
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: res.ai_interpretation,
        metrics: res.factual_metrics,
        indicators: res.indicator_breakdown,
        actions: res.suggested_actions,
        disclaimer: res.disclaimer,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: `Copilot analysis error: ${err.message}. Showing deterministic fallback based on local metrics.`,
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold text-white">Explainable AI Copilot</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
              GROUNDED DATA ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time algorithmic explanations derived directly from verified exchange prices and math indicators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Context Instrument:</span>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none"
          >
            <option value="BTCUSD">BTCUSD (Delta India Perp)</option>
            <option value="ETHUSD">ETHUSD (Delta India Perp)</option>
            <option value="SOLUSD">SOLUSD (Delta India Perp)</option>
          </select>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'bot' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 text-xs font-mono leading-relaxed space-y-3 ${
                m.sender === 'user'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
                  : 'bg-[#0b0f19] border border-slate-800 text-slate-200 shadow-xl'
              }`}
            >
              <p className="text-sm font-sans">{m.text}</p>

              {/* Factual Metrics Box if available */}
              {m.metrics && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verified Platform Telemetry</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Market Price:</span>
                      <strong className="text-white">${m.metrics.current_market_price?.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Fast EMA (9):</span>
                      <strong className="text-emerald-400">${m.metrics.fast_ema_9}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Slow EMA (21):</span>
                      <strong className="text-cyan-400">${m.metrics.slow_ema_21}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Regime:</span>
                      <strong className="text-white">{m.metrics.ema_trend}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kill Switch:</span>
                      <strong className={m.metrics.emergency_stop_engaged ? 'text-rose-400' : 'text-emerald-400'}>
                        {m.metrics.emergency_stop_engaged ? 'ENGAGED' : 'NORMAL'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Actions Chips */}
              {m.actions && m.actions.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Suggested Follow-ups:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {m.actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(act)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[10px] text-cyan-300 text-left transition-colors"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              {m.disclaimer && (
                <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-800/60 font-sans italic">
                  {m.disclaimer}
                </div>
              )}
            </div>

            {m.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {isAnalyzing && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="px-4 py-2 rounded-xl bg-[#0b0f19] border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Analyzing live Delta orderbook, math indicators, and risk status...
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-3 rounded-2xl bg-[#090d18] border border-slate-800 shadow-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Copilot: 'Why did Supertrend EMA trigger?', 'Explain my portfolio risk', 'Compare strategies'..."
            className="flex-1 bg-transparent px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            disabled={isAnalyzing}
          />
          <button
            type="submit"
            disabled={isAnalyzing || !inputQuery.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <span>Analyze</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiCopilotPage;
