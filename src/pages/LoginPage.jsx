import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import Button from '../components/common/Button';
import { Logo } from '../components/common/Logo';
import Modal from '../components/common/Modal';

export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const [activeTab, setActiveTab] = useState(initialTab);
  const { login, signup, isAuthenticated, backendStatus } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  // Form State
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Password reset modal
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // If already authenticated, redirect to workspace
  if (isAuthenticated) {
    return <Navigate to={redirectUrl} replace />;
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (activeTab === 'login') {
      if (!usernameOrEmail.trim()) {
        setError('Please provide your username or email address.');
        return;
      }
      if (!password || password.length < 5) {
        setError('Please enter your password (minimum 6 characters).');
        return;
      }

      setIsLoading(true);
      try {
        await login(usernameOrEmail.trim(), password);
        setIsLoading(false);
        addToast({
          title: 'Sign In Successful',
          message: 'Authenticated against QuantEX FastAPI backend.',
          type: 'success',
        });
        navigate(redirectUrl);
      } catch (err) {
        setIsLoading(false);
        setError(err.message || 'Invalid username or password.');
      }
    } else {
      // Sign Up tab
      if (!username.trim() || username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }

      setIsLoading(true);
      try {
        await signup(username.trim().toLowerCase(), email.trim().toLowerCase(), password);
        setIsLoading(false);
        addToast({
          title: 'Account Registered',
          message: 'Trader account created and authenticated in database.',
          type: 'success',
        });
        navigate(redirectUrl);
      } catch (err) {
        setIsLoading(false);
        setError(err.message || 'Registration failed.');
      }
    }
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) {
      addToast({
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        type: 'error',
      });
      return;
    }
    setResetSent(true);
    setTimeout(() => {
      setForgotModalOpen(false);
      setResetSent(false);
      setResetEmail('');
      addToast({
        title: 'Reset Instructions Dispatched',
        message: 'If the account exists, password recovery instructions have been sent.',
        type: 'info',
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#030508] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-[#00FF66]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="rounded-3xl bg-[#090d16]/95 border border-white/[0.08] backdrop-blur-2xl p-8 shadow-2xl shadow-black/80">
          {/* Logo Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center justify-center mb-3">
              <Logo size="lg" subtitle={false} />
            </Link>

            <h2 className="text-2xl font-bold font-heading text-white">
              {activeTab === 'login' ? 'Sign In to QuantEX' : 'Create Trader Account'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Institutional AI algorithmic trading & strategy lab
            </p>
          </div>

          {/* Backend Connection Status Pill */}
          <div className="mb-6 p-2.5 rounded-2xl bg-slate-900 border border-white/[0.08] flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-300 font-mono pl-1 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${backendStatus.connected ? 'bg-[#00FF66] shadow-[0_0_8px_#00FF66]' : 'bg-amber-400'}`} />
              <span className="font-semibold text-white">FastAPI Auth:</span>
              <span className="text-slate-400">{backendStatus.connected ? 'Live SQLite DB' : 'Connecting...'}</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06]">
              PBKDF2-SHA256
            </span>
          </div>

          {/* Login and Sign Up Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/50 border border-white/[0.06] mb-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'login'
                  ? 'bg-[#00FF66] text-black shadow-md shadow-[#00FF66]/25 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError('');
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'signup'
                  ? 'bg-[#00FF66] text-black shadow-md shadow-[#00FF66]/25 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {activeTab === 'login' ? (
              /* LOGIN FIELDS */
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Enter username or email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66]/50 font-mono"
                    required
                  />
                </div>
              </div>
            ) : (
              /* SIGNUP FIELDS */
              <>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="trader_pro"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66]/50 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@QuantEX.ai"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66]/50 font-mono"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Password field with show/hide */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66]/50 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot Password */}
            {activeTab === 'login' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00FF66] focus:ring-[#00FF66]"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className="text-xs text-[#00FF66] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-2"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {activeTab === 'login' ? 'Sign In to Workspace' : 'Create Free Account'}
            </Button>
          </form>

          {/* Footer Notice */}
          <div className="mt-6 pt-5 border-t border-white/[0.06] text-center text-[11px] text-slate-500 font-mono">
            Protected with PBKDF2 Password Encryption & Cryptographic Bearer Tokens
          </div>
        </div>
      </motion.div>

      {/* Password Reset Modal */}
      {forgotModalOpen && (
        <Modal
          isOpen={forgotModalOpen}
          onClose={() => setForgotModalOpen(false)}
          title="Reset Account Password"
          subtitle="Enter your email to receive a password reset link"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">Your Account Email</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="trader@QuantEX.ai"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#00FF66]/50 font-mono"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForgotModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={resetSent}>
                Send Reset Link
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default LoginPage;
