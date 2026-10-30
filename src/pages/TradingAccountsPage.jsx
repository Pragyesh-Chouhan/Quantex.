import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Link2,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  ExternalLink,
  Zap,
  Lock,
  Layers,
  Key,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { DemoBadge } from '../components/common/DemoBadge';
import BrokerConnectModal from '../components/common/BrokerConnectModal';
import { useTrading } from '../context/TradingContext';

export const TradingAccountsPage = () => {
  const { brokers, connectedBrokers, disconnectBroker, isBrokerConnected, setIsBrokerConnected } = useTrading();
  const [activeModalBroker, setActiveModalBroker] = useState(null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#080c14] border border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-heading font-extrabold text-white tracking-tight">
              Connect Your Trading Accounts
            </h1>
            <DemoBadge size="sm" />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage your accounts from a single dashboard.
          </p>
        </div>

        {/* Global Connection Simulator Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBrokerConnected(!isBrokerConnected)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all flex items-center gap-2 ${
              isBrokerConnected
                ? 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                : 'bg-slate-900 text-slate-400 border-white/[0.08] hover:text-white'
            }`}
            title="Toggle between Broker Connected and Disconnected states for testing empty states"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBrokerConnected ? 'bg-[#00FF66] shadow-[0_0_8px_#00FF66]' : 'bg-slate-500'
              }`}
            />
            <span>{isBrokerConnected ? 'Broker Feed: ACTIVE' : 'Broker Feed: DISCONNECTED'}</span>
          </button>
        </div>
      </div>

      {/* Grid of 6 Broker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {brokers.map((broker) => {
          const isConnected = connectedBrokers.includes(broker.id);

          return (
            <motion.div
              key={broker.id}
              whileHover={{ y: broker.isAvailable ? -4 : 0, transition: { duration: 0.2 } }}
              className={`relative rounded-3xl p-6 transition-all duration-200 border flex flex-col justify-between ${
                isConnected
                  ? 'bg-[#09111c] border-[#00FF66]/40 shadow-xl shadow-[#00FF66]/5'
                  : broker.isAvailable
                  ? 'bg-[#090d16] border-white/[0.08] hover:border-white/[0.2] shadow-lg'
                  : 'bg-[#06080e]/60 border-white/[0.04] opacity-75'
              }`}
            >
              <div>
                {/* Header: Logo Placeholder & Status Badge */}
                <div className="flex items-center justify-between mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-heading font-black text-lg border border-white/[0.1] shadow-md"
                    style={{
                      backgroundColor: `${broker.logoColor}15`,
                      color: broker.logoColor,
                    }}
                  >
                    {broker.shortName.substring(0, 2).toUpperCase()}
                  </div>

                  <div>
                    {broker.isAvailable ? (
                      isConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <span>Available</span>
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-800 text-slate-400 border border-white/[0.06]">
                        <Clock className="w-3 h-3" />
                        <span>Coming Soon</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Broker Title & Description */}
                <h3 className="text-lg font-heading font-bold text-white tracking-wide">
                  {broker.name}
                </h3>
                <p className="text-xs font-mono text-[#00FF66] mt-0.5">{broker.tagline}</p>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  {broker.description}
                </p>
              </div>

              {/* Action Footer */}
              <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                  {broker.category}
                </span>

                {broker.isAvailable ? (
                  isConnected ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => disconnectBroker(broker.id)}
                        className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                      >
                        Disconnect
                      </Button>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => setActiveModalBroker(broker.id)}
                      >
                        Settings
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveModalBroker(broker.id)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Connect Broker
                    </Button>
                  )
                ) : (
                  <Button variant="ghost" size="sm" disabled className="text-slate-600 cursor-not-allowed">
                    Coming Soon
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Security Guidance Box */}
      <div className="p-5 rounded-2xl bg-[#090d16] border border-white/[0.06] flex items-start gap-3.5 text-xs text-slate-400">
        <Shield className="w-5 h-5 text-[#00FF66] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-white">How API Credentials Work:</span> Connecting a broker gives QuantEX direct access to stream simulated quotes and place orders. We never request withdrawal permissions—only read and trade scopes are supported.
        </div>
      </div>

      {/* Connection Modal */}
      {activeModalBroker && (
        <BrokerConnectModal
          isOpen={Boolean(activeModalBroker)}
          defaultBrokerId={activeModalBroker}
          onClose={() => setActiveModalBroker(null)}
        />
      )}
    </div>
  );
};

export default TradingAccountsPage;
