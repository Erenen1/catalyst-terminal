/**
 * @file apps/worker/src/engine/RuleEngine.ts
 * @description Çekirdek iş mantığı motoru. Birdeye'dan gelen verileri
 *              veritabanındaki kurallarla kıyaslar. Karşılaştırma işlemini
 *              OperatorRegistry üzerinden dinamik olarak çözer (Strategy Pattern).
 *              Eşleşme durumunda BullMQ kuyruğuna asenkron job ekler.
 */

import { Queue } from 'bullmq';
import type { IBirdeyeService } from '../interfaces/IBirdeyeService';
import type { IRuleRepository } from '../interfaces/IRuleRepository';
import type { IRule, RuleCondition, BirdeyeToken, NotificationJobPayload, BirdeyeSecurityData, BirdeyeMarketData } from '@chaintrigger/shared';
import { OperatorRegistry } from './operators/OperatorRegistry';
import { TriggerRegistry } from './strategies/TriggerRegistry';
import { AlertModel, logger } from '@chaintrigger/shared';

export class RuleEngine {
  constructor(
    private readonly ruleRepository: IRuleRepository,
    private readonly birdeyeService: IBirdeyeService,
    private readonly notificationQueue: Queue<NotificationJobPayload>,
    private readonly redisClient: any, // RedisClientType for caching and real-time streaming
    private readonly operatorRegistry: OperatorRegistry = new OperatorRegistry(),
    private readonly triggerRegistry: TriggerRegistry = new TriggerRegistry()
  ) { }



  /**
   * Bir token'ın kuraldaki temel (API gerektirmeyen) şartları sağlayıp sağlamadığını kontrol eder.
   * "Candidate Enrichment" optimizasyonu için kullanılır.
   */
  public isCandidate(rule: IRule, token: BirdeyeToken): boolean {
    // Kredi Koruması: Likiditesi çok düşük ($1000 altı) tokenlar için asla pahalı sorgu yapma
    const HARD_LIQUIDITY_MIN = 1000;
    if ((token.liquidity || 0) < HARD_LIQUIDITY_MIN) {
      return false;
    }

    const basicFields = ['liquidity', 'volume_24h', 'price_change_24h'];
    const basicConditions = rule.conditions.filter((c: RuleCondition) => basicFields.includes(c.field));

    // Eğer kuralda temel bir filtre yoksa, sistem güvenliği için minimum likidite şartı ara
    if (basicConditions.length === 0) {
      return (token.liquidity || 0) > 1000; // Varsayılan adaylık şartı
    }

    const fieldValues: Record<string, number> = {
      liquidity: token.liquidity,
      volume_24h: token.volume24h,
      price_change_24h: token.priceChange24h,
    };

    return basicConditions.every((condition: RuleCondition) => {
      const actual = fieldValues[condition.field];
      const operatorStrategy = this.operatorRegistry.resolve(condition.operator);
      return operatorStrategy.evaluate(actual, condition.value as any);
    });
  }

  /**
   * Bir kural için bir grup token'ı işler. Global Watcher tarafından kullanılır.
   * Artık eşleşmeleri bir liste olarak döner (Batch processing için).
   */
  async processRuleBatch(
    rule: IRule,
    tokens: BirdeyeToken[],
    tier: string,
    enrichmentMap?: Map<string, { security: BirdeyeSecurityData, marketData?: BirdeyeMarketData }>
  ): Promise<any[]> {
    const matches: any[] = [];

    for (const token of tokens) {
      const { isMatch, security, marketData } = await this.evaluateConditions(rule, token, tier, enrichmentMap?.get(token.address));

      if (isMatch) {
        matches.push({
          rule,
          token,
          security,
          marketData
        });
      }
    }

    return matches;
  }

