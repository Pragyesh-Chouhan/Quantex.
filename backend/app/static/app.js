// QuantEX Algorithmic Trading Dashboard Client

let chart = null;
let currentTab = 'positions';
let isStrategyRunning = false;
let isEmergencyStop = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  fetchData();
  refreshAccountsList();
  refreshStrategiesList();
  setInterval(fetchData, 3000);
});

// Switch active tab
function switchTab(tabName) {
  currentTab = tabName;
  ['positions', 'orders', 'signals', 'trades', 'events', 'settings'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`tab-content-${t}`);
    if (!btn || !content) return;
    if (t === tabName) {
      btn.className = 'tab-btn py-3 px-2 border-b-2 border-indigo-500 text-indigo-400 font-semibold flex items-center space-x-1';
      content.classList.remove('hidden');
    } else {
      btn.className = 'tab-btn py-3 px-2 border-b-2 border-transparent text-gray-400 hover:text-gray-200 flex items-center space-x-1';
      content.classList.add('hidden');
    }
  });

  if (tabName === 'settings') {
    refreshAccountsList();
    refreshStrategiesList();
  }
}

// Initialize Chart.js
function initChart() {
  const ctx = document.getElementById('marketChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Close Price',
          borderColor: '#94a3b8',
          borderWidth: 1.5,
          data: [],
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: 'Fast EMA (9)',
          borderColor: '#6366f1',
          borderWidth: 2,
          data: [],
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: 'Slow EMA (21)',
          borderColor: '#a855f7',
          borderWidth: 2,
          data: [],
          pointRadius: 0,
          tension: 0.1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#374151',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono' },
          bodyFont: { family: 'JetBrains Mono' },
        }
      },
      scales: {
        x: {
          grid: { color: '#1f2937' },
          ticks: { color: '#6b7280', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: '#1f2937' },
          ticks: { color: '#6b7280', font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });
}

// Master Fetch Loop
async function fetchData() {
  try {
    await Promise.all([
      updateExchangeStatus(),
      updateStrategyStatus(),
      updateAccount(),
      updateMarket(),
      updateRisk(),
      updatePositions(),
      updateOrders(),
      updateSignals(),
      updateTrades(),
      updateEvents(),
    ]);
  } catch (err) {
    console.error('Error in poll cycle:', err);
  }
}

// Exchange & Health status
async function updateExchangeStatus() {
  const res = await fetch('/api/v1/exchange/status');
  const data = await res.json();
  const badge = document.getElementById('exchange-badge');
  const txt = document.getElementById('exchange-status-text');

  if (data.connected) {
    badge.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800';
    txt.textContent = data.mode === 'LIVE_TESTNET' ? 'Testnet: Connected' : 'Sandbox Sim: Connected';
    badge.querySelector('span').className = 'w-2 h-2 rounded-full bg-emerald-400';
  } else {
    badge.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-950 text-red-300 border border-red-800';
    txt.textContent = 'Exchange: Disconnected';
    badge.querySelector('span').className = 'w-2 h-2 rounded-full bg-red-400 animate-pulse';
  }
}

// Strategy status & controls
async function updateStrategyStatus() {
  const res = await fetch('/api/v1/strategy/status');
  const data = await res.json();
  isStrategyRunning = data.active;
  isEmergencyStop = data.emergency_stop_active;

  const btn = document.getElementById('btn-toggle-strategy');
  const txt = document.getElementById('btn-strategy-text');
  const banner = document.getElementById('emergency-banner');
  const resetBtn = document.getElementById('btn-emergency-reset');

  if (isEmergencyStop) {
    banner.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
    btn.disabled = true;
    btn.className = 'px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 text-gray-400 cursor-not-allowed';
    txt.textContent = 'Execution Halted';
  } else {
    banner.classList.add('hidden');
    resetBtn.classList.add('hidden');
    btn.disabled = false;
    if (isStrategyRunning) {
      btn.className = 'px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center space-x-1.5 shadow';
      txt.textContent = 'Pause Strategy';
    } else {
      btn.className = 'px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1.5 shadow';
      txt.textContent = 'Start Strategy';
    }
  }
}

