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
  req.signal.addEventListener('abort', () => {
    // Next.js automatically closes the stream on client disconnect.
    // We only need to clean up the Redis subscription.
    subscriber.unsubscribe(channelKey).catch(() => {});
    subscriber.quit().catch(() => {});
  });

  await subscriber.subscribe(channelKey, (message: string) => {
    if (req.signal.aborted) return;
    
    try {
      writer.write(encoder.encode(`data: ${message}\n\n`)).catch(() => {
        // Stream might be closed between the aborted check and the write
      });
    } catch (e) {
      // Ignore synchronous write errors if stream is closed
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