  /**
   * Toplanan tüm eşleşmeleri toplu olarak işler (Bulk DB Insert + Bulk Queue Add).
   * Veritabanı ve Redis yükünü minimize eder.
   */
  async batchProcessResults(allMatches: any[]): Promise<void> {
    if (allMatches.length === 0) return;

    try {
      // Enrichment: Tüm eksik logoları TEK BİR Batch API isteği ile tamamla
      const addressesMissingLogo = [...new Set(allMatches
        .filter(m => !m.token.logoURI)
        .map(m => m.token.address))];

      if (addressesMissingLogo.length > 0) {
        // Not: Tüm sinyallerin aynı chain'den olduğunu varsayıyoruz (chain bazlı ticklendiği için)
        const metaMap = await this.birdeyeService.getMultipleTokenMetadata(addressesMissingLogo, allMatches[0].rule.chain);
        
        for (const m of allMatches) {
          if (!m.token.logoURI && metaMap[m.token.address]?.logoURI) {
            m.token.logoURI = metaMap[m.token.address].logoURI;
          }
        }
      }

      // 1. Bulk Insert to MongoDB (Feed ekranı için)
      const alertDocs = allMatches.map(m => ({
        ruleId: m.rule._id,
        userId: m.rule.userId,
        triggerType: m.rule.triggerType,
        token: m.token,
        security: m.security,
        chain: m.rule.chain,
        createdAt: new Date()
      }));
      await AlertModel.insertMany(alertDocs);

      // 2. Bulk Add to BullMQ (Bildirimler için)
      const notificationJobs = allMatches
        .filter(m => m.rule.userId !== 'GLOBAL' && m.rule.action)
        .map(m => ({
          name: 'send-notification',
          data: {
            ruleId: m.rule._id,
            userId: m.rule.userId,
            action: m.rule.action,
            token: m.token,
            security: m.security,
            marketData: m.marketData,
            chain: m.rule.chain,
            triggeredAt: new Date()
          } as NotificationJobPayload,
          opts: {
            jobId: `${m.rule._id}-${m.token.address}`
          }
        }));

      // Pazarlama akışı (Global Alpha Feed) - %10 şans
      const marketingJobs = allMatches
        .filter(m => m.rule.userId === 'GLOBAL' && Math.random() < 0.1)
        .map(m => ({
          name: 'send-notification',
          data: {
            ruleId: 'GLOBAL_ALPHA_FEED',
            userId: 'PUBLIC',
            action: { type: 'telegram', chatId: process.env.PUBLIC_CHANNEL_ID || '@BirdeyeCatalystAlpha' } as any,
            token: m.token,
            security: m.security,
            marketData: m.marketData,
            chain: m.rule.chain,
            triggeredAt: new Date()
          } as NotificationJobPayload,
          opts: {
            delay: 30000,
            jobId: `public-${m.token.address}-${Date.now()}`
          }
        }));

      const allJobs = [...notificationJobs, ...marketingJobs];
      if (allJobs.length > 0) {
        logger.info(`Dispatching ${allJobs.length} notifications (${notificationJobs.length} private, ${marketingJobs.length} public)...`, 'RuleEngine');
        await this.notificationQueue.addBulk(allJobs);
      } else {
        logger.debug('No notification jobs to dispatch for this batch.', 'RuleEngine');
      }

      // 3. Redis Caching & Real-time Pub/Sub (Optimization)
      // Use Redis Pipeline (multi) to minimize network roundtrips for batch updates
      const multi = this.redisClient.multi();

      for (const m of allMatches) {
        const cacheKey = `alerts:user:${m.rule.userId}`;
        const channelKey = `alerts:channel:${m.rule.userId}`;
        const alertData = JSON.stringify({
          _id: `temp-${Date.now()}-${Math.random()}`,
          ruleId: m.rule._id,
          userId: m.rule.userId,
          token: m.token,
          security: m.security,
          chain: m.rule.chain,
          createdAt: new Date()
        });

        // Add to user cache (keep last 20)
        multi.lPush(cacheKey, alertData);
        multi.lTrim(cacheKey, 0, 19);
        multi.expire(cacheKey, 86400); // 24 hours
        // Publish to user SSE channel
        multi.publish(channelKey, alertData);

        // Global Radar Feed for Landing Page (keep last 50)
        multi.lPush('alerts:user:GLOBAL', alertData);
        multi.lTrim('alerts:user:GLOBAL', 0, 49);
        multi.publish('alerts:channel:GLOBAL', alertData);
      }

      await multi.exec();

      logger.info(`Batch processed: ${alertDocs.length} alerts, ${allJobs.length} notifications, ${allMatches.length} cached.`, 'RuleEngine');
    } catch (error) {
      logger.error('Batch process error', 'RuleEngine', error);
    }
  }

