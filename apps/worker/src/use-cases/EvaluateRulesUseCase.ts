/**
 * @file apps/worker/src/use-cases/EvaluateRulesUseCase.ts
 * @description Çekirdek iş mantığı. Birdeye'dan alınan token listesini,
 *              veritabanındaki aktif kurallarla karşılaştırır.
 *              Eşleşen her kural için BullMQ kuyruğuna bir notification job ekler.
 *
 *              Bu katman; veri kaynağını (IBirdeyeService),
 *              kural deposunu (IRuleRepository) ve kuyruk yönetimini
 *              interface'ler aracılığıyla tüketir — somut implementasyon bilmez.
 *              (Dependency Inversion Principle — DIP)
 */

import { Queue } from 'bullmq';
import type { IBirdeyeService } from '../interfaces/IBirdeyeService';
import type { IRuleRepository } from '../interfaces/IRuleRepository';
import type { IRule, BirdeyeToken, NotificationJobPayload, TriggerType } from '@chaintrigger/shared';

const QUEUE_NAME = 'notifications';

export class EvaluateRulesUseCase {
  private readonly notificationQueue: Queue<NotificationJobPayload>;

  constructor(
    private readonly ruleRepository: IRuleRepository,
    private readonly birdeyeService: IBirdeyeService,
    redisConnection: { host: string; port: number }
  ) {
    this.notificationQueue = new Queue<NotificationJobPayload>(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    });
  }

  /**
   * Worker döngüsünün her tick'inde çağrılan ana use-case metodu.
   * Tüm aktif kuralları getirir ve uygun trigger tipine göre token listesiyle eşleştirir.
   */
  async execute(): Promise<void> {
    const [activeRules, newListings, trendingTokens] = await Promise.all([
      this.ruleRepository.findAllActive(),
      this.birdeyeService.getNewListings(),
      this.birdeyeService.getTrendingTokens(),
    ]);

    const tokenMap: Record<TriggerType, BirdeyeToken[]> = {
      new_listing: newListings,
      trending_entry: trendingTokens,
      whale_radar: [], 
      liquidity_drain: [],
      volatility_breakout: [],
      pump_fun_migration: [],
    };

    const jobPromises: Promise<any>[] = [];

    for (const rule of activeRules) {
      const tokens = tokenMap[rule.triggerType];
      for (const token of tokens) {
        const isMatch = await this.evaluateConditions(rule, token);
        if (isMatch) {
          jobPromises.push(this.enqueueNotification(rule, token));
        }
      }
    }

    await Promise.allSettled(jobPromises);
  }

  /**
   * Bir token'ın bir kuralın tüm condition'larını sağlayıp sağlamadığını kontrol eder.
   * Security score gerektiren condition'lar için ayrı bir Birdeye çağrısı yapar.
   */
  private async evaluateConditions(rule: IRule, token: BirdeyeToken): Promise<boolean> {
    const securityData =
      rule.conditions.some((c) => c.field === 'security_score')
        ? await this.birdeyeService.getTokenSecurity(token.address)
        : null;

    const fieldValues: Record<string, number> = {
      liquidity: token.liquidity,
      volume_24h: token.volume24h,
      price_change_24h: token.priceChange24h,
      security_score: securityData?.securityScore ?? 0,
    };

    return rule.conditions.every((condition) => {
      const actual = fieldValues[condition.field];
      const val = condition.value as number;
      switch (condition.operator) {
        case '>=': return actual >= val;
        case '<=': return actual <= val;
        case '>':  return actual >  val;
        case '<':  return actual <  val;
        case '==': return actual === condition.value;
        default:   return false;
      }
    });
  }

  private async enqueueNotification(rule: IRule, token: BirdeyeToken): Promise<void> {
    const security = await this.birdeyeService.getTokenSecurity(token.address);

    const payload: NotificationJobPayload = {
      ruleId: rule._id!,
      userId: rule.userId,
      action: rule.action,
      token,
      security,
      chain: rule.chain,
      triggeredAt: new Date(),
    };

    // Job ID = ruleId + tokenAddress → aynı eşleşme için duplicate job önlenir
    await this.notificationQueue.add('send-notification', payload, {
      jobId: `${rule._id}-${token.address}`,
    });
  }
}
