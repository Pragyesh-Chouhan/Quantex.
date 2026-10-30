import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Cpu,
  BarChart3,
  Link2,
  Settings,
  Terminal,
  TrendingUp,
  History,
  PieChart,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Trophy,
  ShieldAlert,
  Server,
  Sparkles,
  BookOpen,
  Activity,
  FileText,
  Key,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo, LogoIcon } from '../common/Logo';

const NAV_GROUPS = [
  {
    groupTitle: 'MAIN WORKSPACE',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/markets', label: 'Markets', icon: TrendingUp },
      { path: '/strategies', label: 'AI Strategies', icon: Cpu, badge: '18 ALGO' },
      { path: '/scorecard', label: 'Strategy Arena', icon: Trophy, badge: 'SCORECARD' },
      { path: '/strategy-lab', label: 'Strategy Lab', icon: Cpu },
      { path: '/backtesting', label: 'Backtesting', icon: History },
      { path: '/performance', label: 'Performance', icon: BarChart3 },
      { path: '/journal', label: 'Trading Journal', icon: BookOpen, badge: 'AI LOG' },
      { path: '/history', label: 'Trade History', icon: History },
    ],
  },
  {
    groupTitle: 'PRO TRADING',
    items: [
      { path: '/terminal', label: 'Trading Terminal', icon: Terminal, badge: 'LIVE' },
      { path: '/accounts', label: 'Trading Accounts', icon: Link2 },
      { path: '/risk', label: 'Risk Command', icon: ShieldAlert, badge: 'LIMITS' },
      { path: '/portfolio', label: 'Portfolio Asset', icon: PieChart },
    ],
  },
  {
    groupTitle: 'INTEGRATIONS',
    items: [
      { path: '/api-hub', label: 'Exchange API Hub', icon: Key, badge: 'DELTA IND' },
    ],
  },
  {
    groupTitle: 'INTELLIGENCE',
    items: [
      { path: '/copilot', label: 'AI Strategy Copilot', icon: Sparkles, badge: 'EXPLAIN' },
    ],
  },
  {
    groupTitle: 'SYSTEM & SECURITY',
    items: [
      { path: '/system-health', label: 'System Health', icon: Activity, badge: 'REAL' },
      { path: '/audit-trail', label: 'Audit Trail', icon: FileText },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const { user, logout, backendStatus } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-40 flex flex-col justify-between bg-[#080c16]/95 backdrop-blur-2xl border-r border-white/[0.07] transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            {isCollapsed ? (
              <LogoIcon size="md" />
            ) : (
              <Logo size="md" subtitle="AI QUANT PLATFORM" />
            )}
          </NavLink>

          {/* Collapse Button (Desktop) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items (Categorized) */}
        <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto custom-scrollbar">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500 font-bold">
                    {group.groupTitle}
                  </span>
                </div>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all duration-200 group ${
                        isActive
                          ? 'bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/35 font-semibold shadow-md shadow-[#00FF66]/10'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#00FF66]' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                        {!isCollapsed && item.badge && (
                          <span
                            className={`ml-auto text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                              item.badge === 'LIVE' || item.badge === 'REAL'
                                ? 'bg-emerald-500/20 text-[#00FF66] border-emerald-500/30'
                                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <motion.div
                            layoutId="sidebarActiveDot"
                            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#00FF66] shadow-[0_0_8px_#00FF66]"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Status & User Profile */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          {/* Backend Status indicator */}
          {!isCollapsed && (
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.04] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-mono">QuantEX Backend:</span>
                <span
                  className={`flex items-center gap-1.5 font-mono text-[10px] font-semibold ${
                    backendStatus.connected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      backendStatus.connected
                        ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  {backendStatus.connected ? 'LIVE ONLINE' : 'CONNECTING...'}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5 truncate font-mono">
                {backendStatus.url || 'http://localhost:8000'}
              </p>
            </div>
          )}

          {/* User Mini Profile */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 font-mono">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'Q'}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{user?.name || user?.username || 'Trader'}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user?.email || 'QuantEX User'}</div>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
