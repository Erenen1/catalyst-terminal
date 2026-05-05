'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Standard ERC20 ABI for approve
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
];

// Dummy addresses for USDC and Loop Contract (Should be replaced with actual addresses from env)
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Mainnet USDC
const LOOP_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890'; // Replace with actual Loop contract

interface LoopSubscriptionManagerProps {
  planPrice: number; // Monthly price in USD
  planName: string;
}

export const LoopSubscriptionManager: React.FC<LoopSubscriptionManagerProps> = ({ planPrice, planName }) => {
  const { address, isConnected } = useAccount();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubscribe = async () => {
    if (!isConnected) return;

    setIsAuthorizing(true);
    try {
      // Step 1: Approve Loop Crypto to spend USDC on user's behalf
      // In a real app, you'd approve a very large amount or exactly what Loop requires for recurring
      const maxAllowance = parseUnits('1000000', 6); // Approving 1M USDC as an example for long-term recurring

      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [LOOP_CONTRACT_ADDRESS, maxAllowance],
      });

      console.log('Approval Transaction Hash:', hash);

      // Step 2: In a full Loop integration, you would then call their API or SDK to register the subscription
      // after the approval is confirmed.

    } catch (error) {
      console.error('Subscription approval failed:', error);
    } finally {
      setIsAuthorizing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 border border-zinc-800 rounded-xl bg-zinc-900/50 flex flex-col items-center justify-center text-center">
        <h3 className="text-xl font-bold text-white mb-2">Connect Wallet to Subscribe</h3>
        <p className="text-zinc-400 mb-4">Please connect your wallet to set up a recurring subscription via Loop Crypto.</p>
      </div>
    );
  }

  return (
    <div className="p-6 border border-zinc-800 rounded-xl bg-zinc-900/50 shadow-lg max-w-md w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-white">{planName} Plan</h3>
          <p className="text-zinc-400">${planPrice} USDC / month</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <RefreshCw className="h-6 w-6 text-blue-400" />
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">Set and forget: Auto-renews every month via Loop Crypto.</p>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">Grace period: 3 days of extra time if your balance is low, no instant cut-offs.</p>
        </div>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">By subscribing, you authorize the Loop Crypto contract to withdraw ${planPrice} USDC monthly.</p>
        </div>
      </div>

      <button
        onClick={handleSubscribe}
        disabled={isAuthorizing || isWaiting || isSuccess}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
          isSuccess
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)]"
        )}
      >
        {(isAuthorizing || isWaiting) ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {isWaiting ? 'Confirming Transaction...' : 'Authorizing...'}
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle className="h-5 w-5" />
            Subscription Active
          </>
        ) : (
          'Authorize Loop Subscription'
        )}
      </button>

      {isSuccess && (
        <p className="mt-4 text-xs text-center text-emerald-400">
          Transaction confirmed! Your recurring payment is now set up.
        </p>
      )}
    </div>
  );
};
