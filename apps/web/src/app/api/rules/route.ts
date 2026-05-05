import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { RuleModel, UserModel, FREE_TIER_RULE_LIMIT } from '@chaintrigger/shared';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')?.toLowerCase();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const rules = await RuleModel.find({ userId }).sort({ createdAt: -1 });
    return NextResponse.json(rules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    const { userId, name, triggerType, conditions, action, chain } = body;

    // 1. Input Validation & Sanitization (Injection Prevention)
    if (!userId || !/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(userId)) {
      return NextResponse.json({ error: 'Invalid or missing wallet address' }, { status: 400 });
    }

    if (!name || name.length > 50) {
      return NextResponse.json({ error: 'Name is required and must be under 50 chars' }, { status: 400 });
    }

    if (!['new_listing', 'trending_entry', 'pump_fun_migration', 'whale_radar'].includes(triggerType)) {
      return NextResponse.json({ error: 'Invalid trigger type' }, { status: 400 });
    }

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return NextResponse.json({ error: 'At least one condition is required' }, { status: 400 });
    }

    // 2. Authorization Check (Broken Access Control Prevention)
    // [SECURITY NOTE] In production, verify that 'userId' matches the authenticated session wallet.
    // const session = await getServerSession();
    // if (session.user.address !== userId) return forbidden;

    // 3. Check User Tier & Limits
    const user = await UserModel.findOne({ walletAddress: userId.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentCount = await RuleModel.countDocuments({ 
      userId: userId.toLowerCase(), 
      isActive: true 
    });
    const limit = user.tier === 'pro' ? 50 : FREE_TIER_RULE_LIMIT;

    if (currentCount >= limit) {
      return NextResponse.json({ 
        error: `Limit reached. ${user.tier.toUpperCase()} users are limited to ${limit} active nodes. Upgrade to PRO for more.` 
      }, { status: 403 });
    }

    const newRule = await RuleModel.create({
      name: name.trim(),
      triggerType,
      conditions,
      action,
      chain: chain || 'solana',
      userId: userId.toLowerCase(),
      isActive: true,
    });

    // 4. Referral Reward Logic (Trigger on first node deployment + Telegram linked)
    const ruleCount = await RuleModel.countDocuments({ userId: userId.toLowerCase() });
    
    // Safety Check: Has this Telegram account ever claimed a reward before?
    const isTelegramUsed = await UserModel.findOne({ 
      telegramChatId: user.telegramChatId, 
      isReferralRewardClaimed: true 
    });

    if (ruleCount >= 1 && user.referredBy && user.telegramChatId && !user.isReferralRewardClaimed && !isTelegramUsed) {
      const rewardDays = 7;
      const rewardMs = rewardDays * 24 * 60 * 60 * 1000;
      
      // Update Referrer
      const referrer = await UserModel.findOne({ referralCode: user.referredBy });
      if (referrer) {
        const newProUntil = new Date(Math.max(
          referrer.proUntil?.getTime() || Date.now(),
          Date.now()
        ) + rewardMs);
        
        await UserModel.updateOne(
          { _id: referrer._id },
          { $set: { proUntil: newProUntil, tier: 'pro' } }
        );
      }

      // Update Referee (Current User)
      const newUserProUntil = new Date(Date.now() + rewardMs);
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { proUntil: newUserProUntil, tier: 'pro', isReferralRewardClaimed: true } }
      );
    }

    // Update user's count
    await UserModel.findOneAndUpdate(
      { walletAddress: userId.toLowerCase() },
      { $inc: { activeRuleCount: 1 } }
    );

    return NextResponse.json(newRule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
