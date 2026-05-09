export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { UserModel } from '@chaintrigger/shared';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  // 1. CPU-Efficient Validation (Linear Regex, No Backtracking)
  if (!address || !/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  try {
    await dbConnect();

    const refCode = searchParams.get('ref')?.substring(0, 12).replace(/[^a-zA-Z0-9]/g, '');
    let user = await UserModel.findOne({ walletAddress: address.toLowerCase() });
    
    if (!user) {
      // Generate unique referral code for NEW user
      const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      user = await UserModel.create({
        walletAddress: address.toLowerCase(),
        tier: 'free',
        activeRuleCount: 0,
        referralCode: myRefCode,
        referredBy: refCode || undefined
      });
    } else if (!user.referralCode) {
      // Generate unique referral code for EXISTING (legacy) user
      const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      user.referralCode = myRefCode;
      await user.save();
    }

    const formatMs = (ms: number) => {
      const hours = ms / 3600000;
      if (hours >= 1) return `${Math.round(hours)}h`;
      const mins = ms / 60000;
      return `${Math.round(mins)}m`;
    };

    return NextResponse.json({
      isConnected: !!user.telegramChatId,
      telegramUsername: user.telegramUsername,
      telegramChatId: user.telegramChatId,
      tier: user.tier,
      proUntil: user.proUntil,
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      settings: {
        pollingPro: formatMs(Number(process.env.POLLING_INTERVAL_PRO_MS) || 3600000),
        pollingFree: formatMs(Number(process.env.POLLING_INTERVAL_FREE_MS) || 14400000),
      }
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
