import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import {
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronDown,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../../services/api';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const DEFAULT_PRODUCTS = [
  { symbol: 'BTCUSD', description: 'Bitcoin Perpetual' },
  { symbol: 'ETHUSD', description: 'Ethereum Perpetual' },
  { symbol: 'SOLUSD', description: 'Solana Perpetual' },
  { symbol: 'XRPUSD', description: 'Ripple Perpetual' },
  { symbol: 'DOGEUSD', description: 'Dogecoin Perpetual' },
  { symbol: 'BNBUSD', description: 'BNB Perpetual' },
  { symbol: 'AVAXUSD', description: 'Avalanche Perpetual' },
  { symbol: 'LINKUSD', description: 'Chainlink Perpetual' },
];

// Mathematical indicators calculated strictly from genuine market candles
const calculateSMA200 = (candles, period = 200) => {
  if (!candles || candles.length === 0) return [];
  const effPeriod = Math.min(period, Math.max(5, Math.floor(candles.length / 2)));
  const result = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= effPeriod) {
      sum -= candles[i - effPeriod].close;
      result.push({ time: candles[i].time, value: Number((sum / effPeriod).toFixed(2)) });
    } else if (i >= 5) {
      result.push({ time: candles[i].time, value: Number((sum / (i + 1)).toFixed(2)) });
    }
  }
  return result;
};

const calculateSupertrend = (candles, period = 10, multiplier = 3.0) => {
  if (!candles || candles.length < period) return [];
  const tr = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
  }

  const atr = [];
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    sum += tr[i];
    if (i >= period) {
      sum -= tr[i - period];
      atr.push(sum / period);
    } else {
      atr.push(sum / (i + 1));
    }
  }

  const result = [];
  let prevUpper = 0, prevLower = 0, inUptrend = true;
  for (let i = 0; i < candles.length; i++) {
    const mid = (candles[i].high + candles[i].low) / 2;
    const basicUpper = mid + multiplier * atr[i];
    const basicLower = mid - multiplier * atr[i];
    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > 0) {
      finalUpper = basicUpper < prevUpper || candles[i - 1].close > prevUpper ? basicUpper : prevUpper;
      finalLower = basicLower > prevLower || candles[i - 1].close < prevLower ? basicLower : prevLower;
      if (inUptrend && candles[i].close < finalLower) inUptrend = false;
      else if (!inUptrend && candles[i].close > finalUpper) inUptrend = true;
    }
    prevUpper = finalUpper;
    prevLower = finalLower;
    result.push({
      time: candles[i].time,
      value: Number((inUptrend ? finalLower : finalUpper).toFixed(2)),
      color: inUptrend ? '#00FF66' : '#FF3366',
    });
  }
  return result;
};

