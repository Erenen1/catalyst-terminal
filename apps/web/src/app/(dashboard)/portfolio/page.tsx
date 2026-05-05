'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { TrendingUp, TrendingDown, DollarSign, Info, BarChart2, Trash2 } from 'lucide-react';

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [trackedTokens, setTrackedTokens] = useState<any[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchTracked = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/tracked?userId=${address}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTrackedTokens(data);
        // Fetch live prices and missing logos for all tracked tokens
        await Promise.allSettled(
          data.map(async (token) => {
            // Price fetch
            const pRes = await fetch(`/api/tokens/price?address=${token.tokenAddress}&chain=${token.chain}`);
            const pData = await pRes.json();
            if (pData?.value != null) {
              setCurrentPrices((prev) => ({ ...prev, [token.tokenAddress]: pData.value }));
            }

            // Fallback: If logo is missing, fetch it
            if (!token.logoURI) {
              const mRes = await fetch(`/api/tokens/metadata?address=${token.tokenAddress}&chain=${token.chain}`);
              const mData = await mRes.json();
              if (mData?.logoURI) {
                setTrackedTokens(prev => prev.map(t => 
                  t._id === token._id ? { ...t, logoURI: mData.logoURI } : t
                ));
              }
            }
          })
        );
      }
    } catch (err) {
      console.error('[Portfolio] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const deleteTracked = async (id: string) => {
    try {
      const res = await fetch(`/api/tracked?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Optimistically remove from state
        setTrackedTokens((prev) => prev.filter((t) => t._id !== id));
        setCurrentPrices((prev) => {
          const next = { ...prev };
          const token = trackedTokens.find((t) => t._id === id);
          if (token) delete next[token.tokenAddress];
          return next;
        });
      }
    } catch (err) {
      console.error('[Portfolio] Delete error:', err);
    }
  };

  useEffect(() => {
    if (isConnected) fetchTracked();
  }, [isConnected, fetchTracked]);

  // ── Real calculations ────────────────────────────────────────────────────────

  const calcPnL = (entry: number, current: number) => {
    if (!entry || !current || entry === 0) return 0;
    return ((current - entry) / entry) * 100;
  };

  const pnlValues = trackedTokens.map((t) =>
    calcPnL(t.entryPrice, currentPrices[t.tokenAddress] ?? t.entryPrice)
  );

  const avgPnL      = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length : 0;
  const winningCount = pnlValues.filter((v) => v > 0).length;
  const losingCount  = pnlValues.filter((v) => v < 0).length;
  const winRate      = pnlValues.length > 0 ? (winningCount / pnlValues.length) * 100 : 0;
  const highestROI   = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
  const lowestROI    = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

  const pnlColor = (v: number) => (v >= 0 ? 'text-mint' : 'text-red-500');

  return (
    <div className="space-y-8 md:space-y-12">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1c1d24] pb-8">
        <div className="space-y-1">
          <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-tighter">Performance Monitor</h3>
          <p className="text-[11px] font-mono text-[#4a4b52] max-w-lg leading-relaxed">
            Simulated PnL tracking for detected alpha opportunities. Entry price is captured at detection time;
            current price is pulled live from Birdeye Oracle.
          </p>
        </div>
        {/* Avg PnL */}
        <div className="flex items-center justify-between md:justify-end gap-6 border md:border-none border-[#1c1d24] p-4 md:p-0 bg-[#08090d] md:bg-transparent">
          <div className="text-left md:text-right">
            <div className="text-[8px] font-mono text-[#4a4b52] uppercase tracking-widest mb-0.5">Avg_PnL</div>
            <div className={`text-xl md:text-2xl font-bold font-mono ${pnlColor(avgPnL)}`}>
              {avgPnL >= 0 ? '+' : ''}{avgPnL.toFixed(2)}%
            </div>
            <div className="text-[7px] font-mono text-[#4a4b52] mt-0.5">Across all tracked positions</div>
          </div>
          <div className={`w-10 h-10 md:w-12 md:h-12 border border-[#1c1d24] flex items-center justify-center ${avgPnL >= 0 ? 'text-mint bg-mint/5' : 'text-red-500 bg-red-500/5'}`}>
            {avgPnL >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Positions Table ── */}
        <div className="lg:col-span-3">
          <div className="md:border border-[#1c1d24] md:bg-[#08090d] overflow-hidden">

            {/* Desktop */}
            <table className="hidden md:table w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0c0d12] border-b border-[#1c1d24]">
                  <th className="p-5 text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">Asset</th>
                  <th className="p-5 text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">
                    Entry Price
                    <span className="ml-1 text-[7px] normal-case text-[#2a2b32]">at detection time</span>
                  </th>
                  <th className="p-5 text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest">
                    Current Price
                    <span className="ml-1 text-[7px] normal-case text-[#2a2b32]">Birdeye Oracle</span>
                  </th>
                  <th className="p-5 text-[9px] font-mono text-[#4a4b52] uppercase tracking-widest text-right">
                    PnL
                    <span className="ml-1 text-[7px] normal-case text-[#2a2b32]">simulated</span>
                  </th>
                  <th className="p-5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c1d24]">
                {loading ? (
                  <tr><td colSpan={4} className="p-20 text-center animate-pulse text-[#4a4b52] font-mono text-[10px]">Loading_Positions...</td></tr>
                ) : trackedTokens.length > 0 ? (
                  trackedTokens.map((token) => {
                    const current  = currentPrices[token.tokenAddress] ?? token.entryPrice;
                    const pnl      = calcPnL(token.entryPrice, current);
                    const hasPrice = currentPrices[token.tokenAddress] != null;
                    return (
                      <tr key={token._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-black border border-[#1c1d24] flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden">
                              {token.logoURI ? (
                                <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
                              ) : (
                                (token.symbol || '?')[0]
                              )}
                            </div>
                            <div>
                              <div className="text-[12px] font-bold text-white uppercase">{token.name}</div>
                              <div className="text-[8px] font-mono text-[#4a4b52] uppercase">{token.symbol} · {token.chain?.toUpperCase()}</div>
                              <div className="text-[7px] font-mono text-[#2a2b32] mt-0.5">
                                Detected: {new Date(token.createdAt).toLocaleDateString('en-US')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="text-[10px] font-mono text-[#a4a5ab]">
                            {token.entryPrice > 0 ? `$${token.entryPrice.toFixed(8)}` : '—'}
                          </div>
                          {token.entryPrice === 0 && (
                            <div className="text-[7px] font-mono text-[#4a4b52] mt-0.5">No price at detection</div>
                          )}
                        </td>
                        <td className="p-5">
                          <div className="text-[10px] font-mono text-white">
                            {current > 0 ? `$${current.toFixed(8)}` : '—'}
                          </div>
                          <div className="text-[7px] font-mono text-[#4a4b52] mt-0.5">
                            {hasPrice ? 'Live' : 'Fetching...'}
                          </div>
                        </td>
                        <td className="p-5 text-right">
                          <div className={`text-[11px] font-mono font-bold ${pnlColor(pnl)}`}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                          </div>
                          {!hasPrice && (
                            <div className="text-[7px] font-mono text-[#4a4b52]">Awaiting price</div>
                          )}
                        </td>
                        <td className="p-5">
                          <button
                            onClick={() => deleteTracked(token._id)}
                            className="p-1.5 text-[#4a4b52] hover:text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                            title="Untrack"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-[#4a4b52] uppercase text-[9px] font-mono tracking-widest">
                      No positions tracked yet. Go to the Terminal and hit TRACK on a signal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {loading ? (
                <div className="p-10 text-center animate-pulse text-[#4a4b52] font-mono text-[10px]">Loading...</div>
              ) : trackedTokens.length > 0 ? (
                trackedTokens.map((token) => {
                  const current = currentPrices[token.tokenAddress] ?? token.entryPrice;
                  const pnl     = calcPnL(token.entryPrice, current);
                  return (
                    <div key={token._id} className="bg-[#08090d] border border-[#1c1d24] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-black border border-[#1c1d24] flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                            {token.logoURI ? (
                              <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
                            ) : (
                              (token.symbol || '?')[0]
                            )}
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-white uppercase">{token.name}</div>
                            <div className="text-[8px] font-mono text-[#4a4b52] uppercase">{token.symbol} · {token.chain?.toUpperCase()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`text-[13px] font-mono font-bold ${pnlColor(pnl)}`}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                          </div>
                          <button
                            onClick={() => deleteTracked(token._id)}
                            className="p-1.5 text-[#4a4b52] hover:text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                            title="Untrack"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1c1d24]">
                        <div>
                          <div className="text-[7px] font-mono text-[#4a4b52] uppercase mb-1">Entry Price</div>
                          <div className="text-[10px] font-mono text-[#a4a5ab]">{token.entryPrice > 0 ? `$${token.entryPrice.toFixed(8)}` : '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[7px] font-mono text-[#4a4b52] uppercase mb-1">Current Price</div>
                          <div className="text-[10px] font-mono text-white">{current > 0 ? `$${current.toFixed(8)}` : '—'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-[#4a4b52] uppercase text-[9px] font-mono border border-[#1c1d24] border-dashed">
                  No positions tracked yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Side Panel ── */}
        <div className="space-y-4">

          {/* Real stats */}
          <div className="bg-[#08090d] border border-[#1c1d24] p-5 space-y-4">
            <h4 className="text-[9px] font-bold text-white uppercase tracking-[0.2em] border-b border-[#1c1d24] pb-3 flex items-center gap-2">
              <BarChart2 size={12} className="text-mint" /> Session_Stats
            </h4>
            <div className="space-y-3">
              {[
                {
                  label: 'Total_Tracked',
                  sub: 'Positions monitored',
                  value: trackedTokens.length.toString(),
                  color: 'text-white',
                },
                {
                  label: 'Win_Rate',
                  sub: `${winningCount}W / ${losingCount}L`,
                  value: `${winRate.toFixed(0)}%`,
                  color: winRate >= 50 ? 'text-mint' : 'text-red-500',
                },
                {
                  label: 'Highest_ROI',
                  sub: 'Best performing position',
                  value: `${highestROI >= 0 ? '+' : ''}${highestROI.toFixed(2)}%`,
                  color: pnlColor(highestROI),
                },
                {
                  label: 'Lowest_ROI',
                  sub: 'Worst performing position',
                  value: `${lowestROI >= 0 ? '+' : ''}${lowestROI.toFixed(2)}%`,
                  color: pnlColor(lowestROI),
                },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[8px] font-mono text-[#4a4b52] uppercase">{stat.label}</div>
                    <div className="text-[7px] font-mono text-[#2a2b32]">{stat.sub}</div>
                  </div>
                  <span className={`text-[11px] font-mono font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-mint/5 border border-mint/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign size={13} className="text-mint" />
              <h4 className="text-[9px] font-bold text-mint uppercase tracking-[0.2em]">How It Works</h4>
            </div>
            <div className="space-y-2 text-[8px] font-mono text-[#a4a5ab] leading-relaxed">
              <p><span className="text-white">Entry Price:</span> The market price at the moment you clicked TRACK in the Terminal.</p>
              <p><span className="text-white">Current Price:</span> Live price fetched from Birdeye Oracle.</p>
              <p><span className="text-white">PnL:</span> Percentage difference between entry and current. This is a simulation — no real trades are executed.</p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="border border-[#1c1d24] p-4 flex gap-2">
            <Info size={12} className="text-[#4a4b52] shrink-0 mt-0.5" />
            <p className="text-[7px] font-mono text-[#4a4b52] leading-relaxed">
              All PnL values are simulated for performance tracking only. This is not financial advice. Always do your own research (DYOR).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
