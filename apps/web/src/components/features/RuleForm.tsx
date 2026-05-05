'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { X, ShieldCheck, Droplets, Zap, Send, ChevronRight, HelpCircle } from 'lucide-react';
import { TriggerType, ActionType } from '@chaintrigger/shared';

interface RuleFormProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RuleForm({ userId, onClose, onSuccess }: RuleFormProps) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('new_listing');
  const [minLiquidity, setMinLiquidity] = useState('50000');
  const [minSecurity, setMinSecurity] = useState('80');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [noMint, setNoMint] = useState(false);
  const [noFreeze, setNoFreeze] = useState(false);
  const [top10, setTop10] = useState('50'); // Default %50 max
  const { chain: connectedChain } = useAccount();
  const [chain, setChain] = useState('solana');

  // Map connected chain to Birdeye chain names
  useEffect(() => {
    if (connectedChain) {
      const name = connectedChain.name.toLowerCase();
      if (name.includes('solana')) setChain('solana');
      else if (name.includes('ethereum')) setChain('ethereum');
      else if (name.includes('base')) setChain('base');
      else if (name.includes('arbitrum')) setChain('arbitrum');
      else if (name.includes('polygon')) setChain('polygon');
      else if (name.includes('optimism')) setChain('optimism');
    }
  }, [connectedChain]);

  const [telegramStatus, setTelegramStatus] = useState<{ isConnected: boolean; username?: string; chatId?: string }>({ isConnected: false });
  const [isLinking, setIsLinking] = useState(false);

  // Fetch and poll for telegram status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/user/status?address=${userId}`);
        const data = await res.json();
        setTelegramStatus(data);
        if (data.isConnected) {
          setChatId(data.telegramChatId);
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(() => {
      if (!telegramStatus.isConnected) {
        checkStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, telegramStatus.isConnected]);

  const handleLinkTelegram = async () => {
    setIsLinking(true);
    try {
      const res = await fetch('/api/user/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userId }),
      });
      const data = await res.json();
      if (data.link) {
        window.open(data.link, '_blank');
      }
    } catch (error) {
      console.error('Error linking:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const isPro = userStatus?.tier === 'pro';
  const limit = isPro ? 50 : 3;
  const isLimitReached = ruleCount >= limit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return;
    setLoading(true);

    const ruleData = {
      name,
      userId,
      triggerType,
      conditions: [
        { field: 'liquidity', operator: '>=', value: Number(minLiquidity) },
        { field: 'security_score', operator: '>=', value: Number(minSecurity) },
        ...(noMint ? [{ field: 'no_mint_authority', operator: '==', value: 1 }] : []),
        ...(noFreeze ? [{ field: 'no_freeze_authority', operator: '==', value: 1 }] : []),
        { field: 'top_10_holder_percent', operator: '<=', value: Number(top10) },
      ],
      action: {
        type: 'telegram' as ActionType,
        chatId,
      },
      chain,
    };

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (error) {
      console.error('Error creating rule:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-background/95 backdrop-blur-md overflow-hidden"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl h-full md:h-auto md:max-h-[90vh] bg-surface border border-[#1c1d24] relative shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-[#1c1d24] shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 border border-mint/20 flex items-center justify-center text-mint">
                <Zap size={16} />
             </div>
             <div>
                <h3 className="text-base md:text-lg font-bold uppercase tracking-widest text-mint leading-none">Catalyst Node</h3>
                <span className="text-[8px] md:text-[9px] font-mono text-[#4a4b52] uppercase tracking-[0.2em]">Birdeye Intelligence</span>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#4a4b52] hover:text-white transition-colors">
            <X size={24} className="md:w-5 md:h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Blueprint Selection */}
          <div className="p-4 md:p-6 pb-0">
            <div className="flex items-center gap-2 mb-3">
               <label className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Rapid_Deploy_Blueprints</label>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
               {[
                 { name: 'PUMP_ALPHA', trigger: 'pump_fun_migration', liq: '50000', sec: '80' },
                 { name: 'TREND_WHALE', trigger: 'whale_radar', liq: '100000', sec: '60' },
                 { name: 'SAFE_GEMS', trigger: 'new_listing', liq: '20000', sec: '95' }
               ].map((bp) => (
                 <button
                   key={bp.name}
                   type="button"
                   onClick={() => {
                     setName(bp.name);
                     setTriggerType(bp.trigger as TriggerType);
                     setMinLiquidity(bp.liq);
                     setMinSecurity(bp.sec);
                   }}
                   className="p-3 md:p-2 border border-[#1c1d24] bg-[#0c0d12] hover:border-mint/50 transition-all text-left group"
                 >
                   <div className="text-[9px] md:text-[8px] font-mono text-[#4a4b52] group-hover:text-mint uppercase">{bp.name}</div>
                   <div className="text-[7px] font-mono text-[#2a2b32] mt-1 uppercase">PRESET_01</div>
                 </button>
               ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Automation Alias</label>
                <div className="group relative hidden md:block">
                  <HelpCircle size={10} className="text-[#4a4b52] cursor-help hover:text-mint transition-colors" />
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 p-2 bg-[#0c0d12] border border-[#1c1d24] text-[8px] font-mono text-[#a4a5ab] uppercase leading-tight z-[60] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all">
                    Give your automation a unique name to identify it in the dashboard.
                  </div>
                </div>
              </div>
              <input 
                type="text"
                required
                placeholder="RULE_0X_ALPHA"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#08090d] border border-[#1c1d24] py-2.5 md:py-2 px-4 text-[12px] font-mono text-white focus:outline-none focus:border-[#FFB800] focus:shadow-[1px_1px_0px_#FFB800] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
              {/* Chain Selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Network Context</label>
                </div>
                <select 
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                  className="w-full bg-[#08090d] border border-[#1c1d24] py-2.5 md:py-2 px-4 text-[12px] font-mono text-white focus:outline-none focus:border-[#FFB800] focus:shadow-[1px_1px_0px_#FFB800] transition-all appearance-none uppercase tracking-widest cursor-pointer"
                >
                  <option value="solana">Solana (Beta)</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="base">Base</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="polygon">Polygon</option>
                  <option value="optimism">Optimism</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Trigger Type</label>
                </div>
                <select 
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                  className="w-full bg-[#08090d] border border-[#1c1d24] py-2.5 md:py-2 px-4 text-[12px] font-mono text-white focus:outline-none focus:border-[#FFB800] focus:shadow-[1px_1px_0px_#FFB800] appearance-none transition-all"
                >
                  <option value="new_listing">NEW_LISTING</option>
                  <option value="trending_entry">TRENDING_ENTRY</option>
                  <option value="whale_radar">WHALE_RADAR</option>
                  <option value="liquidity_drain">LIQUIDITY_DRAIN</option>
                  <option value="volatility_breakout">VOLATILITY_BREAKOUT</option>
                  <option value="pump_fun_migration">PUMP_FUN_MIGRATION</option>
                </select>
                <div className="mt-2 p-2 bg-white/5 border-l border-mint/30">
                  <p className="text-[8px] font-mono text-[#4a4b52] leading-tight uppercase">
                    {triggerType === 'new_listing' && "Listen for freshly minted tokens on Solana mainnet."}
                    {triggerType === 'trending_entry' && "Detect tokens gaining massive volume on Birdeye."}
                    {triggerType === 'whale_radar' && "Alert on large transaction clusters for trending tokens."}
                    {triggerType === 'liquidity_drain' && "Emergency alert when liquidity pools are suddenly reduced."}
                    {triggerType === 'volatility_breakout' && "Identify volume spikes before price discovery."}
                    {triggerType === 'pump_fun_migration' && "Detect tokens migrating from Pump.fun to Raydium (High Alpha)."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Logic Filters (AND)</label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#08090d] border border-[#1c1d24] p-3 space-y-3">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-blue-400 uppercase">
                    <Droplets size={12} /> Min. Liquidity (USD)
                  </div>
                  <input 
                    type="number"
                    required
                    value={minLiquidity}
                    onChange={(e) => setMinLiquidity(e.target.value)}
                    className="w-full bg-transparent border-b border-[#1c1d24] focus:border-[#FFB800] focus:shadow-[0px_1px_0px_#FFB800] outline-none font-mono text-xs py-1 transition-all"
                  />
                </div>
                <div className="bg-[#08090d] border border-[#1c1d24] p-3 space-y-3">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-amber uppercase">
                    <ShieldCheck size={12} /> Min. Security Score
                  </div>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={minSecurity}
                    onChange={(e) => setMinSecurity(e.target.value)}
                    className="w-full bg-transparent border-b border-[#1c1d24] focus:border-[#FFB800] focus:shadow-[0px_1px_0px_#FFB800] outline-none font-mono text-xs py-1 transition-all"
                  />
                </div>
              </div>

              {/* Advanced Security Filters Panel */}
              <div className="bg-[#0c0d12] border border-[#1c1d24] p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Security Configuration</label>
                  <span className="text-[8px] font-mono text-mint/50">ENHANCED_V3</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-4">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={noMint}
                        onChange={(e) => setNoMint(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-3 h-3 border border-[#1c1d24] peer-checked:bg-mint peer-checked:border-mint transition-all" />
                      <span className="text-[10px] font-mono text-[#a4a5ab] group-hover:text-white transition-colors">No Mint Authority</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={noFreeze}
                        onChange={(e) => setNoFreeze(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-3 h-3 border border-[#1c1d24] peer-checked:bg-mint peer-checked:border-mint transition-all" />
                      <span className="text-[10px] font-mono text-[#a4a5ab] group-hover:text-white transition-colors">No Freeze Authority</span>
                    </label>
                  </div>
                  
                  <div className="space-y-2">
                     <div className="flex justify-between items-center">
                       <div className="flex items-center gap-2">
                         <span className="text-[9px] font-mono text-[#4a4b52] uppercase">MAX TOP 10 HOLDER %</span>
                       </div>
                       <span className="text-[9px] font-mono text-white">{top10}%</span>
                     </div>
                     <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={top10}
                      onChange={(e) => setTop10(e.target.value)}
                      className="w-full accent-mint h-1 bg-[#1c1d24] appearance-none cursor-pointer"
                     />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Telegram Action Node</label>
              </div>
              
              <div className={`p-4 border transition-all ${telegramStatus.isConnected ? 'border-mint/20 bg-[#0c0d12]' : 'border-[#1c1d24] bg-[#08090d]'}`}>
                 {telegramStatus.isConnected ? (
                   <div className="space-y-4">
                     <div className="flex items-center justify-between border-b border-[#1c1d24] pb-3">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-mint animate-pulse" />
                         <span className="text-[10px] font-mono text-mint uppercase tracking-widest">Link_Established</span>
                       </div>
                       <span className="text-[8px] font-mono text-[#4a4b52] uppercase">Secure_Session</span>
                     </div>
                     
                     <div className="flex items-center justify-between">
                       <div className="space-y-1">
                         <div className="flex items-center gap-2">
                           <span className="text-[9px] font-mono text-[#4a4b52] uppercase">User:</span>
                           <span className="text-[10px] font-bold text-white uppercase tracking-tight">@{telegramStatus.username || 'Anonymous'}</span>
                         </div>
                       </div>
                       
                       <button 
                        type="button"
                        onClick={() => setTelegramStatus({ isConnected: false })}
                        className="px-3 py-1 border border-red-500/20 text-red-500/50 hover:text-red-500 hover:border-red-500/50 transition-all text-[8px] font-mono uppercase"
                       >
                        Reset
                       </button>
                     </div>
                   </div>
                 ) : (
                   <div className="flex flex-col items-center gap-4 py-2">
                     <p className="text-[9px] font-mono text-[#4a4b52] uppercase text-center">Telegram connection required</p>
                     <button 
                      type="button"
                      onClick={handleLinkTelegram}
                      disabled={isLinking}
                      className="w-full sm:w-auto px-6 py-3 border border-mint text-mint text-[9px] font-bold uppercase tracking-widest hover:bg-mint hover:text-black transition-all flex items-center justify-center gap-2"
                     >
                       <Zap size={14} /> {isLinking ? 'GENERATING...' : 'Initialize_Telegram_Link'}
                     </button>
                   </div>
                 )}
              </div>
            </div>

            {isLimitReached && (
              <div className="bg-amber/5 border border-amber/20 p-4 mb-2">
                <p className="text-[9px] font-mono text-amber uppercase leading-relaxed text-center">
                  Limit reached. {isPro ? 'PRO' : 'FREE'} users are limited to {limit} active nodes. 
                  {!isPro && ' Upgrade to PRO for up to 50 nodes.'}
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-[#1c1d24]">
              <button 
                type="button" 
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 md:py-2 border border-[#1c1d24] text-[9px] font-bold uppercase tracking-widest hover:bg-white/5"
              >
                Abort
              </button>
              <button 
                type="submit"
                disabled={loading || isLimitReached}
                className="w-full sm:w-auto bg-mint text-black px-6 py-3 md:py-2 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[9px] hover:brightness-110 disabled:opacity-50 disabled:grayscale shadow-glow"
              >
                {loading ? 'Initializing...' : isLimitReached ? 'LIMIT_REACHED' : 'Deploy Rule Node'} <ChevronRight size={12} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

  );
}