export const InteractiveCandlestick = ({
  symbol: propSymbol = 'BTCUSD',
  height = 480,
  onSymbolChange,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(propSymbol);
  const [selectedTimeframe, setSelectedTimeframe] = useState('5m');
  const [selectedExchange, setSelectedExchange] = useState('Delta Exchange India');
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Indicator Toggles
  const [showSma200, setShowSma200] = useState(true);
  const [showSupertrend, setShowSupertrend] = useState(true);

  // Live Metrics
  const [livePrice, setLivePrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [markPrice, setMarkPrice] = useState(null);
  const [high24h, setHigh24h] = useState(null);
  const [low24h, setLow24h] = useState(null);
  const [volume24h, setVolume24h] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING'); // 'CONNECTED' | 'RECONNECTING' | 'STALE' | 'DISCONNECTED'
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tickDirection, setTickDirection] = useState(null); // 'UP' | 'DOWN'

  // Chart References
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const smaSeriesRef = useRef(null);
  const supertrendSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const rawCandlesRef = useRef([]);

  // Sync prop symbol if changed from parent
  useEffect(() => {
    if (propSymbol && propSymbol !== selectedSymbol) {
      setSelectedSymbol(propSymbol);
    }
  }, [propSymbol]);

  // Load available products for search dropdown
  useEffect(() => {
    let isMounted = true;
    api.markets.getProducts().then((res) => {
      if (isMounted && Array.isArray(res) && res.length > 0) {
        setProducts(res);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) => p.symbol.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [products, searchQuery]);

  // Initialize Lightweight Chart Canvas
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#070a12' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Plus Jakarta Sans', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0, 255, 102, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#00FF66',
        },
        horzLine: {
          color: 'rgba(0, 255, 102, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#00FF66',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00FF66',
      downColor: '#FF3366',
      borderVisible: false,
      wickUpColor: '#00FF66',
      wickDownColor: '#FF3366',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay on same chart
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // SMA 200 Series (Gold)
    const smaSeries = chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'SMA 200',
    });

    // Supertrend Series (Cyan/Emerald)
    const supertrendSeries = chart.addSeries(LineSeries, {
      color: '#06B6D4',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Supertrend',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    smaSeriesRef.current = smaSeries;
    supertrendSeriesRef.current = supertrendSeries;

    // Responsive Auto Resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  // Update Indicator Visibility on Toggle
  useEffect(() => {
    smaSeriesRef.current?.applyOptions({ visible: showSma200 });
  }, [showSma200]);

  useEffect(() => {
    supertrendSeriesRef.current?.applyOptions({ visible: showSupertrend });
  }, [showSupertrend]);

  // Load Historical Candles & Subscribe to WebSocket Stream
  useEffect(() => {
    let isSubscribed = true;
    setIsLoading(true);

    const loadDataAndSubscribe = async () => {
      try {
        // 1. Fetch initial ticker
        const tickerRes = await api.markets.getTicker(selectedSymbol);
        if (isSubscribed && tickerRes && tickerRes.price) {
          setLivePrice(tickerRes.price);
          setMarkPrice(tickerRes.mark_price || tickerRes.price);
          setHigh24h(tickerRes.high || null);
          setLow24h(tickerRes.low || null);
          setVolume24h(tickerRes.volume || null);
          setPriceChange(tickerRes.change_24h || 0);
        }

        // 2. Fetch Historical Candles from Delta India
        const candleRes = await api.markets.getCandles(selectedSymbol, selectedTimeframe, 200);
        if (!isSubscribed) return;

        if (candleRes && Array.isArray(candleRes.candles) && candleRes.candles.length > 0) {
          const formattedCandles = candleRes.candles.map((c) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));

          const formattedVolumes = candleRes.candles.map((c) => ({
            time: Number(c.time),
            value: Number(c.volume || 0),
            color: Number(c.close) >= Number(c.open) ? 'rgba(0, 255, 102, 0.25)' : 'rgba(255, 51, 102, 0.25)',
          }));

          rawCandlesRef.current = formattedCandles;

          // Compute SMA 200 and Supertrend
          const smaData = calculateSMA200(formattedCandles, 200);
          const supertrendData = calculateSupertrend(formattedCandles, 10, 3.0);

          if (candleSeriesRef.current && volumeSeriesRef.current) {
            candleSeriesRef.current.setData(formattedCandles);
            volumeSeriesRef.current.setData(formattedVolumes);
            smaSeriesRef.current?.setData(smaData);
            supertrendSeriesRef.current?.setData(supertrendData);
            chartRef.current?.timeScale().fitContent();
          }

          const last = formattedCandles[formattedCandles.length - 1];
          lastCandleRef.current = last;
          setLivePrice(last.close);
          setLastUpdated(new Date().toLocaleTimeString());
          setConnectionStatus('CONNECTED');
        } else {
          setConnectionStatus('STALE');
        }
      } catch (err) {
        if (isSubscribed) setConnectionStatus('DISCONNECTED');
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    };

    loadDataAndSubscribe();

    // 3. Connect Live Delta India WebSocket for streaming ticks
    const ws = api.createDeltaWebSocket(
      selectedSymbol,
      selectedTimeframe,
      (candleUpdate) => {
        if (!isSubscribed || !candleSeriesRef.current) return;
        const candleData = {
          time: candleUpdate.time,
          open: candleUpdate.open,
          high: candleUpdate.high,
          low: candleUpdate.low,
          close: candleUpdate.close,
        };

        const volData = {
          time: candleUpdate.time,
          value: candleUpdate.volume,
          color: candleUpdate.close >= candleUpdate.open ? 'rgba(0, 255, 102, 0.4)' : 'rgba(255, 51, 102, 0.4)',
        };

        try {
          candleSeriesRef.current.update(candleData);
          volumeSeriesRef.current?.update(volData);

          // Update latest candle in buffer
          const candles = rawCandlesRef.current;
          if (candles.length > 0) {
            if (candles[candles.length - 1].time === candleData.time) {
              candles[candles.length - 1] = candleData;
            } else if (candleData.time > candles[candles.length - 1].time) {
              candles.push(candleData);
              if (candles.length > 300) candles.shift();
            }
          }
        } catch {
          // Ignore rare clock skew on updates
        }

        setLivePrice((prev) => {
          if (prev !== null) {
            setTickDirection(candleUpdate.close >= prev ? 'UP' : 'DOWN');
          }
          return candleUpdate.close;
        });
        setLastUpdated(new Date().toLocaleTimeString());
        setConnectionStatus('CONNECTED');
      },
      (tickerUpdate) => {
        if (!isSubscribed) return;
        if (tickerUpdate.price) {
          setLivePrice(tickerUpdate.price);
          setMarkPrice(tickerUpdate.mark_price || tickerUpdate.price);
          if (tickerUpdate.change_24h !== undefined) {
            setPriceChange(tickerUpdate.change_24h);
          }
          setLastUpdated(new Date().toLocaleTimeString());
        }
      }
    );

    return () => {
      isSubscribed = false;
      if (ws && typeof ws.close === 'function') {
        ws.close();
      }
    };
  }, [selectedSymbol, selectedTimeframe]);

  const handleSelectSymbol = (sym) => {
    setSelectedSymbol(sym);
    setIsSearchOpen(false);
    setSearchQuery('');
    if (onSymbolChange) onSymbolChange(sym);
  };

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-[#070a12] p-4 flex flex-col overflow-hidden shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-3">
        {/* Symbol & Exchange Selector */}
        <div className="flex items-center gap-3">
          {/* Symbol Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 text-white font-mono font-bold text-sm transition-all"
            >
              <span className="text-emerald-400 font-extrabold">{selectedSymbol}</span>
              <span className="text-xs text-slate-400 font-normal">PERP</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isSearchOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-slate-800 bg-[#0b0f19] shadow-2xl z-50 p-2">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Crypto Symbol..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.symbol}
                      onClick={() => handleSelectSymbol(p.symbol)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left ${
                        selectedSymbol === p.symbol
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="font-bold">{p.symbol}</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[130px]">{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Exchange Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {selectedExchange}
          </div>

          {/* Indicator Toggles */}
          <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              onClick={() => setShowSma200(!showSma200)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                showSma200
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle 200-Period Simple Moving Average line"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showSma200 ? 'bg-amber-400' : 'bg-slate-600'}`} />
              <span>SMA 200</span>
            </button>
            <button
              onClick={() => setShowSupertrend(!showSupertrend)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                showSupertrend
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle ATR(10, 3.0) Supertrend trailing band"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showSupertrend ? 'bg-cyan-400' : 'bg-slate-600'}`} />
              <span>SuperTrend</span>
            </button>
          </div>
        </div>

        {/* Live Price & 24h Stats */}
        <div className="flex items-center gap-4">
          {livePrice !== null ? (
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xl sm:text-2xl font-mono font-extrabold transition-colors duration-300 ${
                  tickDirection === 'UP' ? 'text-[#00FF66]' : tickDirection === 'DOWN' ? 'text-[#FF3366]' : 'text-white'
                }`}
              >
                ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {priceChange !== null && (
                <span
                  className={`text-xs font-mono font-semibold flex items-center gap-0.5 ${
                    priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <div className="h-6 w-24 bg-slate-800 animate-pulse rounded" />
          )}

          {/* Mark Price */}
          {markPrice && (
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400">Mark Price</span>
              <span className="text-xs font-mono text-slate-200">${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* 24h High/Low */}
          {high24h && low24h && (
            <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-mono text-slate-400">24h High</span>
                <span className="text-xs font-mono text-slate-300">${high24h.toLocaleString()}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-mono text-slate-400">24h Low</span>
                <span className="text-xs font-mono text-slate-300">${low24h.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Timeframe Bar & Connection State */}
        <div className="flex items-center gap-2">
          {/* Timeframe Buttons */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={`px-2 py-1 rounded text-xs font-mono transition-all ${
                  selectedTimeframe === tf.value
                    ? 'bg-emerald-500/20 text-[#00FF66] font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Live Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
            title={`WebSocket: ${connectionStatus} (Last updated: ${lastUpdated || 'None'})`}
          >
            {connectionStatus === 'CONNECTED' ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline font-bold">LIVE STREAM</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span className="hidden sm:inline font-bold">{connectionStatus}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full flex-1 min-h-[380px]" ref={chartContainerRef}>
        {isLoading && (
          <div className="absolute inset-0 bg-[#070a12]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            <span className="text-xs font-mono text-slate-300">
              Streaming Delta Exchange India Candlesticks ({selectedSymbol} - {selectedTimeframe})...
            </span>
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>Engine: <strong className="text-slate-300">TradingView Lightweight Charts v5</strong></span>
          <span className="hidden sm:inline">Feed: <strong className="text-emerald-400">Delta India Public WebSocket (Raw OHLCV)</strong></span>
          <span className="hidden md:inline text-amber-400 font-semibold">• SMA 200 Indicator</span>
          <span className="hidden md:inline text-cyan-400 font-semibold">• SuperTrend ATR(10, 3.0)</span>
        </div>
        <div>
          <span>Last Tick: <strong className="text-slate-300">{lastUpdated || 'Waiting for stream...'}</strong></span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveCandlestick;

  // Load available products for search dropdown
  useEffect(() => {
    let isMounted = true;
    api.markets.getProducts().then((res) => {
      if (isMounted && Array.isArray(res) && res.length > 0) {
        setProducts(res);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) => p.symbol.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [products, searchQuery]);

  // Initialize Lightweight Chart Canvas
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#070a12' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Plus Jakarta Sans', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0, 255, 102, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#00FF66',
        },
        horzLine: {
          color: 'rgba(0, 255, 102, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#00FF66',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00FF66',
      downColor: '#FF3366',
      borderVisible: false,
      wickUpColor: '#00FF66',
      wickDownColor: '#FF3366',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay on same chart
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Responsive Auto Resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  // Load Historical Candles & Subscribe to WebSocket Stream
  useEffect(() => {
    let isSubscribed = true;
    setIsLoading(true);

    const loadDataAndSubscribe = async () => {
      try {
        // 1. Fetch initial ticker
        const tickerRes = await api.markets.getTicker(selectedSymbol);
        if (isSubscribed && tickerRes && tickerRes.price) {
          setLivePrice(tickerRes.price);
          setMarkPrice(tickerRes.mark_price || tickerRes.price);
          setHigh24h(tickerRes.high || null);
          setLow24h(tickerRes.low || null);
          setVolume24h(tickerRes.volume || null);
          setPriceChange(tickerRes.change_24h || 0);
        }

        // 2. Fetch Historical Candles from Delta India
        const candleRes = await api.markets.getCandles(selectedSymbol, selectedTimeframe, 200);
        if (!isSubscribed) return;

        if (candleRes && Array.isArray(candleRes.candles) && candleRes.candles.length > 0) {
          const formattedCandles = candleRes.candles.map((c) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));

          const formattedVolumes = candleRes.candles.map((c) => ({
            time: Number(c.time),
            value: Number(c.volume || 0),
            color: Number(c.close) >= Number(c.open) ? 'rgba(0, 255, 102, 0.25)' : 'rgba(255, 51, 102, 0.25)',
          }));

          rawCandlesRef.current = formattedCandles;

          // Compute SMA 200 and Supertrend
          const smaData = calculateSMA200(formattedCandles, 200);
          const supertrendData = calculateSupertrend(formattedCandles, 10, 3.0);

          if (candleSeriesRef.current && volumeSeriesRef.current) {
            candleSeriesRef.current.setData(formattedCandles);
            volumeSeriesRef.current.setData(formattedVolumes);
            smaSeriesRef.current?.setData(smaData);
            supertrendSeriesRef.current?.setData(supertrendData);
            chartRef.current?.timeScale().fitContent();
          }

          const last = formattedCandles[formattedCandles.length - 1];
          lastCandleRef.current = last;
          setLivePrice(last.close);
          setLastUpdated(new Date().toLocaleTimeString());
          setConnectionStatus('CONNECTED');
        } else {
          setConnectionStatus('STALE');
        }
      } catch (err) {
        if (isSubscribed) setConnectionStatus('DISCONNECTED');
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    };

    loadDataAndSubscribe();

    // 3. Connect Live Delta India WebSocket for streaming ticks
    const ws = api.createDeltaWebSocket(
      selectedSymbol,
      selectedTimeframe,
      (candleUpdate) => {
        if (!isSubscribed || !candleSeriesRef.current) return;
        const candleData = {
          time: candleUpdate.time,
          open: candleUpdate.open,
          high: candleUpdate.high,
          low: candleUpdate.low,
          close: candleUpdate.close,
        };

        const volData = {
          time: candleUpdate.time,
          value: candleUpdate.volume,
          color: candleUpdate.close >= candleUpdate.open ? 'rgba(0, 255, 102, 0.4)' : 'rgba(255, 51, 102, 0.4)',
        };

        try {
          candleSeriesRef.current.update(candleData);
          volumeSeriesRef.current?.update(volData);

          // Update latest candle in buffer
          const candles = rawCandlesRef.current;
          if (candles.length > 0) {
            if (candles[candles.length - 1].time === candleData.time) {
              candles[candles.length - 1] = candleData;
            } else if (candleData.time > candles[candles.length - 1].time) {
              candles.push(candleData);
              if (candles.length > 300) candles.shift();
            }
          }
        } catch {
          // Ignore rare clock skew on updates
        }

        setLivePrice((prev) => {
          if (prev !== null) {
            setTickDirection(candleUpdate.close >= prev ? 'UP' : 'DOWN');
          }
          return candleUpdate.close;
        });
        setLastUpdated(new Date().toLocaleTimeString());
        setConnectionStatus('CONNECTED');
      },
      (tickerUpdate) => {
        if (!isSubscribed) return;
        if (tickerUpdate.price) {
          setLivePrice(tickerUpdate.price);
          setMarkPrice(tickerUpdate.mark_price || tickerUpdate.price);
          if (tickerUpdate.change_24h !== undefined) {
            setPriceChange(tickerUpdate.change_24h);
          }
          setLastUpdated(new Date().toLocaleTimeString());
        }
      }
    );

    return () => {
      isSubscribed = false;
      if (ws && typeof ws.close === 'function') {
        ws.close();
      }
    };
  }, [selectedSymbol, selectedTimeframe]);

  const handleSelectSymbol = (sym) => {
    setSelectedSymbol(sym);
    setIsSearchOpen(false);
    setSearchQuery('');
    if (onSymbolChange) onSymbolChange(sym);
  };

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-[#070a12] p-4 flex flex-col overflow-hidden shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-3">
        {/* Symbol & Exchange Selector */}
        <div className="flex items-center gap-3">
          {/* Symbol Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 text-white font-mono font-bold text-sm transition-all"
            >
              <span className="text-emerald-400 font-extrabold">{selectedSymbol}</span>
              <span className="text-xs text-slate-400 font-normal">PERP</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isSearchOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-slate-800 bg-[#0b0f19] shadow-2xl z-50 p-2">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Crypto Symbol..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.symbol}
                      onClick={() => handleSelectSymbol(p.symbol)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left ${
                        selectedSymbol === p.symbol
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="font-bold">{p.symbol}</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[130px]">{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Exchange Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {selectedExchange}
          </div>

          {/* Indicator Toggles */}
          <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              onClick={() => setShowSma200(!showSma200)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                showSma200
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle 200-Period Simple Moving Average line"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showSma200 ? 'bg-amber-400' : 'bg-slate-600'}`} />
              <span>SMA 200</span>
            </button>
            <button
              onClick={() => setShowSupertrend(!showSupertrend)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 border ${
                showSupertrend
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle ATR(10, 3.0) Supertrend trailing band"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showSupertrend ? 'bg-cyan-400' : 'bg-slate-600'}`} />
              <span>SuperTrend</span>
            </button>
          </div>
        </div>

        {/* Live Price & 24h Stats */}
        <div className="flex items-center gap-4">
          {livePrice !== null ? (
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xl sm:text-2xl font-mono font-extrabold transition-colors duration-300 ${
                  tickDirection === 'UP' ? 'text-[#00FF66]' : tickDirection === 'DOWN' ? 'text-[#FF3366]' : 'text-white'
                }`}
              >
                ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {priceChange !== null && (
                <span
                  className={`text-xs font-mono font-semibold flex items-center gap-0.5 ${
                    priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <div className="h-6 w-24 bg-slate-800 animate-pulse rounded" />
          )}

          {/* Mark Price */}
          {markPrice && (
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400">Mark Price</span>
              <span className="text-xs font-mono text-slate-200">${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* 24h High/Low */}
          {high24h && low24h && (
            <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-mono text-slate-400">24h High</span>
                <span className="text-xs font-mono text-slate-300">${high24h.toLocaleString()}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-mono text-slate-400">24h Low</span>
                <span className="text-xs font-mono text-slate-300">${low24h.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Timeframe Bar & Connection State */}
        <div className="flex items-center gap-2">
          {/* Timeframe Buttons */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={`px-2 py-1 rounded text-xs font-mono transition-all ${
                  selectedTimeframe === tf.value
                    ? 'bg-emerald-500/20 text-[#00FF66] font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Live Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
            title={`WebSocket: ${connectionStatus} (Last updated: ${lastUpdated || 'None'})`}
          >
            {connectionStatus === 'CONNECTED' ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline font-bold">LIVE STREAM</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span className="hidden sm:inline font-bold">{connectionStatus}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full flex-1 min-h-[380px]" ref={chartContainerRef}>
        {isLoading && (
          <div className="absolute inset-0 bg-[#070a12]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            <span className="text-xs font-mono text-slate-300">
              Streaming Delta Exchange India Candlesticks ({selectedSymbol} - {selectedTimeframe})...
            </span>
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>Engine: <strong className="text-slate-300">TradingView Lightweight Charts v5</strong></span>
          <span className="hidden sm:inline">Feed: <strong className="text-emerald-400">Delta India Public WebSocket (Raw OHLCV)</strong></span>
          <span className="hidden md:inline text-amber-400 font-semibold">• SMA 200 Indicator</span>
          <span className="hidden md:inline text-cyan-400 font-semibold">• SuperTrend ATR(10, 3.0)</span>
        </div>
        <div>
          <span>Last Tick: <strong className="text-slate-300">{lastUpdated || 'Waiting for stream...'}</strong></span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveCandlestick;
