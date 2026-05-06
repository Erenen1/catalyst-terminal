'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Activity, Shield, Droplets, Clock } from 'lucide-react';
import SecurityModal from '@/components/features/SecurityModal';

export default function TerminalPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSecurity, setSelectedSecurity] = useState<any | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchGlobalAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts?userId=GLOBAL`);
      const data = await res.json();
      if (Array.isArray(data)) setGlobalAlerts(data);
    } catch (err) {
      console.error('[Terminal] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const trackToken = async (alert: any) => {
    if (!address) return;
    setTrackingId(alert._id);
    try {
      // Fetch live price at the moment of tracking (BirdeyeToken has no price field)
      let entryPrice = 0;
      try {
        const priceRes = await fetch(`/api/tokens/price?address=${alert.token.address}&chain=${alert.chain}`);
        const priceData = await priceRes.json();
        if (priceData?.value != null) entryPrice = priceData.value;
      } catch {
        // price fetch failed — entry will be 0 but tracking still works
      }

      const res = await fetch('/api/tracked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: address,
          tokenAddress: alert.token.address,
          symbol: alert.token.symbol,
          name: alert.token.name,
          logoURI: alert.token.logoURI,
          entryPrice,
          entryLiquidity: alert.token.liquidity,
          chain: alert.chain,
        }),
      });
      if (res.ok) router.push('/portfolio');
    } catch (err) {
      console.error('[Terminal] Track error:', err);
    } finally {
      setTrackingId(null);
    }
  };


  const [userStatus, setUserStatus] = useState<any>(null);

  const fetchUserStatus = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/user/status?address=${address}`);
      const data = await res.json();
      setUserStatus(data);
    } catch (err) {
      console.error('[Terminal] Status error:', err);
    }
  }, [address]);

  useEffect(() => {
    fetchGlobalAlerts();
    fetchUserStatus();
    const interval = setInterval(fetchGlobalAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchGlobalAlerts, fetchUserStatus]);

  const pollingInterval = userStatus?.settings?.pollingPro && userStatus?.tier === 'pro' 
    ? userStatus.settings.pollingPro 
    : userStatus?.settings?.pollingFree || '4h';

  const formatTimeAgo = (date: any) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  const scoreColor = (s: number) =>
    s > 70 ? 'text-mint' : s > 40 ? 'text-amber' : 'text-red-500';

  const triggerLabel: Record<string, string> = {
    new_listing:         'New Listing',
    trending_entry:      'Trending Entry',
    whale_radar:         'Whale Movement',
    liquidity_drain:     'Liquidity Drain',
    volatility_breakout: 'Volatility Breakout',
    pump_fun_migration:  'Pump.fun Migration',
  };

  return (
    <div className="space-y-6 md:space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#1c1d24] pb-6 gap-4">
        <div className="space-y-1">
          <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-tighter">Alpha Terminal</h3>
          <p className="text-[11px] font-mono text-[#4a4b52] max-w-lg leading-relaxed">
            Aggregated real-time signals from all active Catalyst Nodes across the network.
            Each row represents a token opportunity triggered by your deployed rules.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-mint bg-mint/5 px-3 py-1.5 border border-mint/10">
          <div className="w-1.5 h-1.5 bg-mint animate-pulse rounded-full" />
          LIVE · {globalAlerts.length} SIGNALS · Refreshes every {pollingInterval}
        </div>
      </div>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            icon: <Activity size={14} className="text-mint" />,
            title: 'What is a Signal?',
            desc: "When your deployed rules match a token on-chain, it appears here. Every signal is backed by live market data — no simulations.",
          },
          {
            icon: <Droplets size={14} className="text-blue-400" />,
            title: 'Liquidity',
            desc: 'Total USD value locked in the token\'s trading pool. Higher liquidity means easier trades and less price slippage.',
          },
          {
            icon: <Shield size={14} className="text-amber" />,
            title: 'Safety Score',
            desc: "Birdeye's 0–100 security rating. Factors in mint/freeze authority, holder concentration, and other on-chain risk signals.",
          },
        ].map((card) => (
          <div key={card.title} className="flex gap-3 p-3 bg-[#08090d] border border-[#1c1d24]">
            <div className="mt-0.5 shrink-0">{card.icon}</div>
            <div>
              <div className="text-[9px] font-bold text-white uppercase tracking-wide mb-1">{card.title}</div>
              <p className="text-[9px] font-mono text-[#4a4b52] leading-relaxed">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Signal List ── */}
      <div className="border border-[#1c1d24] bg-[#08090d] divide-y divide-[#1c1d24]">
        {loading ? (
          <div className="p-20 text-center animate-pulse text-[#4a4b52] font-mono uppercase text-[10px]">
            Syncing Oracles...
          </div>
        ) : globalAlerts.length > 0 ? (
          globalAlerts.map((alert) => {
            const score       = alert.security?.securityScore ?? 0;
            const isMintRisk  = alert.security?.mintAuthority;
            const isFreezeRisk = alert.security?.freezeAuthority;

            const catalystScore = alert.security?.catalystScore;
            const aiPrediction = alert.security?.aiPrediction;
            const technicalTrace = alert.security?.technicalTrace || [];
            const isExpanded = expandedId === alert._id;

            return (
              <div key={alert._id} className="border-b border-[#1c1d24] last:border-b-0">
              <div
                onClick={() => setExpandedId(isExpanded ? null : alert._id)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-white/[0.02] transition-all border-l-2 border-transparent hover:border-mint gap-4 sm:gap-0 cursor-pointer"
              >
                {/* Left: Token Info */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 border border-[#1c1d24] flex items-center justify-center bg-[#0c0d12] text-mint font-bold text-sm shrink-0 overflow-hidden">
                    {alert.token.logoURI ? (
                      <img src={alert.token.logoURI} alt={alert.token.symbol} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      (alert.token.symbol || '?')[0]
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-bold text-white uppercase tracking-wide">{alert.token.name}</span>
                      <span className="text-[9px] font-mono text-[#4a4b52]">({alert.token.symbol})</span>
                      {isMintRisk && (
                        <span className="text-[7px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 uppercase">
                          Mint Risk
                        </span>
                      )}
                      {isFreezeRisk && (
                        <span className="text-[7px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 uppercase">
                          Freeze Risk
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-mono text-[#4a4b52] flex items-center gap-2 flex-wrap">
                      <span>Triggered by: <span className="text-amber">NODE_{alert.ruleId?.slice(-4) ?? '????'}</span></span>
                      <span className="text-[#2a2b32]">·</span>
                      <span className="text-mint">{alert.chain?.toUpperCase()}</span>
                      <span className="text-[#2a2b32]">·</span>
                      <span className="text-[#4a4b52]">{triggerLabel[alert.triggerType] ?? alert.triggerType ?? 'Signal'}</span>
                    </div>
                    {/* INLINE BADGES */}
                    <div className="flex gap-2 mt-2">
                      {catalystScore !== undefined && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${catalystScore >= 80 ? 'border-mint/50 text-mint bg-mint/5' : catalystScore >= 50 ? 'border-amber/50 text-amber bg-amber/5' : 'border-red-500/50 text-red-500 bg-red-500/5'}`}>
                          [ SCORE: {catalystScore}/100 ]
                        </span>
                      )}
                      {aiPrediction && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${aiPrediction === 'BULLISH' ? 'border-mint/50 text-mint bg-mint/5' : aiPrediction === 'HIGH_RISK' || aiPrediction === 'BEARISH' ? 'border-red-500/50 text-red-500 bg-red-500/5' : 'border-[#4a4b52] text-[#a4a5ab] bg-white/5'}`}>
                          [ AI: {aiPrediction} ]
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Metrics + Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-8 text-right ml-14 sm:ml-0">
                  {/* Liquidity */}
                  <div className="space-y-0.5">
                    <div className="text-[7px] font-mono text-[#4a4b52] uppercase flex items-center gap-1 justify-end">
                      <Droplets size={9} /> Liquidity
                    </div>
                    <div className="text-[10px] font-mono text-white">
                      ${alert.token.liquidity?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '—'}
                    </div>
                    <div className="text-[7px] font-mono text-[#4a4b52]">
                      {alert.token.liquidity > 100000 ? 'High' : alert.token.liquidity > 10000 ? 'Medium' : 'Low'} liquidity
                    </div>
                  </div>

                  {/* Safety Score */}
                  <div className="space-y-0.5 hidden xs:block">
                    <div className="text-[7px] font-mono text-[#4a4b52] uppercase flex items-center gap-1 justify-end">
                      <Shield size={9} /> Safety
                    </div>
                    <div className={`text-[10px] font-mono font-bold ${scoreColor(score)}`}>
                      {score}/100
                    </div>
                    <div className={`text-[7px] font-mono ${scoreColor(score)}`}>
                      {score > 70 ? 'Low risk' : score > 40 ? 'Medium risk' : 'High risk'}
                    </div>
                  </div>

                  {/* Detected */}
                  <div className="space-y-0.5">
                    <div className="text-[7px] font-mono text-[#4a4b52] uppercase flex items-center gap-1 justify-end">
                      <Clock size={9} /> Detected
                    </div>
                    <div className="text-[10px] font-mono text-[#a4a5ab]">{formatTimeAgo(alert.createdAt)}</div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedSecurity(alert); }}
                      className="p-2 border border-[#1c1d24] text-[#4a4b52] hover:text-mint hover:border-mint transition-all"
                      title="Safety Radar"
                    >
                      <Shield size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); trackToken(alert); }}
                      disabled={trackingId === alert._id}
                      className="px-4 py-2 border border-[#1c1d24] text-[9px] font-mono font-bold text-amber hover:bg-amber hover:text-black transition-all uppercase tracking-widest disabled:opacity-50"
                    >
                      {trackingId === alert._id ? '...' : 'TRACK'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Expandable Trace Panel */}
              {isExpanded && (
                <div className="bg-[#040508] border-t border-[#1c1d24] p-4 ml-14 sm:ml-16 font-mono text-[9px] text-[#849587]">
                  <div className="mb-2 text-white font-bold tracking-widest uppercase">CATALYST AI_ENGINE // TRACE</div>
                  <ul className="space-y-1.5">
                    {technicalTrace && technicalTrace.length > 0 ? (
                      technicalTrace.map((trace: string, idx: number) => {
                        let icon = '[·]';
                        if (trace.toLowerCase().includes('positive') || trace.toLowerCase().includes('bullish')) icon = '[🟢]';
                        else if (trace.toLowerCase().includes('risk') || trace.toLowerCase().includes('penalty')) icon = '[🔴]';
                        else if (trace.toLowerCase().includes('multiplier') || trace.toLowerCase().includes('safe')) icon = '[🛡️]';
                        else if (trace.toLowerCase().includes('ai')) icon = '[🧠]';
                        
                        return (
                          <li key={idx} className="flex gap-2">
                            <span className="shrink-0">{icon}</span>
                            <span>{trace}</span>
                          </li>
                        );
                      })
                    ) : (
                      <li className="flex gap-2 text-[#4a4b52]">
                        <span className="shrink-0">[!]</span>
                        <span>No AI trace data available for this signal.</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
              </div>
            );
          })
        ) : (
          <div className="p-20 text-center space-y-4">
            <Activity size={32} className="mx-auto text-[#1c1d24] animate-pulse" />
            <p className="text-[10px] font-mono text-[#4a4b52] uppercase tracking-[0.2em]">
              Active nodes scanning the network. New signals will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Security Modal */}
      {selectedSecurity && (
        <SecurityModal
          tokenName={selectedSecurity.token.name}
          tokenSymbol={selectedSecurity.token.symbol}
          data={{
            securityScore:     selectedSecurity.security?.securityScore ?? 0,
            mintAuthority:     selectedSecurity.security?.noMintAuthority === false || selectedSecurity.security?.mintAuthority,
            freezeAuthority:   selectedSecurity.security?.noFreezeAuthority === false || selectedSecurity.security?.freezeAuthority,
            top10HolderPercent: selectedSecurity.security?.top10HolderPercent ?? 0,
            liquidity:         selectedSecurity.token?.liquidity ?? 0,
          }}
          onClose={() => setSelectedSecurity(null)}
        />
      )}
    </div>
  );
}