// Toggle Strategy
async function toggleStrategy() {
  const endpoint = isStrategyRunning ? '/api/v1/strategy/stop' : '/api/v1/strategy/start';
  await fetch(endpoint, { method: 'POST' });
  fetchData();
}

// Trigger Emergency Stop
async function triggerEmergencyStop() {
  if (confirm('Are you sure you want to trigger EMERGENCY STOP? All new automated trading will be halted immediately.')) {
    await fetch('/api/v1/emergency-stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Operator manual emergency stop' })
    });
    fetchData();
  }
}

// Reset Emergency Stop
async function resetEmergencyStop() {
  if (confirm('Reset emergency stop? The system will return to operational readiness.')) {
    await fetch('/api/v1/emergency-reset', { method: 'POST' });
    fetchData();
  }
}

// Update Account
async function updateAccount() {
  const res = await fetch('/api/v1/account');
  const data = await res.json();
  document.getElementById('metric-balance').textContent = `$${data.total_balance_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('metric-available').textContent = `$${data.total_available_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const pnlEl = document.getElementById('metric-realized-pnl');
  const pnl = data.daily_realized_pnl;
  pnlEl.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
  pnlEl.className = `text-2xl font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
}

// Update Market Data & Chart
async function updateMarket() {
  const res = await fetch('/api/v1/market');
  const data = await res.json();

  if (data.valid && data.candles && data.candles.length > 0) {
    document.getElementById('metric-price').textContent = `$${data.latest_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('metric-fast-ema').textContent = `$${data.latest_fast_ema.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('metric-slow-ema').textContent = `$${data.latest_slow_ema.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    // Update Chart with last 30 candles
    const subset = data.candles.slice(-30);
    chart.data.labels = subset.map(c => new Date(c.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    chart.data.datasets[0].data = subset.map(c => c.close);
    chart.data.datasets[1].data = subset.map(c => c.fast_ema || null);
    chart.data.datasets[2].data = subset.map(c => c.slow_ema || null);
    chart.update('none');
  }
}

// Update Risk Status
async function updateRisk() {
  const res = await fetch('/api/v1/risk/status');
  const data = await res.json();

  const exp = data.live_metrics.current_exposure;
  const maxExp = data.limits.max_position_exposure;
  const pct = Math.min(100, Math.round((exp / maxExp) * 100));

  document.getElementById('risk-exp-text').textContent = `${exp.toFixed(4)} / ${maxExp.toFixed(2)} BTC`;
  document.getElementById('risk-exp-bar').style.width = `${pct}%`;

  document.getElementById('risk-open-orders').textContent = `${data.live_metrics.open_orders_count} / ${data.limits.max_open_orders}`;
  document.getElementById('risk-max-qty').textContent = `${data.limits.max_order_qty} BTC`;
  document.getElementById('risk-daily-limit').textContent = `$${data.limits.daily_loss_limit.toFixed(2)}`;

  document.getElementById('risk-approved-count').textContent = data.live_metrics.signals_risk_approved;
  document.getElementById('risk-rejections-count').textContent = data.live_metrics.signals_risk_rejected;
}

// Update Positions Table
async function updatePositions() {
  const res = await fetch('/api/v1/positions');
  const positions = await res.json();
  document.getElementById('count-positions').textContent = positions.length;

  const tbody = document.getElementById('tbody-positions');
  if (positions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-500">No active positions open</td></tr>';
    return;
  }

  tbody.innerHTML = positions.map(p => {
    const pnlClass = p.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
    const sideClass = p.size > 0 ? 'text-emerald-400' : (p.size < 0 ? 'text-red-400' : 'text-gray-400');
    const sideText = p.size > 0 ? `LONG (${p.size})` : (p.size < 0 ? `SHORT (${p.size})` : 'FLAT');
    const stopLoss = p.size > 0 ? (p.entry_price * 0.98).toFixed(2) : (p.size < 0 ? (p.entry_price * 1.02).toFixed(2) : '-');

    return `
      <tr class="hover:bg-gray-800/40">
        <td class="py-3 px-3 font-semibold text-white">${p.instrument}</td>
        <td class="py-3 px-3 ${sideClass}">${sideText}</td>
        <td class="py-3 px-3 text-gray-300">$${p.entry_price.toFixed(2)}</td>
        <td class="py-3 px-3 text-gray-300">$${p.mark_price.toFixed(2)}</td>
        <td class="py-3 px-3 font-semibold ${pnlClass}">${p.unrealized_pnl >= 0 ? '+' : ''}$${p.unrealized_pnl.toFixed(2)}</td>
        <td class="py-3 px-3 text-amber-400">$${stopLoss}</td>
        <td class="py-3 px-3 text-gray-500 text-[11px]">${new Date(p.updated_at).toLocaleTimeString()}</td>
      </tr>
    `;
  }).join('');
}

// Update Orders Table
async function updateOrders() {
  const res = await fetch('/api/v1/orders?limit=20');
  const orders = await res.json();
  document.getElementById('count-orders').textContent = orders.length;
  document.getElementById('metric-orders-count').textContent = orders.length;

  const tbody = document.getElementById('tbody-orders');
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-500">No orders recorded yet</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => {
    let badgeClass = 'badge-neutral';
    if (o.status === 'FILLED') badgeClass = 'badge-filled';
    else if (o.status === 'REJECTED') badgeClass = 'badge-rejected';
    else if (o.status === 'RECONCILING') badgeClass = 'badge-reconciling';

    const sideColor = o.side.toLowerCase() === 'buy' ? 'text-emerald-400' : 'text-red-400';

    return `
      <tr class="hover:bg-gray-800/40">
        <td class="py-3 px-3 font-semibold text-indigo-300">${o.internal_id}</td>
        <td class="py-3 px-3 text-gray-400">${o.exchange_order_id || '—'}</td>
        <td class="py-3 px-3 font-semibold ${sideColor}">${o.side.toUpperCase()}</td>
        <td class="py-3 px-3 text-white">${o.quantity}</td>
        <td class="py-3 px-3 text-gray-300">${o.price ? `$${o.price.toFixed(2)}` : 'MARKET'}</td>
        <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold ${badgeClass}">${o.status}</span></td>
        <td class="py-3 px-3 text-gray-500 text-[11px]">${new Date(o.updated_at).toLocaleTimeString()}</td>
      </tr>
    `;
  }).join('');
}

// Update Signals Table
async function updateSignals() {
  const res = await fetch('/api/v1/signals?limit=20');
  const signals = await res.json();
  document.getElementById('count-signals').textContent = signals.length;
  document.getElementById('metric-signals-count').textContent = signals.length;

  const tbody = document.getElementById('tbody-signals');
  if (signals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-500">No strategy signals generated yet</td></tr>';
    return;
  }

  tbody.innerHTML = signals.map(s => {
    let sigClass = 'badge-neutral';
    if (s.signal_type === 'BUY') sigClass = 'badge-buy';
    else if (s.signal_type === 'SELL') sigClass = 'badge-sell';

    const decClass = s.validation_status === 'APPROVED' ? 'text-emerald-400' : (s.validation_status === 'REJECTED' ? 'text-red-400' : 'text-gray-400');

    return `
      <tr class="hover:bg-gray-800/40">
        <td class="py-3 px-3 text-gray-500 text-[11px]">${new Date(s.timestamp).toLocaleTimeString()}</td>
        <td class="py-3 px-3 font-semibold text-white">${s.instrument}</td>
        <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold ${sigClass}">${s.signal_type}</span></td>
        <td class="py-3 px-3 text-indigo-400">$${s.fast_ema.toFixed(2)}</td>
        <td class="py-3 px-3 text-purple-400">$${s.slow_ema.toFixed(2)}</td>
        <td class="py-3 px-3 text-white">$${s.close_price.toFixed(2)}</td>
        <td class="py-3 px-3 font-semibold ${decClass}">${s.validation_status} ${s.rejection_reason ? `<span class="text-xs font-normal text-gray-400">(${s.rejection_reason})</span>` : ''}</td>
      </tr>
    `;
  }).join('');
}

// Update Trades & Performance
async function updateTrades() {
  const [tRes, pRes] = await Promise.all([
    fetch('/api/v1/trades?limit=20'),
    fetch('/api/v1/trades/performance')
  ]);
  const trades = await tRes.json();
  const perf = await pRes.json();

  document.getElementById('count-trades').textContent = trades.length;
  document.getElementById('metric-win-rate').textContent = `${perf.win_rate_pct}%`;
  document.getElementById('metric-trade-ratio').textContent = `(${perf.winning_trades}W / ${perf.losing_trades}L)`;
  document.getElementById('metric-net-pnl').textContent = `$${perf.net_pnl.toFixed(2)}`;

  const tbody = document.getElementById('tbody-trades');
  if (trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-500">No completed trades recorded yet</td></tr>';
    return;
  }

  tbody.innerHTML = trades.map(t => {
    const pnlClass = t.realized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
    const sideColor = t.side.toLowerCase() === 'buy' ? 'text-emerald-400' : 'text-red-400';

    return `
      <tr class="hover:bg-gray-800/40">
        <td class="py-3 px-3 font-semibold text-white">${t.trade_id}</td>
        <td class="py-3 px-3 text-indigo-400">${t.order_id}</td>
        <td class="py-3 px-3 font-semibold ${sideColor}">${t.side.toUpperCase()}</td>
        <td class="py-3 px-3 text-gray-200">$${t.fill_price.toFixed(2)}</td>
        <td class="py-3 px-3 text-white">${t.fill_quantity}</td>
        <td class="py-3 px-3 text-gray-400">$${t.fees.toFixed(2)}</td>
        <td class="py-3 px-3 font-semibold ${pnlClass}">${t.realized_pnl >= 0 ? '+' : ''}$${t.realized_pnl.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
}

// Update System Events Table
async function updateEvents() {
  const res = await fetch('/api/v1/events?limit=20');
  const events = await res.json();
  document.getElementById('count-events').textContent = events.length;

  const tbody = document.getElementById('tbody-events');
  if (events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-gray-500">No audit events logged yet</td></tr>';
    return;
  }

  tbody.innerHTML = events.map(e => {
    let sevClass = 'text-gray-400 bg-gray-800';
    if (e.severity === 'CRITICAL' || e.severity === 'ERROR') sevClass = 'text-red-300 bg-red-950 border border-red-800';
    else if (e.severity === 'WARNING') sevClass = 'text-amber-300 bg-amber-950 border border-amber-800';
    else if (e.severity === 'INFO') sevClass = 'text-blue-300 bg-blue-950 border border-blue-800';

    return `
      <tr class="hover:bg-gray-800/40">
        <td class="py-2.5 px-3 text-gray-500 text-[11px]">${new Date(e.timestamp).toLocaleTimeString()}</td>
        <td class="py-2.5 px-3 font-mono font-semibold text-indigo-300">${e.category}</td>
        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${sevClass}">${e.severity}</span></td>
        <td class="py-2.5 px-3 text-gray-300 text-xs">${e.message}</td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// Delta Exchange Account & Settings Services
// ==========================================

// Refresh Connected Accounts List and Status
async function refreshAccountsList() {
  const userId = document.getElementById('input-user-id')?.value || 'default_user';
  const container = document.getElementById('accounts-list-container');
  const countEl = document.getElementById('count-accounts');
  const activeDisplay = document.getElementById('active-acc-display');

  try {
    const [accRes, statusRes] = await Promise.all([
      fetch(`/api/v1/accounts?user_id=${encodeURIComponent(userId)}`),
      fetch(`/api/v1/accounts/status?user_id=${encodeURIComponent(userId)}`)
    ]);

    const accounts = await accRes.json();
    const statusData = await statusRes.json();

    if (countEl) countEl.textContent = accounts.length;

    if (activeDisplay) {
      if (statusData.has_active_account) {
        activeDisplay.textContent = `${statusData.label} (${statusData.api_key_masked})`;
      } else {
        activeDisplay.textContent = 'Sandbox / Default';
      }
    }

    if (!container) return;

    if (!accounts || accounts.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center border border-dashed border-gray-800 rounded-lg text-gray-500 text-xs">
          <p>No Delta Testnet accounts connected yet.</p>
          <p class="mt-1 text-gray-400">Add your API credentials using the form to start trading with your own Testnet account.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = accounts.map(a => {
      const activeBadge = a.is_active
        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">ACTIVE</span>'
        : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">INACTIVE</span>';

      const validBadge = a.is_validated
        ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-950/60">Verified</span>'
        : '<span class="px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-400 bg-amber-950/60">Unverified</span>';

      const activateBtn = !a.is_active
        ? `<button onclick="activateAccount('${a.account_id}')" class="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600/80 hover:bg-indigo-600 text-white transition">Set Active</button>`
        : '';

      return `
        <div class="p-3.5 bg-gray-950/60 border border-gray-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-gray-700 transition">
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <span class="font-semibold text-white text-xs">${a.label}</span>
              ${activeBadge}
              ${validBadge}
            </div>
            <div class="text-[11px] font-mono text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Key: <strong class="text-indigo-300">${a.api_key_masked}</strong></span>
              <span>•</span>
              <span class="text-gray-500 truncate max-w-[200px]" title="${a.base_url}">${a.base_url}</span>
              <span>•</span>
              <span>User: <strong class="text-gray-300">${a.user_id}</strong></span>
            </div>
          </div>
          <div class="flex items-center space-x-2 self-end sm:self-auto">
            ${activateBtn}
            <button onclick="disconnectAccount('${a.account_id}')" class="px-2.5 py-1 text-xs font-semibold rounded bg-red-950/50 hover:bg-red-900/80 text-red-300 border border-red-800/60 transition">
              Disconnect
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching accounts:', err);
    if (container) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-red-400">Failed to load accounts: ${err.message}</div>`;
    }
  }
}

// Test Credentials against Delta Exchange Testnet without persisting
async function handleValidateCredentialsOnly() {
  const alertEl = document.getElementById('connect-alert');
  const baseUrl = document.getElementById('input-base-url').value.trim();
  const apiKey = document.getElementById('input-api-key').value.trim();
  const apiSecret = document.getElementById('input-api-secret').value.trim();

  if (!apiKey || !apiSecret) {
    showAlert(alertEl, 'Please enter both Delta API Key and Secret to test.', 'error');
    return;
  }

  showAlert(alertEl, '⏳ Connecting to Delta Exchange Testnet and validating credentials...', 'info');

  try {
    const res = await fetch('/api/v1/accounts/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: baseUrl,
        api_key: apiKey,
        api_secret: apiSecret,
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const lat = data.details?.latency_ms ? `${data.details.latency_ms}ms` : 'OK';
      showAlert(alertEl, `✅ Authentication Successful! Testnet connection verified. (Latency: ${lat})`, 'success');
    } else {
      const errMsg = data.detail?.message || data.detail?.error || data.detail || 'Authentication failed. Please verify API key, secret, and IP permissions.';
      showAlert(alertEl, `❌ Validation Failed: ${errMsg}`, 'error');
    }
  } catch (err) {
    showAlert(alertEl, `❌ Network error while reaching Delta Exchange: ${err.message}`, 'error');
  }
}

// Connect and save new account
async function handleAccountConnect(event) {
  event.preventDefault();
  const alertEl = document.getElementById('connect-alert');
  const saveBtn = document.getElementById('btn-save-acc');

  const label = document.getElementById('input-acc-label').value.trim();
  const userId = document.getElementById('input-user-id').value.trim();
  const baseUrl = document.getElementById('input-base-url').value.trim();
  const apiKey = document.getElementById('input-api-key').value.trim();
  const apiSecret = document.getElementById('input-api-secret').value.trim();

  if (!label || !apiKey || !apiSecret) {
    showAlert(alertEl, 'Please fill in all required fields.', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Validating & Connecting...';
  showAlert(alertEl, '⏳ Validating credentials with Delta Exchange Testnet...', 'info');

  try {
    const res = await fetch('/api/v1/accounts/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label,
        user_id: userId,
        base_url: baseUrl,
        api_key: apiKey,
        api_secret: apiSecret,
        environment: 'testnet',
      })
    });

    const data = await res.json();
    if (res.ok) {
      showAlert(alertEl, `✅ Account "${data.label}" successfully connected and encrypted at rest!`, 'success');
      // Clear sensitive secret fields
      document.getElementById('input-api-key').value = '';
      document.getElementById('input-api-secret').value = '';
      document.getElementById('input-acc-label').value = '';

      // Refresh accounts list and system status
      await refreshAccountsList();
      await fetchData();
    } else {
      const errMsg = typeof data.detail === 'string' ? data.detail : (data.detail?.message || 'Failed to connect account.');
      showAlert(alertEl, `❌ Error: ${errMsg}`, 'error');
    }
  } catch (err) {
    showAlert(alertEl, `❌ Request failed: ${err.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save & Connect Account';
  }
}

// Activate an account
async function activateAccount(accountId) {
  const userId = document.getElementById('input-user-id')?.value || 'default_user';
  try {
    const res = await fetch(`/api/v1/accounts/${accountId}/activate?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST'
    });
    if (res.ok) {
      await refreshAccountsList();
      await fetchData();
    } else {
      const err = await res.json();
      alert(`Could not activate account: ${err.detail || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Network error activating account: ${err.message}`);
  }
}

// Disconnect an account
async function disconnectAccount(accountId) {
  if (!confirm('Are you sure you want to disconnect this account? The encrypted credentials will be permanently erased.')) {
    return;
  }
  const userId = document.getElementById('input-user-id')?.value || 'default_user';
  try {
    const res = await fetch(`/api/v1/accounts/${accountId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await refreshAccountsList();
      await fetchData();
    } else {
      const err = await res.json();
      alert(`Could not disconnect account: ${err.detail || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Network error disconnecting account: ${err.message}`);
  }
}

// Helper to display alert banner in connect form
function showAlert(el, msg, type) {
  if (!el) return;
  el.classList.remove('hidden', 'bg-red-950/80', 'text-red-300', 'border-red-800', 'bg-emerald-950/80', 'text-emerald-300', 'border-emerald-800', 'bg-blue-950/80', 'text-blue-300', 'border-blue-800');
  el.classList.add('border');

  if (type === 'error') {
    el.classList.add('bg-red-950/80', 'text-red-300', 'border-red-800');
  } else if (type === 'success') {
    el.classList.add('bg-emerald-950/80', 'text-emerald-300', 'border-emerald-800');
  } else {
    el.classList.add('bg-blue-950/80', 'text-blue-300', 'border-blue-800');
  }
  el.textContent = msg;
}

// ==========================================
// Strategy Plugins & Management Services
// ==========================================

async function refreshStrategiesList() {
  const container = document.getElementById('strategies-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/v1/strategies');
    if (!res.ok) throw new Error('Failed to load strategies');
    const strategies = await res.json();

    if (!strategies || strategies.length === 0) {
      container.innerHTML = '<div class="col-span-2 text-center py-4 text-xs text-gray-500">No strategy plugins registered.</div>';
      return;
    }

    container.innerHTML = strategies.map(s => {
      const isEnabled = s.enabled;
      const statusBadge = isEnabled
        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">ENABLED</span>'
        : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">DISABLED</span>';

      const toggleBtn = isEnabled
        ? `<button onclick="toggleStrategyPlugin('${s.strategy_id}', true)" class="px-2.5 py-1 text-xs font-semibold rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 transition">Disable</button>`
        : `<button onclick="toggleStrategyPlugin('${s.strategy_id}', false)" class="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 transition">Enable</button>`;

      const configSummary = s.config ? Object.entries(s.config).map(([k, v]) => `<span class="text-gray-400">${k}: <strong class="text-gray-200">${v}</strong></span>`).join(' • ') : 'Default parameters';

      return `
        <div class="p-4 bg-gray-950/70 border border-gray-800 rounded-xl space-y-3 hover:border-gray-700 transition">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-bold text-white text-xs">${s.strategy_name}</span>
                <span class="text-[10px] font-mono text-gray-500">v${s.strategy_version}</span>
                ${statusBadge}
              </div>
              <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">${s.description}</p>
            </div>
          </div>
          <div class="text-[10px] font-mono bg-gray-900/80 p-2 rounded border border-gray-800/80 overflow-x-auto">
            ${configSummary}
          </div>
          <div class="flex items-center justify-between pt-1">
            <button onclick="runStrategyBacktest('${s.strategy_id}')" class="px-3 py-1 text-xs font-semibold rounded bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60 transition flex items-center space-x-1">
              <span>📊 Run Backtest</span>
            </button>
            <div class="flex items-center space-x-2">
              ${toggleBtn}
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching strategies:', err);
    container.innerHTML = `<div class="col-span-2 text-center text-xs text-red-400">Failed to load strategies: ${err.message}</div>`;
  }
}

async function toggleStrategyPlugin(strategyId, currentlyEnabled) {
  const endpoint = currentlyEnabled ? `/api/v1/strategies/${strategyId}/disable` : `/api/v1/strategies/${strategyId}/enable`;
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    if (res.ok) {
      await refreshStrategiesList();
    } else {
      const err = await res.json();
      alert(`Could not toggle strategy: ${err.detail || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Network error: ${err.message}`);
  }
}

async function runStrategyBacktest(strategyId) {
  const panel = document.getElementById('backtest-results-panel');
  const metricsContainer = document.getElementById('backtest-metrics-container');
  const title = document.getElementById('backtest-strat-title');

  if (!panel || !metricsContainer) return;

  panel.classList.remove('hidden');
  if (title) title.textContent = `Historical Backtest — ${strategyId.toUpperCase()}`;
  metricsContainer.innerHTML = '<div class="col-span-4 text-center py-2 text-indigo-300 animate-pulse">Running backtest simulation...</div>';

  try {
    // 1. Fetch historical candles from the market endpoint
    const mRes = await fetch('/api/v1/market?limit=60');
    const mData = await mRes.json();
    const candles = mData.candles || [];

    if (candles.length < 20) {
      metricsContainer.innerHTML = '<div class="col-span-4 text-center text-amber-400">Insufficient candle history for backtest.</div>';
      return;
    }

    // 2. Submit backtest request
    const bRes = await fetch(`/api/v1/strategies/${strategyId}/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candles: candles,
        initial_capital: 10000.0,
        fee_pct: 0.0005,
      })
    });

    const data = await bRes.json();
    if (!bRes.ok) {
      metricsContainer.innerHTML = `<div class="col-span-4 text-center text-red-400">${data.detail || 'Backtest error'}</div>`;
      return;
    }

    const roiColor = data.roi_pct >= 0 ? 'text-emerald-400' : 'text-red-400';
    const pnlColor = data.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400';

    metricsContainer.innerHTML = `
      <div class="bg-gray-900 p-2.5 rounded-lg border border-gray-800">
        <div class="text-gray-400 text-[10px]">NET PROFIT</div>
        <div class="text-base font-bold ${pnlColor}">$${data.net_profit.toFixed(2)}</div>
      </div>
      <div class="bg-gray-900 p-2.5 rounded-lg border border-gray-800">
        <div class="text-gray-400 text-[10px]">ROI %</div>
        <div class="text-base font-bold ${roiColor}">${data.roi_pct >= 0 ? '+' : ''}${data.roi_pct.toFixed(2)}%</div>
      </div>
      <div class="bg-gray-900 p-2.5 rounded-lg border border-gray-800">
        <div class="text-gray-400 text-[10px]">WIN RATE</div>
        <div class="text-base font-bold text-indigo-300">${data.win_rate_pct.toFixed(1)}%</div>
      </div>
      <div class="bg-gray-900 p-2.5 rounded-lg border border-gray-800">
        <div class="text-gray-400 text-[10px]">TRADES (W/L)</div>
        <div class="text-base font-bold text-gray-200">${data.total_trades} (${data.winning_trades}W / ${data.losing_trades}L)</div>
      </div>
    `;

  } catch (err) {
    metricsContainer.innerHTML = `<div class="col-span-4 text-center text-red-400">Backtest failed: ${err.message}</div>`;
  }
}
