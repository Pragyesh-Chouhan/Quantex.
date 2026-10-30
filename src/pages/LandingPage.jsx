import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
  TrendingUp,
  Cpu,
  BarChart3,
  ShieldCheck,
  Layers,
  ArrowRight,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Lock,
  Globe,
  Sliders,
  Play,
  Terminal,
  Activity,
} from 'lucide-react';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { DemoBadge } from '../components/common/DemoBadge';
import { Logo, LogoIcon } from '../components/common/Logo';
import MiniSparkline from '../components/charts/MiniSparkline';
import { DEMO_INSTRUMENTS } from '../data/demoData';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: Cpu,
      title: 'AI Strategy Builder',
      desc: 'Formulate, tweak, and orchestrate deep-learning models, momentum indicators, and dynamic exits without writing repetitive glue code.',
      badge: 'Core Engine',
      color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
    },
    {
      icon: Terminal,
      title: 'Algorithmic Trading Interface',
      desc: 'Real-time order book surveillance, sub-millisecond execution simulations, depth charts, and automated order types.',
      badge: 'Execution',
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      icon: BarChart3,
      title: 'Historical Backtesting',
      desc: 'Run multi-year simulations with realistic slippage, fee modeling, drawdown curves, and Monte Carlo risk stress tests.',
      badge: 'Quant Lab',
      color: 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30',
    },
    {
      icon: Activity,
      title: 'Market Analytics',
      desc: 'Live multi-asset market scanning across Crypto, Forex, Indices, and Equities with volatility and momentum screens.',
      badge: 'Surveillance',
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    },
    {
      icon: Layers,
      title: 'Portfolio Monitoring',
      desc: 'Cross-asset allocation analytics, asset rebalancing simulations, Sharpe ratio benchmarks, and net exposure tracking.',
      badge: 'Management',
      color: 'from-sky-500/20 to-cyan-500/20 text-sky-400 border-sky-500/30',
    },
    {
      icon: ShieldCheck,
      title: 'Risk Management',
      desc: 'Configurable circuit breakers, Value-at-Risk limits, maximum drawdown thresholds, and emergency position unloads.',
      badge: 'Protection',
      color: 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Select a Trading Instrument',
      desc: 'Choose from major crypto pairs, tech equities, index ETFs, or forex pairs with transparent simulated order feeds.',
    },
    {
      step: '02',
      title: 'Configure Your Strategy',
      desc: 'Select indicators (EMA, RSI, MACD, Bollinger Bands), position sizing formulas, dynamic stops, and AI triggers.',
    },
    {
      step: '03',
      title: 'Backtest Historical Data',
      desc: 'Test your hypotheses across historical market regimes to inspect profitability, drawdown risk, and win-rate.',
    },
    {
      step: '04',
      title: 'Review Performance & Risk',
      desc: 'Evaluate Sharpe ratio, profit factor, equity curves, and automated circuit breaker protections.',
    },
    {
      step: '05',
      title: 'Connect Supported Backend',
      desc: 'When ready, configure VITE_API_BASE_URL to transition your frontend seamlessly to real execution engines.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#05070E] text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* Background Subtle Fine Grid & Light Cones */}
      <div className="fixed inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="fixed -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-cyan-600/15 via-emerald-500/10 to-transparent blur-3xl pointer-events-none" />

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 w-full bg-[#070a14]/80 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center">
            <Logo size="md" subtitle="AI ALGORITHMIC TRADING" />
          </Link>

          {/* Nav Links Desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#home" className="hover:text-cyan-400 transition-colors">Home</a>
            <a href="#features" className="hover:text-cyan-400 transition-colors">Features</a>
            <Link to="/markets" className="hover:text-cyan-400 transition-colors">Markets</Link>
            <Link to="/strategy-lab" className="hover:text-cyan-400 transition-colors">AI Strategies</Link>
            <a href="#how-it-works" className="hover:text-cyan-400 transition-colors">About</a>
          </nav>

          {/* Action Buttons Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Launch Dashboard
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white"
          >
            <span className="sr-only">Toggle navigation</span>
            <div className="w-6 h-5 flex flex-col justify-between">
              <span className="w-full h-0.5 bg-current rounded" />
              <span className="w-full h-0.5 bg-current rounded" />
              <span className="w-full h-0.5 bg-current rounded" />
            </div>
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-2 pb-6 bg-[#090e1c] border-b border-white/[0.08] space-y-3">
            <div className="flex flex-col space-y-2 text-sm font-medium">
              <a
                href="#home"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04]"
              >
                Home
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04]"
              >
                Features
              </a>
              <Link
                to="/markets"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04]"
              >
                Markets
              </Link>
              <Link
                to="/strategy-lab"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04]"
              >
                AI Strategies
              </Link>
              <Link
                to="/terminal"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04]"
              >
                Terminal
              </Link>
            </div>
            <div className="pt-3 border-t border-white/[0.08] flex items-center gap-3">
              <Link to="/login" className="flex-1">
                <Button variant="secondary" size="sm" className="w-full">
                  Login
                </Button>
              </Link>
              <Link to="/dashboard" className="flex-1">
                <Button variant="primary" size="sm" className="w-full">
                  Launch Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section id="home" className="relative pt-16 pb-24 lg:pt-28 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          {/* Floating Pill Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-8 backdrop-blur-xl shadow-lg shadow-cyan-950/30"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="font-semibold tracking-wide">NEXT-GEN QUANTITATIVE PLATFORM</span>
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-200">v2.4</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-heading font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white max-w-4xl leading-[1.1]"
          >
            Trade Smarter.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-400">
              Think Algorithmically.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed"
          >
            Explore intelligent trading strategies, analyze market movements, and build your trading workflow with QuantEX.
          </motion.p>

          {/* Hero Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link to="/dashboard">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-5 h-5" />}
                className="shadow-xl shadow-cyan-500/25 px-8"
              >
                Launch Dashboard
              </Button>
            </Link>
            <Link to="/strategy-lab">
              <Button
                variant="secondary"
                size="lg"
                leftIcon={<Cpu className="w-5 h-5 text-cyan-400" />}
                className="px-8"
              >
                Explore AI Strategies
              </Button>
            </Link>
          </motion.div>

          {/* Visual Elements: Animated Trading Graphic & Cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 w-full max-w-5xl relative"
          >
            {/* Glowing border frame */}
            <div className="relative rounded-3xl bg-gradient-to-b from-cyan-500/20 via-white/[0.03] to-transparent p-[1px] shadow-2xl shadow-cyan-950/40">
              <div className="rounded-[23px] bg-[#090e1a]/95 backdrop-blur-2xl p-6 sm:p-8 border border-white/[0.08]">
                {/* Terminal Header Bar */}
                <div className="flex items-center justify-between pb-6 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-xs font-mono text-slate-400 pl-2">
                      QuantEX Terminal • BTC/USDT Perpetual
                    </span>
                  </div>
                  <DemoBadge size="xs" />
                </div>

                {/* Simulated Candlestick Banner Graphic */}
                <div className="pt-6 relative">
                  <div className="h-64 sm:h-80 w-full flex items-end justify-between gap-1 sm:gap-2 px-2 overflow-hidden">
                    {[
                      { o: 60, c: 90, b: true },
                      { o: 90, c: 75, b: false },
                      { o: 75, c: 110, b: true },
                      { o: 110, c: 130, b: true },
                      { o: 130, c: 115, b: false },
                      { o: 115, c: 145, b: true },
                      { o: 145, c: 170, b: true },
                      { o: 170, c: 155, b: false },
                      { o: 155, c: 190, b: true },
                      { o: 190, c: 220, b: true },
                      { o: 220, c: 205, b: false },
                      { o: 205, c: 245, b: true },
                      { o: 245, c: 270, b: true },
                      { o: 270, c: 250, b: false },
                      { o: 250, c: 295, b: true },
                    ].map((item, idx) => {
                      const color = item.b ? '#10b981' : '#f43f5e';
                      const height = Math.abs(item.c - item.o) + 15;
                      const bottom = Math.min(item.c, item.o);

                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center justify-end relative h-full group"
                        >
                          {/* Wick line */}
                          <div
                            className="w-[1.5px] rounded"
                            style={{
                              backgroundColor: color,
                              height: `${height + 25}px`,
                            }}
                          />
                          {/* Candle body */}
                          <div
                            className="w-full rounded-sm absolute transition-all duration-300 group-hover:brightness-125"
                            style={{
                              backgroundColor: color,
                              height: `${height}px`,
                              bottom: `${bottom * 0.75}px`,
                              opacity: 0.85,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Floating Metric Badges & Cards */}
                  <div className="absolute top-4 left-4 p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-md shadow-xl text-left font-mono">
                    <div className="text-[10px] text-slate-400">MODEL PREDICTION CONFIDENCE</div>
                    <div className="text-base font-bold text-cyan-300 mt-0.5">92.4% BULLISH ACCUMULATION</div>
                    <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Target: $98,400 (R:R 2.4 : 1)</span>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-4 p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 backdrop-blur-md shadow-xl text-right font-mono">
                    <div className="text-[10px] text-slate-400">AUTONOMOUS STATUS</div>
                    <div className="text-sm font-bold text-emerald-300 mt-0.5">4 STRATEGIES ACTIVE</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">24h Net P&L: +$4,128.50</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TICKER CAROUSEL BAR */}
      <section className="py-6 border-y border-white/[0.07] bg-[#070b16]">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none flex items-center justify-between gap-8">
          {DEMO_INSTRUMENTS.slice(0, 5).map((inst) => {
            const isPos = inst.change24h >= 0;
            return (
              <div key={inst.symbol} className="flex items-center gap-3 shrink-0 font-mono">
                <span className="font-semibold text-xs text-white">{inst.symbol}</span>
                <span className="text-xs text-slate-300">${inst.price.toLocaleString()}</span>
                <span
                  className={`text-[11px] font-semibold flex items-center ${
                    isPos ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPos ? '+' : ''}{inst.change24h.toFixed(2)}%
                </span>
                <MiniSparkline data={inst.sparkline} isPositive={isPos} width={60} height={18} />
              </div>
            );
          })}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="cyan" size="sm" className="mb-3">
              INSTITUTIONAL GRADE
            </Badge>
            <h2 className="font-heading font-extrabold text-3xl sm:text-5xl tracking-tight text-white">
              Built for Modern Algorithmic Trading
            </h2>
            <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
              Every component is crafted for high-performance quantitative research, backtesting precision, and execution safety.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <Card
                  key={feat.title}
                  hoverEffect
                  className="p-6 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className={`p-3 rounded-2xl bg-gradient-to-br border ${feat.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-0.5 rounded bg-white/[0.04]">
                        {feat.badge}
                      </span>
                    </div>

                    <h3 className="font-heading font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">
                      {feat.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 gap-1.5 transition-colors">
                    <span>Explore module</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#070b16]/60 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="indigo" size="sm" className="mb-3">
              SYSTEM ARCHITECTURE
            </Badge>
            <h2 className="font-heading font-extrabold text-3xl sm:text-5xl tracking-tight text-white">
              How QuantEX Operates
            </h2>
            <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
              From market selection to backtesting and live backend engine connectivity in 5 intuitive steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {steps.map((st, i) => (
              <div
                key={st.step}
                className="relative p-5 rounded-2xl bg-[#090e1c] border border-white/[0.07] flex flex-col justify-between hover:border-cyan-500/30 transition-all"
              >
                <div>
                  <div className="font-heading font-black text-3xl text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 to-transparent">
                    {st.step}
                  </div>
                  <h4 className="font-bold text-sm text-white mt-3">{st.title}</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-emerald-950/60 border border-cyan-500/30 p-8 sm:p-14 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <Badge variant="green" size="sm" className="mb-4">
            DEMO SIMULATION READY
          </Badge>

          <h2 className="font-heading font-extrabold text-3xl sm:text-5xl text-white tracking-tight">
            Step Into Next-Gen Algorithmic Trading
          </h2>
          <p className="mt-4 text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Test strategy parameters, watch automated trade execution in real time, and integrate your custom backend when ready.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/dashboard">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                Launch Dashboard Now
              </Button>
            </Link>
            <Link to="/terminal">
              <Button variant="secondary" size="lg" leftIcon={<Terminal className="w-5 h-5 text-cyan-400" />}>
                Open Trading Terminal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-white/[0.08] bg-[#04060c] py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size="xs" subtitle={false} />
            <span className="text-slate-600">|</span>
            <span className="font-mono text-[11px] text-slate-400">
              Frontend Development Edition (VITE_API_BASE_URL ready)
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="hover:text-cyan-400 transition-colors">Overview</Link>
            <Link to="/markets" className="hover:text-cyan-400 transition-colors">Markets</Link>
            <Link to="/strategy-lab" className="hover:text-cyan-400 transition-colors">Strategy Lab</Link>
            <Link to="/backtesting" className="hover:text-cyan-400 transition-colors">Backtesting</Link>
            <Link to="/settings" className="hover:text-cyan-400 transition-colors">Settings</Link>
          </div>

          <div className="font-mono text-slate-500 text-[11px]">
            &copy; 2026 QuantEX. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