  private async evaluateConditions(
    rule: IRule,
    token: BirdeyeToken,
    tier: string = 'free',
    preFetched?: { security: BirdeyeSecurityData; marketData?: BirdeyeMarketData }
  ): Promise<{ isMatch: boolean; security: BirdeyeSecurityData; marketData?: BirdeyeMarketData }> {
    // 1. Temel Filtreleme (API Gerektirmeyen alanlar)
    const basicFields = ['liquidity', 'volume_24h', 'price_change_24h'];
    const basicConditions = rule.conditions.filter((c: RuleCondition) => basicFields.includes(c.field));

    const fieldValues: Record<string, number> = {
      liquidity: token.liquidity,
      volume_24h: token.volume24h,
      price_change_24h: token.priceChange24h,
    };

    // Temel şartlar sağlanmıyorsa direkt false dön, API harcama!
    const passesBasic = basicConditions.every((condition: RuleCondition) => {
      const actual = fieldValues[condition.field];
      const operatorStrategy = this.operatorRegistry.resolve(condition.operator);
      return operatorStrategy.evaluate(actual, condition.value as any);
    });

    if (!passesBasic) {
      return {
        isMatch: false,
        security: { address: token.address, securityScore: 0, isHoneypot: false, isRugPull: false, noMintAuthority: false, noFreezeAuthority: false, top10HolderPercent: 0 }
      };
    }

    // 2. Pro Filtreleme Bariyeri
    // Sadece PRO kullanıcılar veya Global sistem kuralları gelişmiş filtreleri kullanabilir
    const advancedFields = ['security_score', 'no_mint_authority', 'no_freeze_authority', 'top_10_holder_percent'];
    const hasAdvancedConditions = rule.conditions.some((c: RuleCondition) => advancedFields.includes(c.field));

    if (tier !== 'pro' && rule.userId !== 'GLOBAL' && hasAdvancedConditions) {
      // Free users cannot match advanced conditions
      return {
        isMatch: false,
        security: { address: token.address, securityScore: 0, isHoneypot: false, isRugPull: false, noMintAuthority: false, noFreezeAuthority: false, top10HolderPercent: 0 }
      };
    }

    // 2. Güvenlik ve Market Verisi Fetching (Sadece temel filtreyi geçenler için)
    // Eğer GlobalWatcher zaten veriyi çekmişse (enrichment), onu kullanıyoruz.
    let security: BirdeyeSecurityData;
    let marketData: BirdeyeMarketData | undefined;

    if (preFetched && preFetched.security) {
      security = preFetched.security;
      marketData = preFetched.marketData;
    } else {
      // Fallback: Veri yoksa (manuel çağrılarda veya enrichment hatasında) API'ye git
      try {
        security = await this.birdeyeService.getTokenSecurity(token.address, rule.chain);
        marketData = await this.birdeyeService.getMarketData(token.address, rule.chain);
      } catch (err) {
        logger.warn(`Security/Market fallback fetch failed for ${token.address}`, 'RuleEngine', err);
        return {
          isMatch: false,
          security: { address: token.address, securityScore: 0, isHoneypot: false, isRugPull: false, noMintAuthority: false, noFreezeAuthority: false, top10HolderPercent: 0 }
        };
      }
    }

    fieldValues['security_score'] = security.securityScore;
    fieldValues['no_mint_authority'] = security.noMintAuthority ? 1 : 0;
    fieldValues['no_freeze_authority'] = security.noFreezeAuthority ? 1 : 0;
    fieldValues['top_10_holder_percent'] = security.top10HolderPercent ?? 0;

    // 3. Tüm şartları tekrar kontrol et (Security dahil)
    const isMatch = rule.conditions.every((condition: RuleCondition) => {
      const actual = fieldValues[condition.field];
      const operatorStrategy = this.operatorRegistry.resolve(condition.operator);
      return operatorStrategy.evaluate(actual, condition.value as any);
    });

    return { isMatch, security, marketData };
  }

}
