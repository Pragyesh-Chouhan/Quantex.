import React, { useState } from 'react';
import {
  User,
  Bell,
  Link2,
  Bot,
  Key,
  Lock,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  Zap,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { DemoBadge } from '../components/common/DemoBadge';
import { useAuth } from '../context/AuthContext';
import { useTrading } from '../context/TradingContext';
import { useNotifications } from '../context/NotificationContext';
import BrokerConnectModal from '../components/common/BrokerConnectModal';

export const SettingsPage = () => {
  const { user, backendStatus, checkBackendNow } = useAuth();
  const { connectedBrokers, brokers } = useTrading();
  const { addToast } = useNotifications();

  // Active settings tab
  const [activeTab, setActiveTab] = useState('profile');

  // Profile fields
  const [name, setName] = useState(user?.name || 'Alex Rivera');
  const [email, setEmail] = useState(user?.email || 'quant.alex@QuantEX.ai');
  const [bio, setBio] = useState('Quantitative trader focusing on mean reversion and momentum AI models.');

  // Notification toggles
  const [orderFills, setOrderFills] = useState(true);
  const [strategyAlerts, setStrategyAlerts] = useState(true);
  const [riskBreakers, setRiskBreakers] = useState(true);
  const [webhookPings, setWebhookPings] = useState(false);

  // Trading View Bot Webhook
  const [webhookUrl] = useState('https://api.QuantEX.ai/v1/webhooks/tv_bot_981a');
  const [webhookSecret] = useState('sec_tv_live_449198aa2b');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Password reset fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Delete account confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Broker connect modal
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);

  const navItems = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'notifications', label: 'Notification Settings', icon: Bell },
    { id: 'tradingAccount', label: 'Trading Account', icon: Link2 },
    { id: 'tradingViewBot', label: 'Trading View Bot', icon: Bot, badge: 'WEBHOOK' },
    { id: 'api', label: 'API', icon: Key },
    { id: 'passwordReset', label: 'Password Reset', icon: Lock },
    { id: 'deleteAccount', label: 'Delete Account', icon: Trash2, isDanger: true },
  ];

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    addToast({
      title: 'Webhook URL Copied',
      message: 'Paste this URL into your TradingView alert webhook settings.',
      type: 'info',
    });
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    addToast({
      title: 'Profile Updated',
      message: 'Your profile changes have been saved.',
      type: 'success',
    });
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      addToast({
        title: 'Validation Error',
        message: 'Please fill in all password fields.',
        type: 'error',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({
        title: 'Passwords Do Not Match',
        message: 'New password and confirmation must match.',
        type: 'error',
      });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    addToast({
      title: 'Password Updated',
      message: 'Simulated password reset completed.',
      type: 'success',
    });
  };

  const handleDeleteAccount = () => {
    setDeleteModalOpen(false);
    setDeleteConfirmText('');
    addToast({
      title: 'Simulated Destructive Action',
      message: 'Account deletion is a frontend demonstration. No live records were permanently removed.',
      type: 'warning',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#080c14] border border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-heading font-extrabold text-white tracking-tight">
              Account & Integration Settings
            </h1>
            <DemoBadge size="sm" />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage credentials, broker API keys, TradingView bots, and security preferences.
          </p>
        </div>
      </div>

      {/* Main Settings Layout: Left Sidebar + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sub-Sidebar */}
        <div className="lg:col-span-4 rounded-3xl bg-[#090d16] border border-white/[0.08] p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-medium transition-all ${
                  isActive
                    ? item.isDanger
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold'
                      : 'bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 font-semibold shadow-md shadow-[#00FF66]/10'
                    : item.isDanger
                    ? 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Settings Panel */}
        <div className="lg:col-span-8">
          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <Card title="Profile Settings" subtitle="Personal details and quant profile" headerBadge={<DemoBadge size="xs" />}>
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-mono">
                <div>
                  <label className="block text-slate-300 mb-1.5 font-sans">Full Name / Quant Handle</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#00FF66]/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-sans">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#00FF66]/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-sans">Bio / Strategy Focus</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#00FF66]/50 resize-none font-sans"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" size="sm">
                    Save Profile Settings
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 2: NOTIFICATION SETTINGS */}
          {activeTab === 'notifications' && (
            <Card title="Notification Settings" subtitle="Real-time alert delivery preferences" headerBadge={<DemoBadge size="xs" />}>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-white/[0.05] cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">Order Fill Notifications</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Alert immediately upon simulated limit/market execution</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={orderFills}
                    onChange={(e) => setOrderFills(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00FF66] focus:ring-[#00FF66]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-white/[0.05] cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">AI Strategy Execution Alerts</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Notify when algorithms enter or exit positions</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={strategyAlerts}
                    onChange={(e) => setStrategyAlerts(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00FF66] focus:ring-[#00FF66]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-white/[0.05] cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">Emergency Risk Circuit Breakers</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">High-priority notices for max drawdown and volatility spikes</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={riskBreakers}
                    onChange={(e) => setRiskBreakers(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00FF66] focus:ring-[#00FF66]"
                  />
                </label>
              </div>
            </Card>
          )}

          {/* TAB 3: TRADING ACCOUNT */}
          {activeTab === 'tradingAccount' && (
            <Card title="Trading Account" subtitle="Linked brokers and account configuration" headerBadge={<DemoBadge size="xs" />}>
              <div className="space-y-4 text-xs font-mono">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.05] space-y-3">
                  <div className="flex items-center justify-between font-sans">
                    <span className="font-semibold text-white">Connected Accounts:</span>
                    <span className="text-[#00FF66] font-mono font-bold">
                      {connectedBrokers.length} Linked Broker(s)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {connectedBrokers.map((id) => {
                      const broker = brokers.find((b) => b.id === id);
                      return (
                        <div key={id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <span className="font-bold text-white">{broker?.name || id}</span>
                          <Badge variant="green" size="xs" dot>
                            DMA Active
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setBrokerModalOpen(true)}
                    leftIcon={<Link2 className="w-4 h-4" />}
                  >
                    Connect Additional Account
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 4: TRADING VIEW BOT */}
          {activeTab === 'tradingViewBot' && (
            <Card title="Trading View Bot" subtitle="Webhook alert automation bridge" headerBadge={<DemoBadge size="xs" />}>
              <div className="space-y-4 text-xs font-mono">
                <p className="text-slate-400 leading-relaxed font-sans">
                  Connect your custom PineScript alerts directly to QuantEX execution pipeline using incoming webhooks.
                </p>

                <div>
                  <div className="flex items-center justify-between mb-1.5 text-slate-300 font-sans">
                    <span>Webhook Alert URL:</span>
                    <button
                      onClick={handleCopyWebhook}
                      className="text-[#00FF66] hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] text-cyan-300 select-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-sans">Sample Alert JSON Payload Template</label>
                  <pre className="p-3.5 rounded-2xl bg-black/80 border border-white/[0.06] text-[11px] text-[#00FF66] overflow-x-auto">
{`{
  "passphrase": "${webhookSecret}",
  "ticker": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{close}}"
}`}
                  </pre>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 5: API */}
          {activeTab === 'api' && (
            <Card title="API Keys & Whitelisting" subtitle="Developer credentials and backend configuration" headerBadge={<DemoBadge size="xs" />}>
              <div className="space-y-4 text-xs font-mono">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.05] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Target Backend URL:</span>
                    <span className="text-cyan-300 font-bold">{backendStatus.url || 'http://localhost:5000/api'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">IP Whitelist Status:</span>
                    <span className="text-[#00FF66] font-bold">Dynamic Backend Supplied</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkBackendNow}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5 text-[#00FF66]" />}
                  >
                    Test API Connection
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 6: PASSWORD RESET */}
          {activeTab === 'passwordReset' && (
            <Card title="Password Reset" subtitle="Change and update your account security phrase" headerBadge={<DemoBadge size="xs" />}>
              <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-mono">
                <div>
                  <label className="block text-slate-300 mb-1.5 font-sans">Current Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-white focus:outline-none focus:border-[#00FF66]/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-sans">New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-white focus:outline-none focus:border-[#00FF66]/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-sans">Confirm New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-white focus:outline-none focus:border-[#00FF66]/50"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 font-sans text-xs"
                  >
                    {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPasswords ? 'Hide' : 'Show'} Passwords</span>
                  </button>

                  <Button type="submit" variant="primary" size="sm">
                    Update Password
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 7: DELETE ACCOUNT */}
          {activeTab === 'deleteAccount' && (
            <Card
              title="Delete Account"
              subtitle="Permanent destructive account termination"
              headerBadge={<span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">DANGER ZONE</span>}
            >
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 leading-relaxed">
                  <p className="font-semibold text-white mb-1">Warning: Destructive Action</p>
                  Deleting your account will delete all configured AI strategies, linked broker keys, trade logs, and simulation ledgers.
                </div>

                <p className="text-slate-400 leading-relaxed">
                  To prevent accidental loss, account deletion requires double confirmation.
                </p>

                <div className="pt-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteModalOpen(true)}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                  >
                    Initiate Account Deletion
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Confirm Account Deletion"
          subtitle="Are you sure you want to delete your QuantEX account?"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteConfirmText !== 'DELETE'}
                onClick={handleDeleteAccount}
              >
                Confirm Delete
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs text-slate-300 font-sans">
            <p>
              This is a demonstration dialog. Type <strong className="text-white font-mono">DELETE</strong> in the field below to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/40 text-rose-300 font-mono text-xs focus:outline-none"
            />
          </div>
        </Modal>
      )}

      {/* Broker Connect Modal */}
      {brokerModalOpen && (
        <BrokerConnectModal
          isOpen={brokerModalOpen}
          onClose={() => setBrokerModalOpen(false)}
        />
      )}
    </div>
  );
};

export default SettingsPage;
