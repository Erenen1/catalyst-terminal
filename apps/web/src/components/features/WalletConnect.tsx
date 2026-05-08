'use client';
 
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useConnect } from 'wagmi';

export function WalletConnect() {
  const { connectors } = useConnect();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        const handleConnect = () => {
          // Check if any injected connector (extension) is available
          const hasExtension = connectors.some(c => c.type === 'injected' || c.id === 'metaMask' || c.id === 'phantom');
          
          // Also check window object for common extensions as a fallback
          const hasInjected = typeof window !== 'undefined' && (
            (window as any).ethereum || 
            (window as any).phantom || 
            (window as any).solana
          );

          if (!hasExtension && !hasInjected) {
            alert('🚫 No wallet extension detected! Please install MetaMask or Phantom to continue.');
            return;
          }
          openConnectModal();
        };
        
        if (!ready) {
          return (
            <div
              aria-hidden={true}
              style={{
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              <button className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest text-[#4a4b52] border border-[#1c1d24]">
                Loading...
              </button>
            </div>
          );
        }

        if (!connected) {
          return (
            <button onClick={handleConnect} className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest text-[#4a4b52] border border-[#1c1d24] hover:text-white hover:border-mint/50 transition-all">
              Connect_Wallet
            </button>
          );
        }

        return (
          <div className="flex gap-3">
            <button
              onClick={openChainModal}
              className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-mint border border-mint/20 hover:bg-mint/10 transition-all flex items-center gap-1.5"
            >
              {chain.hasIcon && chain.iconUrl && (
                <img
                  alt={chain.name ?? 'Chain icon'}
                  src={chain.iconUrl}
                  style={{ width: 12, height: 12 }}
                />
              )}
              {chain.name}
            </button>
            <button onClick={openAccountModal} className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-white border border-mint/40 hover:bg-mint/5 transition-all">
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
