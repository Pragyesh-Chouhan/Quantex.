import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  X,
  Clock,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { formatCurrency, formatCompactNumber, formatPercent } from '../utils/formatters';
import InteractiveCandlestick from '../components/charts/InteractiveCandlestick';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Tabs from '../components/common/Tabs';
import { DemoBadge, DemoModePill } from '../components/common/DemoBadge';
import { DEMO_ORDER_BOOK } from '../data/demoData';

export const TradingTerminalPage = () => {
  const {
    instruments,
    selectedSymbol,
    setSelectedSymbol,
    selectedInstrument,
    positions,
    closePosition,
    openOrders,
    cancelOrder,
    trades,
    executeSimulatedOrder,
    portfolio,
  } = useTrading();

  // Order form state
  const [orderSide, setOrderSide] = useState('BUY'); // BUY | SELL
  const [orderType, setOrderType] = useState('LIMIT'); // LIMIT | MARKET
  const [orderPrice, setOrderPrice] = useState(selectedInstrument.price);
  const [quantity, setQuantity] = useState(0.1);
  const [stopLoss, setStopLoss] = useState(
    Number((selectedInstrument.price * 0.98).toFixed(selectedInstrument.precision))
  );
  const [takeProfit, setTakeProfit] = useState(
    Number((selectedInstrument.price * 1.04).toFixed(selectedInstrument.precision))
  );

  // Bottom tabs state (Positions, Open Orders, Order History)
  const [bottomTab, setBottomTab] = useState('positions');

  // Confirmation modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const orderBook = DEMO_ORDER_BOOK;

  // Update prices when instrument switches
  const handleInstrumentChange = (symbol) => {
    setSelectedSymbol(symbol);
    const inst = instruments.find((i) => i.symbol === symbol) || selectedInstrument;
    setOrderPrice(inst.price);
    setStopLoss(Number((inst.price * 0.98).toFixed(inst.precision)));
    setTakeProfit(Number((inst.price * 1.04).toFixed(inst.precision)));
  };

  const totalCost = (orderType === 'MARKET' ? selectedInstrument.price : orderPrice) * quantity;

  const handleQuickPercent = (pct) => {
    const usableBalance = portfolio.availableBalance * (pct / 100);
    const price = orderType === 'MARKET' ? selectedInstrument.price : orderPrice;
    const computedQty = Number((usableBalance / price).toFixed(4));
    setQuantity(Math.max(selectedInstrument.minQty, computedQty));
  };

  const handleOpenConfirmModal = (e) => {
    e.preventDefault();
    setConfirmModalOpen(true);
  };

  const handleExecuteConfirmedOrder = async () => {
    setIsSubmitting(true);
    try {
      await executeSimulatedOrder({
        symbol: selectedSymbol,
        side: orderSide,
        type: orderType,
        price: orderType === 'MARKET' ? selectedInstrument.price : orderPrice,
        quantity,
        stopLoss,
        takeProfit,
      });
    } finally {
      setIsSubmitting(false);
      setConfirmModalOpen(false);
    }
  };

  const bottomTabsList = [
    { id: 'positions', label: 'Open Positions', badge: positions.length },
    { id: 'openOrders', label: 'Open Orders', badge: openOrders.length },
    { id: 'history', label: 'Order History', badge: trades.length },
  ];

  return (
    <div className="space-y-4">
      {/* Top Ticker Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#090e1c] border border-white/[0.08]">
        {/* Instrument Selector & Price */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={selectedSymbol}
              onChange={(e) => handleInstrumentChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/30 text-sm font-bold text-white font-mono focus:outline-none cursor-pointer"
            >
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-cyan-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(selectedInstrument.price, selectedInstrument.precision)}
            </span>
            <span
              className={`text-xs font-semibold ${
                selectedInstrument.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {selectedInstrument.change24h >= 0 ? '+' : ''}{selectedInstrument.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 24h Market Stats Strip */}
        <div className="hidden lg:flex items-center gap-6 text-xs font-mono">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">24h High</div>
            <div className="text-emerald-400 font-semibold">
              {formatCurrency(selectedInstrument.high24h, selectedInstrument.precision)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">24h Low</div>
            <div className="text-rose-400 font-semibold">
              {formatCurrency(selectedInstrument.low24h, selectedInstrument.precision)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">24h Volume</div>
            <div className="text-slate-200 font-semibold">
              ${formatCompactNumber(selectedInstrument.volume24h)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Funding Rate</div>
            <div className="text-cyan-400 font-semibold">+0.0100% (8h)</div>
          </div>
        </div>

        {/* Safety Pill */}
        <div className="flex items-center gap-2">
          <DemoModePill />
        </div>
      </div>

      {/* Main Terminal Grid: Chart (Center-Left), Order Book (Center-Right), Order Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Candlestick Chart Area */}
        <div className="lg:col-span-8">
          <InteractiveCandlestick
            symbol={selectedSymbol}
            currentPrice={selectedInstrument.price}
            change24h={selectedInstrument.change24h}
            height={460}
          />
        </div>

        {/* Order Book & Depth */}
        <div className="lg:col-span-4 xl:col-span-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Order Book Card */}
            <Card
              title="Order Book & Liquidity"
              subtitle={`Spread: $${orderBook.spread.toFixed(2)}`}
              headerBadge={<DemoBadge size="xs" />}
              noPadding
            >
              <div className="p-3 text-[11px] font-mono">
                {/* Column Headers */}
                <div className="grid grid-cols-3 text-slate-500 pb-2 border-b border-white/[0.04] text-[10px]">
                  <span>Price (USDT)</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Total</span>
                </div>

                {/* Asks (Sell Orders, Red) */}
                <div className="space-y-1 py-1.5">
                  {orderBook.asks.slice(-5).map((ask, idx) => (
                    <div key={`ask-${idx}`} className="grid grid-cols-3 relative group">
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none rounded"
                        style={{ width: `${ask.depthPct}%` }}
                      />
                      <span className="text-rose-400 font-semibold z-10">{ask.price.toFixed(2)}</span>
                      <span className="text-right text-slate-300 z-10">{ask.size.toFixed(2)}</span>
                      <span className="text-right text-slate-500 z-10">{ask.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Mid-Market Price Indicator */}
                <div className="py-2 my-1 px-2 rounded-lg bg-slate-900 border border-white/[0.05] flex items-center justify-between text-xs font-bold font-mono">
                  <span className="text-white">
                    {formatCurrency(selectedInstrument.price, selectedInstrument.precision)}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-sans">
                    <TrendingUp className="w-3 h-3" /> Simulated Match Engine
                  </span>
                </div>

                {/* Bids (Buy Orders, Green) */}
                <div className="space-y-1 py-1.5">
                  {orderBook.bids.slice(0, 5).map((bid, idx) => (
                    <div key={`bid-${idx}`} className="grid grid-cols-3 relative group">
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none rounded"
                        style={{ width: `${bid.depthPct}%` }}
                      />
                      <span className="text-emerald-400 font-semibold z-10">{bid.price.toFixed(2)}</span>
                      <span className="text-right text-slate-300 z-10">{bid.size.toFixed(2)}</span>
                      <span className="text-right text-slate-500 z-10">{bid.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Second Row: Order Entry Form + Bottom Positions/Orders Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Order Entry Form */}
        <div className="lg:col-span-4">
          <Card
            title="Simulated Order Entry"
            subtitle="Demo execution with simulated risk matching"
            headerBadge={<DemoBadge size="xs" />}
          >
            <form onSubmit={handleOpenConfirmModal} className="space-y-4">
              {/* Buy / Sell Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setOrderSide('BUY')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    orderSide === 'BUY'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  BUY / LONG
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSide('SELL')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    orderSide === 'SELL'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  SELL / SHORT
                </button>
              </div>

              {/* Order Type: Market / Limit */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType('LIMIT')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                    orderType === 'LIMIT'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-white/[0.02] text-slate-400 border-white/[0.06]'
                  }`}
                >
                  Limit Order
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('MARKET')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                    orderType === 'MARKET'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-white/[0.02] text-slate-400 border-white/[0.06]'
                  }`}
                >
                  Market Order
                </button>
              </div>

              {/* Order Price (for Limit) */}
              {orderType === 'LIMIT' && (
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>Limit Price</span>
                    <span>USDT</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}

              {/* Quantity Input & Percentage Quick Selectors */}
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>Order Quantity</span>
                  <span>{selectedInstrument.baseAsset}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={selectedInstrument.minQty}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-cyan-500/50"
                />

                {/* 25%, 50%, 75%, 100% quick buttons */}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickPercent(pct)}
                      className="py-1 rounded-md text-[10px] font-mono bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 border border-white/[0.04]"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop-Loss & Take-Profit Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Stop Loss ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/[0.08] text-xs font-mono text-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Take Profit ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/[0.08] text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Order Cost Summary */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.04] text-xs font-mono space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Estimated Total:</span>
                  <span className="text-white font-bold">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Demo Available:</span>
                  <span className="text-cyan-300">{formatCurrency(portfolio.availableBalance)}</span>
                </div>
              </div>

              {/* Action Button */}
              <Button
                type="submit"
                variant={orderSide === 'BUY' ? 'success' : 'danger'}
                size="md"
                className="w-full"
              >
                Place Simulated {orderSide} Order
              </Button>
            </form>
          </Card>
        </div>

        {/* Bottom Panel: Positions, Open Orders, Order History */}
        <div className="lg:col-span-8">
          <Card
            title={
              <div className="flex items-center gap-4">
                <Tabs
                  tabs={bottomTabsList}
                  activeTab={bottomTab}
                  onChange={setBottomTab}
                  variant="underline"
                />
              </div>
            }
            headerBadge={<DemoBadge size="xs" />}
            noPadding
          >
            {/* Open Positions Tab */}
            {bottomTab === 'positions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 font-mono text-[11px] bg-white/[0.01]">
                      <th className="py-3 px-4">Position</th>
                      <th className="py-3 px-4">Side</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Entry</th>
                      <th className="py-3 px-4">Mark</th>
                      <th className="py-3 px-4">PnL (ROE)</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {positions.length > 0 ? (
                      positions.map((pos) => {
                        const isPos = pos.pnl >= 0;
                        return (
                          <tr key={pos.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 font-semibold text-white">{pos.symbol}</td>
                            <td className="py-3 px-4 font-mono">
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  pos.side === 'LONG'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {pos.side}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">{pos.size}</td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {formatCurrency(pos.entryPrice)}
                            </td>
                            <td className="py-3 px-4 font-mono text-white">
                              {formatCurrency(pos.currentPrice)}
                            </td>
                            <td className="py-3 px-4 font-mono">
                              <span
                                className={`font-semibold ${
                                  isPos ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {isPos ? '+' : ''}{formatCurrency(pos.pnl)} ({pos.pnlPercent.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => closePosition(pos.id)}
                              >
                                Market Close
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          No open positions currently active.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Open Orders Tab */}
            {bottomTab === 'openOrders' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 font-mono text-[11px] bg-white/[0.01]">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Instrument</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Quantity</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {openOrders.length > 0 ? (
                      openOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-mono text-slate-400">{ord.id}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{ord.timestamp}</td>
                          <td className="py-3 px-4 font-semibold text-white">{ord.symbol}</td>
                          <td className="py-3 px-4 font-mono">
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                ord.side === 'BUY'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {ord.side} {ord.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-white">{formatCurrency(ord.price)}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{ord.quantity}</td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-rose-400 hover:text-rose-300"
                              onClick={() => cancelOrder(ord.id)}
                            >
                              Cancel
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          No pending open limit orders.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Order History Tab */}
            {bottomTab === 'history' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 font-mono text-[11px] bg-white/[0.01]">
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Instrument</th>
                      <th className="py-3 px-4">Side</th>
                      <th className="py-3 px-4">Executed Price</th>
                      <th className="py-3 px-4">Qty</th>
                      <th className="py-3 px-4">Realized PnL</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {trades.slice(0, 7).map((trd) => (
                      <tr key={trd.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono text-slate-400">{trd.timestamp}</td>
                        <td className="py-3 px-4 font-semibold text-white">{trd.instrument}</td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                              trd.side === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {trd.side}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-white">
                          {formatCurrency(trd.exitPrice || trd.entryPrice)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{trd.quantity}</td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={`font-semibold ${
                              trd.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {trd.pnl >= 0 ? '+' : ''}{formatCurrency(trd.pnl)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="slate" size="xs">
                            {trd.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Safety Order Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Simulated Order Placement"
        subtitle="QuantEX Simulated Execution Engine"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={orderSide === 'BUY' ? 'success' : 'danger'}
              size="sm"
              isLoading={isSubmitting}
              onClick={handleExecuteConfirmedOrder}
            >
              Confirm Simulated {orderSide}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>DEMO MODE ACTIVE: This order will be matched locally. No real exchange funds are placed.</span>
          </div>

          <div className="divide-y divide-white/[0.06] bg-slate-900/60 p-4 rounded-xl border border-white/[0.06] space-y-2">
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Instrument:</span>
              <span className="text-white font-bold">{selectedSymbol}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-400">Order Action:</span>
              <span className={`font-bold ${orderSide === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {orderSide} ({orderType})
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-400">Execution Price:</span>
              <span className="text-white font-bold">
                {formatCurrency(orderType === 'MARKET' ? selectedInstrument.price : orderPrice)}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-400">Quantity:</span>
              <span className="text-white font-bold">{quantity} {selectedInstrument.baseAsset}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-400">Stop-Loss Target:</span>
              <span className="text-rose-400 font-bold">{formatCurrency(stopLoss)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-400">Take-Profit Target:</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(takeProfit)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-400">Estimated Total:</span>
              <span className="text-cyan-400 font-bold">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TradingTerminalPage;
