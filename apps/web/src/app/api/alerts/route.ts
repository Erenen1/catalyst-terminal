import { NextRequest, NextResponse } from 'next/server';
import { AlertModel } from '@chaintrigger/shared';
import dbConnect from '@/lib/db';
import { getRedisClient } from '@/lib/redis';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';

  // 1. Rate Limiting (Item 2)
  const { success } = await rateLimit(`alerts:${ip}`, 60, 60); // 60 requests per minute
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const redis = await getRedisClient();
    const cacheKey = `alerts:user:${userId}`;
    
    // 1. Try Redis Cache first
    const cachedAlerts = await redis.lRange(cacheKey, 0, 19);
    
    if (cachedAlerts && cachedAlerts.length > 0) {
      return NextResponse.json(cachedAlerts.map((a: string) => JSON.parse(a)));
    }

    // 2. Fallback to MongoDB
    await dbConnect();
    const query = userId === 'GLOBAL' ? {} : { userId };
    const alerts = await AlertModel.find(query)
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
