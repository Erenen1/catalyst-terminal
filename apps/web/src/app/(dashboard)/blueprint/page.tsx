'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Database, Search, Filter, ArrowRight, Loader2 } from 'lucide-react';

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
      config: {
        triggerType: 'pump_fun_migration',
        conditions: [{ field: 'liquidity', operator: '>=', value: 50000 }],
        action: { type: 'telegram', params: { chatId: '' } },
        chain: 'solana'
      }
    },
    { 
      id: 'SAFE_HARBOR',
      name: 'SAFE_HARBOR', 
      desc: 'Focuses on 99+ security score listings with verified liquidity lock.', 
      risk: 'LOW', 
      performance: '1.5x AVG', 
      tags: ['Multi-Chain', 'Safe'],
      config: {
        triggerType: 'new_listing',
        conditions: [{ field: 'security_score', operator: '>=', value: 95 }],
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
      config: {
        triggerType: 'trending_entry',
        conditions: [{ field: 'volume_24h', operator: '>=', value: 100000 }],
        action: { type: 'telegram', params: { chatId: '' } },
        chain: 'solana'
      }
    }
  ];

  const deployBlueprint = async (blueprint: typeof blueprints[0]) => {
    if (!address) return;
    setDeploying(blueprint.id);
    setConfirmingBlueprint(null);
    
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...blueprint.config,
          name: blueprint.name,
          userId: address,
        }),
      });

      if (res.ok) {
        router.push('/dashboard');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to deploy');
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
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
                    <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">{blueprint.name}</span>
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
