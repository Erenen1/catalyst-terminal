'use client';

import { useState } from 'react';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';

interface Props {
  isConnected: boolean;
}

export function TelegramConnectButton({ isConnected }: Props) {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      
      if (res.ok && data.link) {
        window.open(data.link, '_blank');
      } else {
        setError(data.error || 'Failed to generate link');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border border-[#1c1d24] bg-[#0c0d12] text-[#4a4b52] hover:text-mint hover:border-mint/50 transition-all cursor-default group" title="Telegram Connected">
        <CheckCircle2 size={12} className="text-mint" />
        <span className="text-[9px] font-mono tracking-widest uppercase">TG_Active</span>
      </div>
    );
  }

  return (
    <button 
      onClick={handleConnect}
      disabled={loading || !address}
      className="flex items-center gap-2 px-3 py-1.5 border border-[#1c1d24] hover:bg-[#1da1f2]/10 hover:border-[#1da1f2] hover:text-[#1da1f2] text-[#4a4b52] transition-all group disabled:opacity-50"
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin text-[#1da1f2]" />
      ) : (
        <Send size={12} className="group-hover:text-[#1da1f2] transition-all" />
      )}
      <span className="text-[9px] font-mono tracking-widest uppercase">
        {loading ? 'Pairing...' : 'Link_Telegram'}
      </span>
      {error && <span className="absolute -bottom-6 right-0 text-[8px] text-red-500 whitespace-nowrap">{error}</span>}
    </button>
  );
}
