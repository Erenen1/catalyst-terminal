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
    try {
      await subscriber.unsubscribe(channelKey);
      await subscriber.quit();
    } catch (e) {
      // Redis might already be disconnected
    } finally {
      try {
        writer.close();
      } catch (e) {
        // Stream might already be closed
      }
    }
  });

  await subscriber.subscribe(channelKey, (message: string) => {
    try {
      writer.write(encoder.encode(`data: ${message}\n\n`));
    } catch (e) {
      // Stream closed, unsubscribe will handle it
    }
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
