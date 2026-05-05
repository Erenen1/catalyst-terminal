/**
 * @file apps/worker/src/services/BirdeyeService.ts
 * @description IBirdeyeService'in somut HTTP implementasyonu.
 *              axios + axios-retry ile Exponential Backoff desteği sağlar.
 *              Redis cache entegrasyonu bu servis içinde yönetilir.
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { IBirdeyeService } from '../interfaces/IBirdeyeService';
import type { BirdeyeToken, BirdeyeSecurityData, BirdeyeMarketData } from '@chaintrigger/shared';

const BASE_URL = 'https://public-api.birdeye.so';
const CACHE_TTL_SECONDS = 30; // Birdeye rate-limit koruması

export class BirdeyeService implements IBirdeyeService {
  private readonly client;

  constructor(
    private readonly apiKey: string,
    private readonly redisClient: any // RedisClientType — loosely typed to avoid circular dep
  ) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'X-API-KEY': this.apiKey,
      },
      timeout: 10_000,
    });

    // Exponential Backoff: 3 retry, 429/5xx'te otomatik bekler
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) =>
        axiosRetry.isNetworkError(err) ||
        [429, 500, 502, 503].includes(err.response?.status ?? 0),
    });
  }

  async getNewListings(chain: string = 'solana'): Promise<BirdeyeToken[]> {
    const cacheKey = `birdeye:new_listing:${chain}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data } = await this.client.get('/v2/tokens/new_listing', {
      params: { limit: 20 },
      headers: { 'x-chain': chain }
    });

    const tokens: BirdeyeToken[] = data.data?.items ?? [];
    await this.redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(tokens));
    return tokens;
  }

  async getTrendingTokens(chain: string = 'solana'): Promise<BirdeyeToken[]> {
    const cacheKey = `birdeye:trending:${chain}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data } = await this.client.get('/defi/token_trending', {
      params: { sort_by: 'volume24hUSD', sort_type: 'desc', limit: 20 },
      headers: { 'x-chain': chain }
    });

    const tokens: BirdeyeToken[] = data.data?.tokens ?? [];
    await this.redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(tokens));
    return tokens;
  }

  async getTokenSecurity(address: string, chain: string = 'solana'): Promise<BirdeyeSecurityData> {
    const cacheKey = `birdeye:security:${chain}:${address}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data } = await this.client.get('/defi/token_security', {
      params: { address },
      headers: { 'x-chain': chain }
    });

    const result: BirdeyeSecurityData = {
      address,
      securityScore: data.data?.score ?? 0,
      isHoneypot: data.data?.honeypot ?? false,
      isRugPull: data.data?.rugPull ?? false,
      noMintAuthority: data.data?.mintAuthority === null || data.data?.mintAuthority === undefined,
      noFreezeAuthority: data.data?.freezeAuthority === null || data.data?.freezeAuthority === undefined,
      top10HolderPercent: data.data?.top10HolderPercent ?? 0,
    };

    // Güvenlik verisi daha uzun süre cache'lenir (1 saat)
    await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
    return result;
  }

  async getMarketData(address: string, chain: string = 'solana'): Promise<BirdeyeMarketData> {
    const cacheKey = `birdeye:market:${chain}:${address}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data } = await this.client.get('/defi/v3/token/market-data', {
      params: { address },
      headers: { 'x-chain': chain }
    });

    const result: BirdeyeMarketData = {
      address,
      price: data.data?.price ?? 0,
      volume24h: data.data?.volume24h ?? 0,
      liquidity: data.data?.liquidity ?? 0,
      circulatingSupply: data.data?.circulatingSupply ?? 0,
      marketCap: data.data?.marketCap ?? 0,
    };

    await this.redisClient.setEx(cacheKey, 60, JSON.stringify(result));
    return result;
  }
}
