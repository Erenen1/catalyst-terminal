'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Database, Search, Filter, ArrowRight, Loader2, Crown } from 'lucide-react';

export default function MarketPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [deploying, setDeploying] = useState<string | null>(null);
  const [confirmingBlueprint, setConfirmingBlueprint] = useState<typeof blueprints[0] | null>(null);

  const blueprints = [
    {
      id: 'PUMP_ALPHA',
      name: 'PUMP_ALPHA',
      desc: 'Optimized for catching Pump.fun migrations to Raydium. High speed execution.',
      risk: 'HIGH',
      performance: '12x AVG',
      tags: ['Solana', 'Low-Cap'],
      isProOnly: false,
      config: {
        triggerType: 'pump_fun_migration',
        conditions: [{ field: 'liquidity', operator: '>=', value: 50000 }],
        action: { type: 'telegram', params: { chatId: '' } },
        chain: 'solana'
      }
    },
    {
      id: 'HOLDER_ALPHA',
      name: 'HOLDER_ALPHA',
      desc: 'Exclusive: Filters tokens with < 20% Top 10 holder concentration. Institutional quality.',
      risk: 'MED',
      performance: '8.5x AVG',
      tags: ['Solana', 'Low-Concentration'],
      isProOnly: true,
      config: {
        triggerType: 'whale_radar',
        conditions: [
          { field: 'top_10_holder_percent', operator: '<=', value: 20 },
          { field: 'liquidity', operator: '>=', value: 100000 }
        ],
        action: { type: 'telegram', params: { chatId: '' } },
        chain: 'solana'
      }
    },
    {
      id: 'MINT_FREEZE_SHIELD',
      name: 'SECURITY_SHIELD',
      desc: 'Ultra-safe nodes: Only alerts when BOTH Mint and Freeze authority are disabled.',
      risk: 'LOW',
      performance: '2.1x AVG',
      tags: ['Security', 'Long-Term'],
      isProOnly: true,
      config: {
        triggerType: 'new_listing',
        conditions: [
          { field: 'no_mint_authority', operator: '==', value: 1 },
          { field: 'no_freeze_authority', operator: '==', value: 1 },
          { field: 'security_score', operator: '>=', value: 99 }
        ],
        action: { type: 'telegram', params: { chatId: '' } },
        chain: 'solana'
      }
    },
    {
      id: 'WHALE_WATCHER',
      name: 'WHALE_WATCHER',
      desc: 'Alerts on high-volume transactions (>50k USD) for trending tokens.',
      risk: 'MED',
      performance: '4x AVG',
      tags: ['Solana', 'Trending'],
      isProOnly: false,
      config: {
        triggerType: 'trending_entry',
        conditions: [{ field: 'volume_24h', operator: '>=', value: 100000 }],
        action: { type: 'telegram', params: { chatId: '' } },
        chain: 'solana'
      }
    }
  ];

  const [userStatus, setUserStatus] = useState<any>(null);

  useEffect(() => {
    if (address) {
      const storedRef = typeof window !== 'undefined' ? localStorage.getItem('referral_code') : null;
      const url = `/api/user/status?address=${address}${storedRef ? `&ref=${storedRef}` : ''}`;
      fetch(url)
        .then(res => res.json())
        .then(data => setUserStatus(data));
    }
  }, [address]);

  const userTier = userStatus?.tier || 'free';
  const telegramChatId = userStatus?.telegramChatId;

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const deployBlueprint = async (blueprint: typeof blueprints[0]) => {
    if (!address) return;
    setError(null);

    if (!telegramChatId) {
      setError('Please link your Telegram account in the dashboard first.');
      return;
    }

    if (blueprint.isProOnly && userTier !== 'pro') {
      setShowUpgradeModal(true);
      return;
    }
    setDeploying(blueprint.id);

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: blueprint.name,
          userId: address,
          triggerType: blueprint.config.triggerType,
          conditions: blueprint.config.conditions,
          action: {
            type: 'telegram',
            chatId: telegramChatId,
          },
          chain: blueprint.config.chain,
        }),
      });

      if (res.ok) {
        setConfirmingBlueprint(null);
        router.refresh(); // Clear Next.js router cache
        router.push('/dashboard');
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to deploy');
      }
    } catch (error) {
      console.error('Deployment error:', error);
    } finally {
      setDeploying(null);
    }
  };

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Confirmation Modal */}
      {confirmingBlueprint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#08090d] border border-mint/30 p-8 space-y-6 shadow-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-mint/20">
              <div className="h-full bg-mint animate-progress w-full"></div>
            </div>

            <div className="space-y-2 text-center">
              <h4 className="text-lg font-bold text-white uppercase tracking-tighter">Confirm Deployment</h4>
              <p className="text-[10px] font-mono text-[#4a4b52] uppercase">Strategy: <span className="text-mint">{confirmingBlueprint.name}</span></p>
            </div>

            <div className="p-4 bg-black border border-[#1c1d24] space-y-3">
              <div className="flex justify-between text-[8px] font-mono text-[#4a4b52] uppercase">
                <span>Network</span>
                <span className="text-white">{confirmingBlueprint.config.chain}</span>
              </div>
              <div className="flex justify-between text-[8px] font-mono text-[#4a4b52] uppercase">
                <span>Trigger</span>
                <span className="text-white">{confirmingBlueprint.config.triggerType}</span>
              </div>
              <div className="flex justify-between text-[8px] font-mono text-[#4a4b52] uppercase">
                <span>Risk_Profile</span>
                <span className={confirmingBlueprint.risk === 'HIGH' ? 'text-red-500' : 'text-mint'}>{confirmingBlueprint.risk}</span>
              </div>
            </div>

            <div className="px-1">
              <p className="text-[7px] font-mono text-[#4a4b52] leading-tight uppercase">
                ⚠️ NOTICE: Deploying this node initiates automated monitoring. The platform is not responsible for any financial losses. Trading crypto involves extreme risk.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-mono uppercase text-center">
                ERROR: {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => deployBlueprint(confirmingBlueprint)}
                className="w-full bg-mint text-black py-3 text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all"
              >
                INITIALIZE_SYNC
              </button>
              <button
                onClick={() => setConfirmingBlueprint(null)}
                className="w-full border border-[#1c1d24] text-[#4a4b52] py-3 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all"
              >
                ABORT_MISSION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#08090d] border border-amber/30 p-8 space-y-6 shadow-amber-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber/20">
              <div className="h-full bg-amber animate-progress w-full"></div>
            </div>

            <div className="flex flex-col items-center gap-3 text-center">
              <div className="p-3 bg-amber/10 border border-amber/30 rounded-full">
                <Crown className="text-amber" size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white uppercase tracking-tighter">PRO Access Required</h4>
                <p className="text-[10px] font-mono text-amber uppercase">Exclusive Institutional Strategy</p>
              </div>
            </div>

            <div className="p-4 bg-black border border-[#1c1d24] space-y-3">
              <div className="flex items-center gap-3 text-[9px] font-mono text-[#849587] uppercase">
                <div className="w-1 h-1 bg-amber"></div> {userStatus?.settings?.pollingPro || '1h'} High-Frequency Polling
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-[#849587] uppercase">
                <div className="w-1 h-1 bg-amber"></div> Advanced Security Radar
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-[#849587] uppercase">
                <div className="w-1 h-1 bg-amber"></div> Unlimited Active Nodes
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push('/upgrade')}
                className="w-full bg-amber text-black py-3 text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                UPGRADE_TO_PRO <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full border border-[#1c1d24] text-[#4a4b52] py-3 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all"
              >
                RETURN_TO_MARKET
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !confirmingBlueprint && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 mb-8">
          <p className="text-[10px] font-mono text-red-500 uppercase text-center">Global_Error: {error}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1c1d24] pb-8">
        <div className="space-y-2 md:space-y-1">
          <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-tighter">Strategy Market</h3>
          <p className="text-[10px] md:text-[11px] font-mono text-[#4a4b52] max-w-md">Deploy high-performance rule blueprints with single-click synchronization.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4b52]" />
            <input
              type="text"
              placeholder="SEARCH_BLUEPRINTS..."
              className="bg-black border border-[#1c1d24] pl-9 pr-4 py-2.5 md:py-2 text-[10px] font-mono text-white focus:outline-none focus:border-mint w-full md:w-64"
            />
          </div>
          <button className="p-2.5 md:p-2 border border-[#1c1d24] text-[#4a4b52] hover:text-mint">
            <Filter size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blueprints.map((blueprint) => (
          <div key={blueprint.name} className="pixel-card group p-6 flex flex-col gap-6 border-dashed hover:border-mint transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-mint/5 -rotate-45 translate-x-8 -translate-y-8 group-hover:bg-mint/10 transition-all"></div>

            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">{blueprint.name}</span>
                  {blueprint.isProOnly && (
                    <span className="px-1.5 py-0.5 bg-amber/10 border border-amber/30 text-amber text-[7px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Crown size={8} /> PRO
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {blueprint.tags.map(tag => (
                    <span key={tag} className="text-[7px] font-mono text-[#4a4b52] uppercase px-1 border border-[#1c1d24]">{tag}</span>
                  ))}
                </div>
              </div>
              <span className={`text-[8px] font-mono px-2 py-0.5 border ${blueprint.risk === 'HIGH' ? 'border-red-500/50 text-red-500' : 'border-mint/50 text-mint'}`}>
                {blueprint.risk}_RISK
              </span>
            </div>

            <p className="text-[11px] font-mono text-[#a4a5ab] leading-relaxed flex-1">{blueprint.desc}</p>

            <div className="flex justify-between items-center pt-6 border-t border-[#1c1d24]">
              <div className="space-y-1">
                <span className="text-[8px] font-mono text-[#4a4b52] uppercase">Performance</span>
                <div className="text-[12px] font-mono text-amber font-bold">{blueprint.performance}</div>
              </div>
              <button
                onClick={() => setConfirmingBlueprint(blueprint)}
                disabled={!!deploying}
                className="flex items-center gap-2 text-[10px] font-bold text-mint hover:underline uppercase tracking-widest disabled:opacity-50"
              >
                {deploying === blueprint.id ? <Loader2 size={14} className="animate-spin" /> : 'Deploy_Node'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
