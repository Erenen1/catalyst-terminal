export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AlertModel } from '@chaintrigger/shared';
import dbConnect from '@/lib/db';
import { getRedisClient } from '@/lib/redis';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';

  const { success } = await rateLimit(`alerts:${ip}`, 60, 60);
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const redis = await getRedisClient();

    // GLOBAL feed → RuleEngine pushes to 'alerts:user:GLOBAL' in Redis
    // User feed   → RuleEngine pushes to 'alerts:user:<walletAddress>'
    const cacheKey = `alerts:user:${userId}`;
    const cachedAlerts = await redis.lRange(cacheKey, 0, 49);

    if (cachedAlerts && cachedAlerts.length > 0) {
      return NextResponse.json(cachedAlerts.map((a: string) => JSON.parse(a)));
    }

    // Cold-cache fallback: hit MongoDB
    await dbConnect();

    let alerts;
    if (userId === 'GLOBAL') {
      // Return the latest alerts from ANY user — this is the public feed
      const rawAlerts = await AlertModel.find({})
        .sort({ createdAt: -1 })
        .limit(200); // Fetch more to ensure we get enough unique ones
      
      const uniqueAlerts = [];
      const seenTokens = new Set();
      
      for (const alert of rawAlerts) {
        if (!seenTokens.has(alert.token.address)) {
          seenTokens.add(alert.token.address);
          uniqueAlerts.push(alert);
          if (uniqueAlerts.length >= 50) break;
        }
      }
      alerts = uniqueAlerts;
    } else {
      alerts = await AlertModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20);
    }

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

