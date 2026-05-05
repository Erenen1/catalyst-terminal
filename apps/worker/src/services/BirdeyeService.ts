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
import { logger, formatLogoURI } from '@chaintrigger/shared';

const BASE_URL = 'https://public-api.birdeye.so';
const CACHE_TTL_SECONDS = 30; // Birdeye rate-limit koruması
const METADATA_TTL = 86400; // 24 saat (Logo değişmez pek)

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

    const { data } = await this.client.get('/defi/v2/tokens/new_listing', {
      params: { limit: 20 },
      headers: { 'x-chain': chain }
    });

    const rawTokens = data.data?.items ?? [];
    const tokens: BirdeyeToken[] = rawTokens.map((t: any) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      liquidity: t.liquidity || 0,
      volume24h: t.volume24hUSD || t.v24hUSD || 0,
      priceChange24h: t.price24hChangePercent || t.v24hChangePercent || 0,
      logoURI: formatLogoURI(t.logo_uri || t.logoURI || t.logo),
    }));
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

    const rawTokens = data.data?.tokens ?? [];
    const tokens: BirdeyeToken[] = rawTokens.map((t: any) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      liquidity: t.liquidity || 0,
      volume24h: t.volume24hUSD || t.v24hUSD || 0,
      priceChange24h: t.price24hChangePercent || t.v24hChangePercent || 0,
      logoURI: formatLogoURI(t.logo_uri || t.logoURI || t.logo),
    }));
    await this.redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(tokens));
    return tokens;
  }

  async getTokenSecurity(address: string, chain: string = 'solana'): Promise<BirdeyeSecurityData> {
    // ⚠️ NOTICE: The current Birdeye API key lacks sufficient permissions for /defi/token_security.
    // It returns 401 Unauthorized. Therefore, this call is mocked for now.
    // See README.md for future integration plans.
    
    const result: BirdeyeSecurityData = {
      address,
      securityScore: 85, // Mocked score
      isHoneypot: false, // Mocked value
      isRugPull: false, // Mocked value
      noMintAuthority: true, // Mocked value
      noFreezeAuthority: true, // Mocked value
      top10HolderPercent: 10, // Mocked value
    };

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

  async getMultipleTokenMetadata(addresses: string[], chain: string = 'solana'): Promise<Record<string, { logoURI?: string }>> {
    if (addresses.length === 0) return {};
    
    const results: Record<string, { logoURI?: string }> = {};
    const missingInCache: string[] = [];

    // 1. Try to get from Redis Cache first
    for (const addr of addresses) {
      const cacheKey = `birdeye:metadata:${chain}:${addr}`;
      const cached = await this.redisClient.get(cacheKey);
      if (cached) {
        results[addr] = JSON.parse(cached);
      } else {
        missingInCache.push(addr);
      }
    }

    if (missingInCache.length === 0) return results;

    // 2. Fetch missing ones in a SINGLE Batch API call
    try {
      const { data } = await this.client.get('/defi/v3/token/meta-data/multiple', {
        params: { addresses: missingInCache.join(',') },
        headers: { 'x-chain': chain }
      });

      // Birdeye returns an object with addresses as keys
      const metaDataMap = data.data || {};
      
      for (const addr of missingInCache) {
        const logo = metaDataMap[addr]?.logo_uri || metaDataMap[addr]?.logoURI || metaDataMap[addr]?.logo;
        const meta = { logoURI: formatLogoURI(logo) };
        results[addr] = meta;
        
        // Cache globally for 24 hours
        await this.redisClient.setEx(`birdeye:metadata:${chain}:${addr}`, METADATA_TTL, JSON.stringify(meta));
      }
    } catch (error) {
      logger.error(`Batch metadata fetch failed for ${missingInCache.length} tokens`, 'BirdeyeService', error);
    }

    return results;
  }
}
