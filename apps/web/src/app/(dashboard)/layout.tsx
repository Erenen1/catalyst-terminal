'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Bell, LayoutDashboard, Zap, Database, Terminal, FileText, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { WalletConnect } from '@/components/features/WalletConnect';
import { TelegramConnectButton } from '@/components/features/TelegramConnectButton';
import { useAccount } from 'wagmi';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { address, isConnected, isConnecting } = useAccount();
  const router = useRouter();
  const [ruleCount, setRuleCount] = useState(0);
  const [userStatus, setUserStatus] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch functions
  const fetchCount = useCallback(async () => {
    if (!address) {
      setRuleCount(0);
      return;
    }
    try {
      const res = await fetch(`/api/rules?userId=${address}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRuleCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching rule count:', error);
    }
  }, [address]);

  const fetchUserStatus = useCallback(async () => {
    if (!address) return;
    try {
      const storedRef = typeof window !== 'undefined' ? localStorage.getItem('referral_code') : null;
      const url = `/api/user/status?address=${address}${storedRef ? `&ref=${storedRef}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setUserStatus(data);
    } catch (error) {
      console.error('Error fetching user status:', error);
    }
  }, [address]);

  // Dashboard protection
  useEffect(() => {
    if (isMounted && !isConnecting && !isConnected) {
      router.replace('/');
    }
  }, [isConnected, isConnecting, isMounted, router]);

  useEffect(() => {
    if (isConnected) {
      fetchCount();
      fetchUserStatus();
      const interval = setInterval(() => {
        fetchCount();
        fetchUserStatus();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchCount, fetchUserStatus, isConnected]);

  // Loading state
  if (!isMounted || isConnecting || !isConnected) {
    return (
      <div className="h-screen w-screen bg-[#08090d] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-mint border-t-transparent animate-spin"></div>
          <div className="text-mint text-[10px] tracking-[0.3em] uppercase animate-pulse">
            Authenticating_Session...
          </div>
        </div>
      </div>
    );
  }

  const isPro = userStatus?.tier === 'pro';
  const limit = isPro ? 50 : 3;
  const usagePercent = Math.min((ruleCount / limit) * 100, 100);

  const navLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Nodes' },
    { href: '/terminal', icon: Zap, label: 'Terminal' },
    { href: '/blueprint', icon: Database, label: 'Blueprint' },
    { href: '/portfolio', icon: Terminal, label: 'Alpha' },
    { href: '/upgrade', icon: FileText, label: 'Upgrade', isProFeature: true },
    { href: '/academy', icon: HelpCircle, label: 'Academy' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-on-surface overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-14 flex-col items-center py-5 border-r border-[#1c1d24] bg-[#08090d]">
        <Link href="/" className="mb-8 text-mint">
           <div className="w-6 h-6 grid grid-cols-2 gap-0.5 p-0.5 border border-mint/20">
              <div className="bg-mint/40 w-full h-full"></div>
              <div className="bg-mint w-full h-full"></div>
              <div className="bg-mint w-full h-full"></div>
              <div className="bg-mint/40 w-full h-full"></div>
           </div>
        </Link>
        
        <nav className="flex flex-col gap-6 flex-1">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className={`w-10 h-10 flex items-center justify-center transition-all relative group ${pathname === link.href ? 'bg-mint text-black shadow-glow' : 'text-[#4a4b52] hover:text-white'}`}
            >
              <link.icon size={18} />
              {pathname === link.href && <div className="absolute -right-[15px] w-1 h-4 bg-mint"></div>}
              {link.isProFeature && isPro && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber rounded-full shadow-glow"></div>
              )}
              <div className="absolute inset-0 border border-mint/0 group-hover:border-mint/10 transition-all"></div>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <header className="h-14 md:h-16 border-b border-[#1c1d24] flex items-center px-4 md:px-8 justify-between bg-[#08090d] z-20">
          <div className="flex items-center gap-2 md:gap-2.5">
            <div className="w-4 h-4 md:w-5 md:h-5 bg-mint rotate-45 flex items-center justify-center">
               <div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-black -rotate-45"></div>
            </div>
            <h1 className="text-xs md:text-sm font-bold tracking-[0.1em] md:tracking-[0.2em] text-mint uppercase">Catalyst</h1>
            {isPro && (
              <span className="ml-2 px-2 py-0.5 bg-amber/10 border border-amber/30 text-amber text-[8px] font-bold uppercase tracking-widest">PRO</span>
            )}
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden sm:flex items-center gap-3">
               <span className="text-[9px] font-mono text-[#4a4b52] tracking-widest uppercase">Nodes:</span>
               <span className="text-[9px] font-mono text-white">{ruleCount}/{limit}</span>
               <div className="progress-bar-container w-16 md:w-24">
                  <div className="progress-bar-fill" style={{ width: `${usagePercent}%` }}></div>
               </div>
            </div>

            <div className="flex items-center gap-3 text-[#4a4b52]">
              <Settings size={14} className="hover:text-white cursor-pointer hidden xs:block" />
              <Bell size={14} className="hover:text-white cursor-pointer" />
            </div>

            <div className="flex items-center gap-2">
               {isConnected && <TelegramConnectButton isConnected={!!userStatus?.telegramChatId} />}
               <WalletConnect />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-4 md:p-10">
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#08090d] border-t border-[#1c1d24] flex items-center justify-around px-2 z-30">
        {navLinks.map((link) => (
          <Link 
            key={link.href}
            href={link.href} 
            className={`flex flex-col items-center gap-1 ${pathname === link.href ? 'text-mint' : 'text-[#4a4b52]'}`}
          >
            <link.icon size={20} />
            <span className="text-[8px] font-mono uppercase tracking-tighter">{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>

  );
}
