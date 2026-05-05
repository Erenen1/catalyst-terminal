'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Zap, CheckCircle2, Activity, Trash2, Wallet, Shield } from 'lucide-react';
import { IRule } from '@chaintrigger/shared';
import RuleForm from '@/components/features/RuleForm';
import DeleteConfirmModal from '@/components/features/DeleteConfirmModal';
import SecurityModal from '@/components/features/SecurityModal';
import { useAccount } from 'wagmi';

function formatTimeAgo(date?: Date | string) {
  if (!date) return 'NEVER';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  
  if (seconds < 10) return 'JUST NOW';
  if (seconds < 60) return `${seconds}S AGO`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}M AGO`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  
  const days = Math.floor(hours / 24);
  return `${days}D AGO`;
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [rules, setRules] = useState<IRule[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);
  const [trackedTokens, setTrackedTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<IRule | null>(null);
  const [selectedSecurity, setSelectedSecurity] = useState<any | null>(null);
  const [activeView, setActiveView] = useState<'NODES' | 'ALPHA' | 'MARKET' | 'ACADEMY' | 'PERFORMANCE'>('NODES');

  const fetchGlobalAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts?userId=GLOBAL`);
      const data = await res.json();
      if (Array.isArray(data)) setGlobalAlerts(data);
    } catch (error) {
      console.error('Error fetching global alerts:', error);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/alerts?userId=${address}`);
      const data = await res.json();
      if (Array.isArray(data)) setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [address]);

  const fetchTracked = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/tracked?userId=${address}`);
      const data = await res.json();
      if (Array.isArray(data)) setTrackedTokens(data);
    } catch (error) {
      console.error('Error fetching tracked:', error);
    }
  }, [address]);

  const trackToken = async (alert: any) => {
    try {
      const res = await fetch('/api/tracked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: address,
          tokenAddress: alert.token.address,
          symbol: alert.token.symbol,
          name: alert.token.name,
          entryPrice: alert.token.price || 0,
          entryLiquidity: alert.token.liquidity,
          chain: alert.chain,
        }),
      });
      if (res.ok) {
        fetchTracked();
        router.push('/portfolio');
      }
    } catch (error) {
      console.error('Error tracking token:', error);
    }
  };

  const fetchRules = useCallback(async () => {
    if (!address) {
       setRules([]);
       setLoading(false);
       return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`/api/rules?userId=${address}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const sorted = data.sort((a, b) => 
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
        setRules(sorted);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const [userStatus, setUserStatus] = useState<any>(null);

  const fetchUserStatus = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/user/status?address=${address}`);
      const data = await res.json();
      setUserStatus(data);
    } catch (error) {
      console.error('Error fetching user status:', error);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) {
      fetchRules();
      fetchAlerts();
      fetchGlobalAlerts();
      fetchTracked();
      fetchUserStatus();
      const interval = setInterval(() => {
        fetchAlerts();
        fetchGlobalAlerts();
        fetchUserStatus();
      }, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isConnected, fetchRules, fetchAlerts, fetchGlobalAlerts, fetchTracked, fetchUserStatus]);

  const isPro = userStatus?.tier === 'pro';
  const limit = isPro ? 50 : 3;

  const toggleRule = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setRules(rules.map(r => r._id === id ? { ...r, isActive: !currentStatus } : r));
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;
    try {
      const res = await fetch(`/api/rules/${ruleToDelete._id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(rules.filter(r => r._id !== ruleToDelete._id));
        setRuleToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-8">
        <div className="w-20 h-20 border border-[#1c1d24] flex items-center justify-center bg-[#08090d] text-mint animate-pulse">
           <Wallet size={32} />
        </div>
        <div className="space-y-2">
           <h2 className="text-xl font-bold uppercase tracking-[0.3em] text-white">Terminal_Disconnected</h2>
           <p className="text-[11px] font-mono text-[#4a4b52] max-w-xs mx-auto uppercase">
             Secure connection required to access on-chain automation nodes.
           </p>
        </div>
        <div className="pt-4">
           {/* Note: ConnectButton is already in layout, but we can put a prompt here */}
           <div className="text-[10px] font-mono text-mint/50 animate-bounce tracking-widest uppercase">
             Initialize Connection Above ^
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-10 gap-4 md:gap-0">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white uppercase">Rule Configurations</h2>
          <p className="text-[#4a4b52] text-[10px] md:text-[11px] font-mono max-w-xl leading-relaxed">
            Active automation logic for current vault bindings. Ensure constraints meet network gas requirements.
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="hidden lg:flex items-center gap-6 px-6 border-l border-r border-[#1c1d24] h-10">
            <div className="space-y-1">
              <div className="text-[8px] font-mono text-[#4a4b52] uppercase tracking-widest">Protocol_Status</div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-mint animate-pulse"></div>
                <span className="text-[10px] font-mono text-white">ORACLE_LINK_STABLE</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[8px] font-mono text-[#4a4b52] uppercase tracking-widest">Processing_Nodes</div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-mint"></div>
                <span className="text-[10px] font-mono text-white">CATALYST_ENGINE_V2</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="w-full md:w-auto bg-mint text-black px-4 py-2 md:py-1.5 flex items-center justify-center md:justify-start gap-2 font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition-all shadow-glow"
          >
            <Plus size={14} />
            Create_New_Rule
          </button>
        </div>
      </div>

      {/* Real-time System Terminal (Mini) */}
      <div className="mb-6 md:mb-10 bg-black border border-[#1c1d24] p-3 font-mono text-[9px] text-mint/40 overflow-hidden h-20 relative">
         <div className="absolute top-2 right-4 text-[7px] text-[#4a4b52] hidden xs:block">SYSTEM_OUTPUT</div>
         <div className="space-y-1">
            <div className="flex gap-4">
               <span className="text-[#4a4b52] whitespace-nowrap">[{new Date().toLocaleTimeString()}]</span>
               <span className="truncate">INITIATING SCAN: Birdeye_V2_Oracle...</span>
            </div>
            <div className="flex gap-4">
               <span className="text-[#4a4b52] whitespace-nowrap">[{new Date().toLocaleTimeString()}]</span>
               <span className="truncate">{rules.length} ACTIVE RULES DETECTED. FILTERING: {rules[0]?.chain.toUpperCase() || 'SOLANA'}...</span>
            </div>
            <div className="flex gap-4">
               <span className="text-[#4a4b52] whitespace-nowrap">[{new Date().toLocaleTimeString()}]</span>
               <span className="text-mint/60 animate-pulse truncate">WAITING_FOR_NETWORK_EVENT... STANDBY.</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Educational Intel Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#1c1d24] bg-[#08090d] mb-4">
          <div className="p-4 border-b md:border-b-0 md:border-r border-[#1c1d24]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-blue-500"></div>
              <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">01_TRIGGER_LAYER</h4>
            </div>
            <p className="text-[10px] font-mono text-[#4a4b52] leading-relaxed">
              The system scans Birdeye APIs in seconds, capturing new listings as they hit the market.
            </p>
          </div>
          <div className="p-4 border-b md:border-b-0 md:border-r border-[#1c1d24]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-amber"></div>
              <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">02_LOGIC_FILTER</h4>
            </div>
            <p className="text-[10px] font-mono text-[#4a4b52] leading-relaxed">
              Your constraints operate with "AND" logic. Only approved opportunities are dispatched.
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-mint"></div>
              <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">03_DISPATCH_NODE</h4>
            </div>
            <p className="text-[10px] font-mono text-[#4a4b52] leading-relaxed">
              Processed data is routed through Telegram, delivering alerts directly to your account.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="pixel-card h-[320px] animate-pulse bg-white/5 border-dashed"></div>
            ))
          ) : (
            <>
              {rules.map((rule) => (
                <div key={rule._id} className={`pixel-card min-h-[320px] group flex flex-col ${!rule.isActive && 'opacity-60'}`}>
                  {/* Card Header */}
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-2.5">
                      <Zap size={16} className="text-mint" />
                      <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-white">{rule.name}</span>
                    </div>
                    <div 
                      onClick={() => toggleRule(rule._id!, rule.isActive)}
                      className="w-8 h-4 bg-[#08090d] border border-[#1c1d24] relative cursor-pointer"
                    >
                      <div className={`absolute top-0.5 bottom-0.5 w-3 transition-all ${rule.isActive ? 'right-0.5 bg-mint' : 'left-0.5 bg-[#4a4b52]'}`}></div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="space-y-6 flex-1">
                    <div className="space-y-2 relative">
                        <div className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-[0.2em]">Trigger</div>
                        <div className="recessed-box uppercase text-white tracking-widest text-[11px]">{rule.triggerType}</div>
                        <div className="elbow-connector h-4"></div>
                    </div>
                    <div className="space-y-2 pt-2 relative">
                        <div className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-[0.2em] ml-8">Logic</div>
                        <div className="recessed-box ml-8 flex items-center justify-between text-[11px]">
                          <span className="text-amber uppercase tracking-widest">
                            {rule.conditions[0]?.field} {rule.conditions[0]?.operator} {rule.conditions[0]?.value}
                          </span>
                          <CheckCircle2 size={12} className="text-mint/40" />
                        </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-[#1c1d24] flex justify-between items-center text-[9px] font-mono text-[#4a4b52]">
                    <div className="flex items-center gap-2">
                      <span>Last Update</span>
                      <span className="text-white">{formatTimeAgo(rule.updatedAt)}</span>
                    </div>
                    <button onClick={() => setRuleToDelete(rule)} className="hover:text-red-500 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {rules.length < limit && Array(Math.min(limit - rules.length, 3)).fill(0).map((_, i) => (
                <div 
                  key={`empty-${i}`} 
                  onClick={() => setIsFormOpen(true)}
                  className="border border-[#1c1d24] border-dashed h-[320px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full border border-[#1c1d24] flex items-center justify-center text-[#1c1d24] group-hover:text-mint group-hover:border-mint transition-all">
                    <Plus size={24} />
                  </div>
                  <div className="text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest text-center">
                    Slot Available<br/>{rules.length + i + 1} / {limit}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* User Personal Alerts Feed */}
        <div className="mt-8 md:mt-12 space-y-4">
          <h3 className="text-[10px] font-bold text-white uppercase tracking-widest px-1">Node Execution History</h3>
          <div className="border border-[#1c1d24] bg-[#08090d] divide-y divide-[#1c1d24]">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div key={alert._id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 text-[10px] font-mono">
                <div className="flex items-center justify-between sm:justify-start gap-4">
                   <div className="flex items-center gap-4">
                      <span className="text-mint font-bold">{alert.token.symbol}</span>
                      <span className="text-[#4a4b52] hidden xs:inline">{alert.token.address.slice(0, 8)}...</span>
                   </div>
                   <span className="text-[#4a4b52] sm:hidden">{formatTimeAgo(alert.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-6">
                   <span className="text-white">${alert.token.liquidity.toLocaleString()}</span>
                   <div className="flex items-center gap-2 md:gap-4">
                      <button 
                        onClick={() => setSelectedSecurity(alert)}
                        className="text-[#4a4b52] hover:text-mint transition-colors p-1"
                      >
                        <Shield size={14} />
                      </button>
                      <button 
                        onClick={() => trackToken(alert)}
                        className="text-amber hover:text-white transition-colors border border-amber/20 px-2 py-1 rounded-sm bg-amber/5"
                      >
                        TRACK_ALPHA
                      </button>
                   </div>
                   <span className="text-[#4a4b52] hidden sm:inline">{formatTimeAgo(alert.createdAt)}</span>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-[#4a4b52] uppercase text-[9px]">No recent node triggers</div>
            )}
          </div>
        </div>
      </div>

      {selectedSecurity && (
        <SecurityModal 
          tokenName={selectedSecurity.token.name}
          tokenSymbol={selectedSecurity.token.symbol}
          data={{
            securityScore: selectedSecurity.security.securityScore,
            mintAuthority: selectedSecurity.security.mintAuthority,
            freezeAuthority: selectedSecurity.security.freezeAuthority,
            top10HolderPercent: selectedSecurity.security.top10HolderPercent,
            liquidity: selectedSecurity.token.liquidity
          }}
          onClose={() => setSelectedSecurity(null)}
        />
      )}

      {isFormOpen && (
        <RuleForm 
          userId={address!}
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            setIsFormOpen(false);
            fetchRules();
          }} 
        />
      )}



      {ruleToDelete && (
        <DeleteConfirmModal 
          ruleName={ruleToDelete.name}
          onClose={() => setRuleToDelete(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
