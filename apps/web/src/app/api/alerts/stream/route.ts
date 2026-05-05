import { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response('UserId required', { status: 400 });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const redis = await getRedisClient();
  const subscriber = redis.duplicate();
  await subscriber.connect();

  const channelKey = `alerts:channel:${userId}`;
  
  // Clean up on close
  req.signal.addEventListener('abort', async () => {
    await subscriber.unsubscribe(channelKey);
    await subscriber.quit();
    writer.close();
  });

  await subscriber.subscribe(channelKey, (message: string) => {
    writer.write(encoder.encode(`data: ${message}\n\n`));
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
