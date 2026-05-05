import { Worker, Job } from 'bullmq';
import { LoopWebhookEventPayload, ILoopSubscription } from '@chaintrigger/shared';
import { LoopSubscriptionModel } from '@chaintrigger/shared/src/models/LoopSubscription.model';
import { UserModel } from '@chaintrigger/shared/src/models/User.model';
import { RedisClientType } from 'redis';

const GRACE_PERIOD_DAYS = 3;

export class LoopWorker {
  private worker: Worker<LoopWebhookEventPayload>;

  constructor(
    private redisHost: string,
    private redisPort: number
  ) {
    this.worker = new Worker<LoopWebhookEventPayload>(
      'loop-events',
      this.processJob.bind(this),
      {
        connection: { host: this.redisHost, port: this.redisPort },
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`[LoopWorker] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[LoopWorker] Job ${job?.id} failed:`, err);
    });
  }

  private async processJob(job: Job<LoopWebhookEventPayload>) {
    const { eventType, subscriptionId, customerAddress, timestamp, data } = job.data;
    console.log(`[LoopWorker] Processing event: ${eventType} for subscription ${subscriptionId}`);

    const user = await UserModel.findOne({ walletAddress: { $regex: new RegExp(`^${customerAddress}$`, 'i') } });

    if (!user) {
      // Create a user placeholder or just fail
      console.warn(`[LoopWorker] User not found for wallet: ${customerAddress}. Creating one.`);
    }

    const actualUser = user || await UserModel.create({
      walletAddress: customerAddress.toLowerCase(),
      tier: 'free',
      activeRuleCount: 0
    });

    switch (eventType) {
      case 'subscription.active':
      case 'payment.success':
        await this.handleSubscriptionActiveOrSuccess(subscriptionId, actualUser._id.toString(), data);
        break;

      case 'payment.failed':
        await this.handlePaymentFailed(subscriptionId, actualUser._id.toString());
        break;

      case 'subscription.canceled':
        await this.handleSubscriptionCanceled(subscriptionId);
        break;

      default:
        console.warn(`[LoopWorker] Unknown event type: ${eventType}`);
    }
  }

  private async handleSubscriptionActiveOrSuccess(subscriptionId: string, userId: string, data: any) {
    const currentPeriodStart = new Date(data.currentPeriodStart ? data.currentPeriodStart * 1000 : Date.now());
    const currentPeriodEnd = new Date(data.currentPeriodEnd ? data.currentPeriodEnd * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await LoopSubscriptionModel.findOneAndUpdate(
      { loopSubscriptionId: subscriptionId },
      {
        userId,
        loopSubscriptionId: subscriptionId,
        status: 'active',
        plan: data.plan || 'pro',
        currentPeriodStart,
        currentPeriodEnd,
        gracePeriodEnd: null, // Clear any grace period
      },
      { upsert: true, new: true }
    );

    // Update user tier
    await UserModel.findByIdAndUpdate(userId, {
      tier: 'pro',
      proUntil: currentPeriodEnd,
    });

    console.log(`[LoopWorker] Subscription ${subscriptionId} marked as active. User ${userId} is now PRO.`);
  }

  private async handlePaymentFailed(subscriptionId: string, userId: string) {
    const subscription = await LoopSubscriptionModel.findOne({ loopSubscriptionId: subscriptionId });
    if (!subscription) {
      console.warn(`[LoopWorker] Payment failed for unknown subscription ${subscriptionId}`);
      return;
    }

    // Grace Period Logic
    const now = new Date();
    
    // If we haven't set a grace period yet, or it's currently active, we set it.
    if (!subscription.gracePeriodEnd) {
      const gracePeriodEnd = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      subscription.gracePeriodEnd = gracePeriodEnd;
      subscription.status = 'past_due';
      await subscription.save();
      
      console.log(`[LoopWorker] Payment failed for ${subscriptionId}. Grace period granted until ${gracePeriodEnd}`);
      // Send warning notification to user (could push to notification queue)
    } else if (now > subscription.gracePeriodEnd) {
      // Grace period expired
      subscription.status = 'unpaid';
      await subscription.save();

      // Revert user to free tier
      await UserModel.findByIdAndUpdate(userId, {
        tier: 'free',
        proUntil: null,
      });
      console.log(`[LoopWorker] Grace period expired for ${subscriptionId}. User ${userId} reverted to FREE.`);
    } else {
      console.log(`[LoopWorker] Payment failed again for ${subscriptionId}. Still within grace period until ${subscription.gracePeriodEnd}`);
    }
  }

  private async handleSubscriptionCanceled(subscriptionId: string) {
    const subscription = await LoopSubscriptionModel.findOneAndUpdate(
      { loopSubscriptionId: subscriptionId },
      { status: 'canceled' },
      { new: true }
    );

    if (subscription) {
      await UserModel.findByIdAndUpdate(subscription.userId, {
        tier: 'free',
        proUntil: null,
      });
      console.log(`[LoopWorker] Subscription ${subscriptionId} canceled. User ${subscription.userId} reverted to FREE.`);
    }
  }

  public async close() {
    await this.worker.close();
  }
}
