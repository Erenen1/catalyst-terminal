'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Crown, Zap, Shield, Check, Copy, Gift, Users, ArrowUpRight, Lock, Activity, Globe, Cpu } from 'lucide-react';

export default function UpgradePage() {
  const { address } = useAccount();
  const [userStatus, setUserStatus] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      fetch(`/api/user/status?address=${address}`)
        .then(res => res.json())
        .then(data => setUserStatus(data));
    }
  }, [address]);

  const isPro = userStatus?.tier === 'pro';
  const helioPayId = process.env.NEXT_PUBLIC_HELIO_PAY_ID || '65f123abc';

  const copyReferral = () => {
    if (!userStatus?.referralCode) return;
    const url = `${window.location.origin}/?ref=${userStatus.referralCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32 pt-8 px-4 md:px-0">
      {/* Page Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="h-[1px] w-12 bg-mint/30"></div>
          <span className="text-[10px] font-mono text-mint uppercase tracking-[0.3em] animate-pulse">Operational_Tiers</span>
          <div className="h-[1px] w-12 bg-mint/30"></div>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter italic">
          Select Your <span className="text-mint">Deployment_Grade</span>
        </h1>
        <p className="text-[#a4a5ab] font-mono text-[11px] uppercase tracking-widest max-w-2xl mx-auto leading-relaxed">
          Scale your DeFi intelligence with institutional-grade latency and unlimited monitoring capabilities.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
        
        {/* Standard Plan (Free) */}
        <div className="group relative border border-[#1c1d24] bg-[#0c0d12]/50 hover:bg-[#0c0d12] transition-all duration-500 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#1c1d24] to-transparent group-hover:via-white/20 transition-all"></div>
          
          <div className="p-8 md:p-10 space-y-8">
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-[#4a4b52] uppercase tracking-widest">TIER_01</div>
              <h3 className="text-3xl font-black text-white uppercase italic">Standard_Node</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-white">$0</span>
                <span className="text-[#4a4b52] font-mono text-[12px] uppercase">/ Lifetime</span>
              </div>
              
              <ul className="space-y-4 pt-4 border-t border-[#1c1d24]">
                {[
                  { text: "3 Active Monitoring Nodes", enabled: true },
                  { text: "60s Polling Interval", enabled: true },
                  { text: "Standard Telegram Alerts", enabled: true },
                  { text: "Multi-Chain Access", enabled: true },
                  { text: "10s Ultra-Fast Polling", enabled: false },
                  { text: "Security Score Filters", enabled: false },
                ].map((item, idx) => (
                  <li key={idx} className={`flex items-center gap-3 text-[11px] font-mono uppercase ${item.enabled ? 'text-[#a4a5ab]' : 'text-[#2a2b32] line-through'}`}>
                    <Check size={14} className={item.enabled ? 'text-mint' : 'text-[#2a2b32]'} />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            <button 
              disabled={!isPro}
              className={`w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${
                !isPro 
                ? 'bg-mint/5 text-mint border-mint/20 cursor-default' 
                : 'bg-transparent text-[#4a4b52] border-[#1c1d24] hover:border-white/20 hover:text-white'
              }`}
            >
              {!isPro ? 'CURRENT_TIER_ACTIVE' : 'DOWNGRADE_NOT_AVAILABLE'}
            </button>
          </div>
        </div>

        {/* Catalyst Pro Plan (Premium) */}
        <div className="group relative border-2 border-mint bg-[#08090d] shadow-[0_0_50px_rgba(34,197,94,0.05)] overflow-hidden">
          {/* Pro Badge */}
          <div className="absolute top-0 right-0 bg-mint text-black px-4 py-1 text-[10px] font-black uppercase tracking-tighter italic origin-bottom-right rotate-0">
            RECOMMENDED
          </div>
          
          <div className="p-8 md:p-10 space-y-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Crown size={14} className="text-mint" />
                <span className="text-[10px] font-mono text-mint uppercase tracking-widest">TIER_02</span>
              </div>
              <h3 className="text-3xl font-black text-white uppercase italic">Catalyst_Pro</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-white">$29</span>
                <span className="text-[#4a4b52] font-mono text-[12px] uppercase">/ 30_Days</span>
              </div>
              
              <ul className="space-y-4 pt-4 border-t border-[#1c1d24]">
                {[
                  { text: "50 Active Monitoring Nodes", icon: Zap },
                  { text: "10s Ultra-Fast Polling", icon: Activity },
                  { text: "Full Security Armor (Mint/Freeze)", icon: Shield },
                  { text: "Top 10 Holder Concentration Filter", icon: Cpu },
                  { text: "Priority Support & Node Sync", icon: Globe },
                  { text: "Whale Radar Access", icon: Crown },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[11px] font-mono uppercase text-white">
                    <item.icon size={14} className="text-mint shrink-0" />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-black/50 border border-[#1c1d24] flex items-center gap-4">
                <div className="w-10 h-10 bg-mint/10 border border-mint/20 flex items-center justify-center shrink-0">
                  <Lock size={16} className="text-mint" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold text-white uppercase tracking-tight">Secured by Helio Pay</div>
                  <div className="text-[8px] font-mono text-[#4a4b52] uppercase">SPL / SOL / USDC / CARD</div>
                </div>
              </div>

              <button 
                onClick={() => {
                  if (!address) {
                    setError('WALLET_CONNECTION_MISSING');
                    return;
                  }
                  const helioUrl = `https://app.helio.xyz/pay/${helioPayId}?walletAddress=${address}`;
                  window.open(helioUrl, '_blank');
                }}
                disabled={isPro}
                className={`w-full py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                  isPro 
                  ? 'bg-mint/10 text-mint border border-mint cursor-default' 
                  : 'bg-mint text-black hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:brightness-110'
                }`}
              >
                {isPro ? 'PRO_TIER_ACTIVE' : 'INITIALIZE_UPGRADE'} 
                {isPro ? <Shield size={16} /> : <ArrowUpRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Section (Enhanced) */}
      <div className="max-w-5xl mx-auto">
        <div className="relative border border-[#1c1d24] bg-[#08090d] overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-all">
            <Users size={120} />
          </div>
          
          <div className="p-8 md:p-10 flex flex-col lg:flex-row items-center gap-10">
            <div className="lg:w-1/2 space-y-4 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-mint/10 border border-mint/20 text-mint text-[9px] font-bold uppercase tracking-widest">
                <Gift size={12} /> Referral_Protocol_V1
              </div>
              <h4 className="text-2xl font-black text-white uppercase italic">Invite_Fellow_Traders</h4>
              <p className="text-[11px] font-mono text-[#a4a5ab] uppercase leading-relaxed max-w-md">
                Extend your Pro status effortlessly. For every successful node initialized via your link, 
                both you and your peer receive <span className="text-white">+7 Days of Catalyst Pro</span> access.
              </p>
            </div>

            <div className="lg:w-1/2 w-full space-y-4">
              <div className="text-[10px] font-mono text-[#4a4b52] uppercase tracking-widest mb-2">Personal_Access_Link</div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    readOnly 
                    value={userStatus?.referralCode ? `${window.location.origin}/?ref=${userStatus.referralCode}` : 'INITIALIZING_CODE...'}
                    className="w-full bg-black border border-[#1c1d24] px-4 py-4 text-[11px] font-mono text-white focus:outline-none focus:border-mint/50 transition-all"
                  />
                  {!userStatus?.referralCode && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center animate-pulse">
                      <span className="text-[9px] font-mono text-mint">GEN_LINK...</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={copyReferral}
                  className="px-6 bg-white text-black font-black uppercase text-[10px] tracking-widest hover:bg-mint transition-all flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono text-[#4a4b52] uppercase">
                <div className="flex items-center gap-1.5">
                  <Users size={10} /> {userStatus?.referralCount || 0} Successful_Invites
                </div>
                <div className="w-[1px] h-3 bg-[#1c1d24]"></div>
                <div className="flex items-center gap-1.5">
                  <Activity size={10} /> Infinite_Potential_Rewards
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-500/5 border border-red-500/20 p-4 text-center">
            <span className="text-[10px] font-mono text-red-500 uppercase">System_Error: {error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
