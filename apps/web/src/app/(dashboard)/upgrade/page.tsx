'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Crown, Zap, Shield, Check, Copy, Gift, Users, ArrowUpRight, Lock, Activity, Globe, Cpu } from 'lucide-react';
import { SphereCheckoutButton } from '@/components/subscription/SphereCheckoutButton';
import { cn } from '@/lib/utils';


export default function UpgradePage() {
  const { address } = useAccount();
  const [userStatus, setUserStatus] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      const storedRef = typeof window !== 'undefined' ? localStorage.getItem('referral_code') : null;
      const url = `/api/user/status?address=${address}${storedRef ? `&ref=${storedRef}` : ''}`;
      fetch(url)
        .then(res => res.json())
        .then(data => setUserStatus(data));
    }
  }, [address]);

  const isPro = userStatus?.tier === 'pro';

  const copyReferral = async () => {
    if (!userStatus?.referralCode) return;
    const url = `${window.location.origin}/?ref=${userStatus.referralCode}`;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">
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
              <h3 className="text-xl font-black text-white uppercase italic">Standard_Node</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">$0</span>
                <span className="text-[#4a4b52] font-mono text-[12px] uppercase">/ Lifetime</span>
              </div>
              
              <ul className="space-y-4 pt-4 border-t border-[#1c1d24]">
                {[
                  { text: "3 Active Monitoring Nodes", enabled: true },
                  { text: `${userStatus?.settings?.pollingFree || '4h'} Monitoring Interval`, enabled: true },
                  { text: "Standard Telegram Alerts", enabled: true },
                  { text: "Multi-Chain Access", enabled: true },
                  { text: `${userStatus?.settings?.pollingPro || '1h'} Priority Polling`, enabled: false },
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
              <h3 className="text-xl font-black text-white uppercase italic">Catalyst_Pro</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">$29</span>
                <span className="text-[#4a4b52] font-mono text-[12px] uppercase">/ 30_Days</span>
              </div>
              
              <ul className="space-y-4 pt-4 border-t border-[#1c1d24]">
                {[
                  { text: "50 Active Monitoring Nodes", icon: Zap },
                  { text: `${userStatus?.settings?.pollingPro || '1h'} Priority Polling`, icon: Activity },
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
              {isPro ? (
                <div className="w-full py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] bg-mint/5 text-mint border border-mint/30">
                  ✓ CATALYST_PRO_ACTIVE
                </div>
              ) : (
                <SphereCheckoutButton
                  walletAddress={address ?? ''}
                  label="UPGRADE_TO_PRO — $29 USDC/MO"
                  className="bg-mint text-black hover:bg-mint/90 shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)]"
                />
              )}
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
              <h4 className="text-lg font-black text-white uppercase italic">Invite_Fellow_Traders</h4>
              <p className="text-[11px] font-mono text-[#a4a5ab] uppercase leading-relaxed max-w-md">
                Extend your Pro status effortlessly. For every successful node initialized via your link, 
                both you and your peer receive <span className="text-white">+7 Days of Catalyst Pro</span> access.
              </p>
            </div>

            <div className="lg:w-1/2 w-full space-y-4">
              <div className="text-[10px] font-mono text-[#4a4b52] uppercase tracking-[0.2em] mb-2">Personal_Access_Link</div>
              <div className="flex gap-0 group/copy">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    readOnly 
                    value={userStatus?.referralCode ? `${window.location.origin}/?ref=${userStatus.referralCode}` : 'INITIALIZING_CODE...'}
                    className="w-full bg-black/40 border border-[#1c1d24] border-r-0 px-5 py-4 text-[11px] font-mono text-mint/80 focus:outline-none transition-all group-hover/copy:border-mint/30"
                  />
                  {!userStatus?.referralCode && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center animate-pulse">
                      <span className="text-[9px] font-mono text-mint">GEN_LINK...</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={copyReferral}
                  className={cn(
                    "px-8 font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border",
                    copied 
                      ? "bg-mint text-black border-mint" 
                      : "bg-white text-black border-white hover:bg-mint hover:border-mint shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)]"
                  )}
                >
                  {copied ? <Check size={16} className="animate-bounce" /> : <Copy size={16} />}
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
