import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { TradingProvider } from './context/TradingContext';

import DashboardLayout from './components/layout/DashboardLayout';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import MarketsPage from './pages/MarketsPage';
import StrategyLabPage from './pages/StrategyLabPage';
import BacktestingPage from './pages/BacktestingPage';
import TradingTerminalPage from './pages/TradingTerminalPage';
import PortfolioPage from './pages/PortfolioPage';
import TradeHistoryPage from './pages/TradeHistoryPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import SettingsPage from './pages/SettingsPage';
import AiStrategiesPage from './pages/AiStrategiesPage';
import PerformancePage from './pages/PerformancePage';
import TradingAccountsPage from './pages/TradingAccountsPage';
import MirrorLeadersPage from './pages/MirrorLeadersPage';

// QuantEX Upgrades
import StrategyScorecardPage from './pages/StrategyScorecardPage';
import RiskCenterPage from './pages/RiskCenterPage';
import ApiHubPage from './pages/ApiHubPage';
import AiCopilotPage from './pages/AiCopilotPage';
import TradingJournalPage from './pages/TradingJournalPage';
import SystemHealthPage from './pages/SystemHealthPage';
import AuditTrailPage from './pages/AuditTrailPage';

export function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <TradingProvider>
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Authentication */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Main QuantEX Trading Application Layout */}
              <Route element={<DashboardLayout />}>
                {/* Main Workspace */}
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/markets" element={<MarketsPage />} />
                <Route path="/strategies" element={<AiStrategiesPage />} />
                <Route path="/scorecard" element={<StrategyScorecardPage />} />
                <Route path="/strategy-lab" element={<StrategyLabPage />} />
                <Route path="/backtesting" element={<BacktestingPage />} />
                <Route path="/performance" element={<PerformancePage />} />
                <Route path="/journal" element={<TradingJournalPage />} />
                <Route path="/history" element={<TradeHistoryPage />} />

                {/* Pro Trading */}
                <Route path="/terminal" element={<TradingTerminalPage />} />
                <Route path="/accounts" element={<TradingAccountsPage />} />
                <Route path="/risk" element={<RiskCenterPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/mirror-leaders" element={<MirrorLeadersPage />} />

                {/* Integrations */}
                <Route path="/api-hub" element={<ApiHubPage />} />

                {/* Intelligence */}
                <Route path="/copilot" element={<AiCopilotPage />} />

                {/* System */}
                <Route path="/system-health" element={<SystemHealthPage />} />
                <Route path="/audit-trail" element={<AuditTrailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Catch-all redirect to Landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TradingProvider>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
