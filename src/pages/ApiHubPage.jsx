import React, { useState, useEffect } from 'react';
import {
  Globe,
  Key,
  Shield,
  Wifi,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  Trash2,
  Lock,
  Server,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export const ApiHubPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  // Exchange Statuses
  const [exchanges, setExchanges] = useState([]);
  const [activeExchange, setActiveExchange] = useState('delta_india');

  // Egress IP
  const [egressData, setEgressData] = useState(null);
  const [isCopying, setIsCopying] = useState(false);

  // Accounts
  const [accounts, setAccounts] = useState([]);
  const [activeAccountStatus, setActiveAccountStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [accountLabel, setAccountLabel] = useState('Delta Exchange India Live');
  const [environment, setEnvironment] = useState('testnet');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const userId = user?.user_id || 'default_user';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exRes, egressRes, accRes, statusRes] = await Promise.allSettled([
        api.markets.getExchanges(),
        api.accounts.getEgressIp(),
        api.accounts.list(userId),
        api.accounts.getStatus(userId),
      ]);

      if (exRes.status === 'fulfilled' && Array.isArray(exRes.value)) {
        setExchanges(exRes.value);
      }
      if (egressRes.status === 'fulfilled') {
        setEgressData(egressRes.value);
      }
      if (accRes.status === 'fulfilled' && Array.isArray(accRes.value)) {
        setAccounts(accRes.value);
      }
      if (statusRes.status === 'fulfilled') {
        setActiveAccountStatus(statusRes.value);
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleCopyIp = () => {
    if (egressData?.egress_ip) {
      navigator.clipboard.writeText(egressData.egress_ip);
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
      addNotification({
        title: 'IP Copied to Clipboard',
        message: `Backend Egress IP ${egressData.egress_ip} copied. Paste into Delta Exchange IP Whitelist.`,
        type: 'info',
      });
    }
  };

  const handleTestConnection = async (e) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) {
      setTestResult({ success: false, message: 'Please enter both API Key and API Secret.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const baseUrl = environment === 'production'
        ? 'https://api.india.delta.exchange'
        : 'https://cdn-ind.testnet.deltaex.org';

      const res = await api.accounts.validate({
        apiKey,
        secretKey: apiSecret,
        baseUrl,
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: 'Connection Verified! Successfully authenticated with Delta Exchange.',
          details: res.details,
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Authentication rejected by Delta Exchange. Check credentials & IP whitelist.',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Validation request failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!apiKey || !apiSecret) return;

    setIsSaving(true);
    try {
      const baseUrl = environment === 'production'
        ? 'https://api.india.delta.exchange'
        : 'https://cdn-ind.testnet.deltaex.org';

      const res = await api.accounts.connect({
        userId,
        label: accountLabel,
        environment,
        baseUrl,
        apiKey,
        secretKey: apiSecret,
      });

      if (res && res.account_id) {
        setApiKey('');
        setApiSecret('');
        setTestResult(null);
        addNotification({
          title: 'Exchange Account Connected',
          message: `Your account '${accountLabel}' has been securely linked and isolated to your profile.`,
          type: 'success',
        });
        loadData();
      } else {
        addNotification({
          title: 'Connection Failed',
          message: res.error || 'Failed to save exchange connection.',
          type: 'error',
        });
      }
    } catch (err) {
      addNotification({
        title: 'Error',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (accountId) => {
    if (!window.confirm('Are you sure you want to disconnect and permanently delete these API credentials?')) return;

    try {
      await api.accounts.disconnect(accountId, userId);
      addNotification({
        title: 'Account Disconnected',
        message: 'API credentials permanently removed from backend storage.',
        type: 'info',
      });
      loadData();
    } catch (err) {
      addNotification({
        title: 'Disconnect Failed',
        message: err.message,
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold text-white">Multi-Exchange API Hub</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
              DELTA INDIA LIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Connect authenticated exchange APIs, inspect public streaming feeds, and configure server IP whitelisting.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Grid: Supported Exchanges & Backend Outbound IP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Supported Exchanges Overview */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-heading font-bold text-slate-200 uppercase tracking-wider">
            Supported Exchange Providers
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Delta Exchange India Card */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#0a1515] to-[#070a12] p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-white text-base">Delta Exchange India</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">FIU-IND Registered • INR / USD Perp</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-[#00FF66] border border-emerald-500/40">
                  LIVE VERIFIED
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">REST Gateway:</span>
                  <span className="text-slate-200 truncate max-w-[190px]">api.india.delta.exchange</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">Public WebSocket:</span>
                  <span className="text-emerald-400 truncate max-w-[190px]">public-socket.india.delta.exchange</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">Supported Markets:</span>
                  <span className="text-white font-semibold">1,098 Perpetual Pairs</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Private Execution:</span>
                  <span className="text-emerald-400 font-semibold">HMAC-SHA256 Signed</span>
                </div>
              </div>
            </div>

            {/* Binance Spot Adapter Card */}
            <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-white text-base">Binance Spot</h3>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Global Spot Market Provider</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  ADAPTER READY
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">REST Endpoint:</span>
                  <span className="text-slate-200">api.binance.com</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">Public Stream:</span>
                  <span className="text-slate-300">stream.binance.com:9443</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">Market Feed:</span>
                  <span className="text-white font-semibold">Public Tickers / Depth</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Execution Mode:</span>
                  <span className="text-amber-400 font-semibold">Read-Only / Simulation</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Backend Egress IP Whitelisting */}
        <div className="rounded-2xl border border-slate-800 bg-[#090d18] p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-heading font-bold text-white uppercase tracking-wider">
              Server Public Egress IP
            </h2>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Exchanges strictly require your backend's outbound public IP address to be whitelisted before executing API orders.
          </p>

          <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-mono uppercase text-slate-400 block">Outbound Egress IP</span>
              <span className="text-sm font-mono font-extrabold text-cyan-300">
                {egressData?.egress_ip || '127.0.0.1'}
              </span>
            </div>
            <button
              onClick={handleCopyIp}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono font-semibold transition-all border border-cyan-500/30"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{isCopying ? 'COPIED!' : 'COPY'}</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1.5 pt-2">
            <div className="font-semibold text-slate-300">Setup Instructions:</div>
            <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-[10px] font-mono">
              <li>Open Delta Exchange Portal &gt; API Settings.</li>
              <li>Create New Key with "Read &amp; Trade" permission.</li>
              <li>Paste the Egress IP above into "IP Restriction".</li>
              <li>Save &amp; link credentials below.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Connected User Accounts List */}
      <div className="rounded-2xl border border-slate-800 bg-[#070a12] p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00FF66]" />
            <h2 className="text-sm font-heading font-bold text-white uppercase tracking-wider">
              Your Connected Exchange Accounts
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            User Isolation: <strong className="text-white">{userId}</strong>
          </span>
        </div>

        {accounts.length > 0 ? (
          <div className="divide-y divide-slate-800/80">
            {accounts.map((acc) => (
              <div key={acc.account_id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{acc.label}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {acc.environment.toUpperCase()}
                    </span>
                    {acc.is_active && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-[#00FF66] border border-emerald-500/30 font-bold">
                        ACTIVE TRADING
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-slate-500 flex items-center gap-3">
                    <span>Key: {acc.api_key_masked}</span>
                    <span>•</span>
                    <span>Base URL: {acc.base_url}</span>
                    <span>•</span>
                    <span>Validated: {acc.is_validated ? 'YES' : 'PENDING'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDisconnect(acc.account_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center space-y-2">
            <Key className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No Exchange Accounts Connected</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Connect your Delta Exchange API credentials below to view your real live balance, open orders, and position telemetry.
            </p>
          </div>
        )}
      </div>

      {/* Connect New Account Form */}
      <div className="rounded-2xl border border-slate-800 bg-[#090d18] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-heading font-bold text-white uppercase tracking-wider">
              Link New Delta Exchange Account
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Encrypted with Fernet at rest • Never logged
          </span>
        </div>

        <form onSubmit={handleTestConnection} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Account Label</label>
              <input
                type="text"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                placeholder="e.g. Delta India Mainnet Alpha"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="testnet">Delta Testnet Sandbox (Safe Testing)</option>
                <option value="production">Delta Exchange India (Live Production)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter Delta API Key..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter Delta API Secret..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div>
                <div className="font-bold">{testResult.message}</div>
                {testResult.details && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    Balance confirmed: {JSON.stringify(testResult.details)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isTesting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-semibold transition-all border border-slate-700"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              onClick={handleSaveConnection}
              disabled={isSaving || !apiKey || !apiSecret}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              <span>Save &amp; Link Credentials</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiHubPage;
