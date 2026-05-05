import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { LoopWebhookEventPayload } from '@chaintrigger/shared';

// Initialize BullMQ Queue
// Using standard redis connection, adjust as per environment
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

const loopEventQueue = new Queue('loop-events', {
  connection: { host: redisHost, port: redisPort },
});

export async function POST(req: Request) {
  try {
    const payload: LoopWebhookEventPayload = await req.json();

    // Loop webhook events verification should be added here
    // typically by verifying a signature header like x-loop-signature

    if (!payload.eventId || !payload.eventType) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Push to the queue
    await loopEventQueue.add(payload.eventType, payload, {
      jobId: payload.eventId, // Ensure idempotency by using the event ID
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    console.log(`[Loop Webhook] Enqueued event ${payload.eventType} with ID: ${payload.eventId}`);

    return NextResponse.json({ success: true, message: 'Event queued successfully' });
  } catch (error) {
    console.error('[Loop Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
