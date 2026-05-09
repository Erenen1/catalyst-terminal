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
    // For non-Solana chains, RugCheck is not available — return safe defaults
    if (chain !== 'solana') {
      return { address, securityScore: 50, isHoneypot: false, isRugPull: false, noMintAuthority: false, noFreezeAuthority: false, top10HolderPercent: 0 };
    }

    const cacheKey = `rugcheck:security:${address}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const { data } = await axios.get(
        `https://api.rugcheck.xyz/v1/tokens/${address}/report/summary`,
        { timeout: 8_000 }
      );

      const risks: Array<{ name: string; level: string }> = data.risks ?? [];
      const riskNames = risks.map((r) => r.name.toLowerCase());

      // RugCheck score_normalised: 0 = perfect, 100 = very risky → invert for our 0–100 (higher = safer)
      const rawScore: number = data.score_normalised ?? 50;
      const securityScore = Math.max(0, Math.min(100, Math.round(100 - rawScore)));

      const isHoneypot    = riskNames.some((n) => n.includes('honeypot'));
      const isRugPull     = riskNames.some((n) => n.includes('rug') || n.includes('rugged'));
      const hasMintRisk   = riskNames.some((n) => n.includes('mint'));
      const hasFreezeRisk = riskNames.some((n) => n.includes('freeze'));

      // top10HolderPercent: derive from "High holder concentration" risk or lpLockedPct proxy
      const holderRisk = risks.find((r) => r.name.toLowerCase().includes('holder'));
      const top10HolderPercent = holderRisk ? 65 : Math.max(0, 100 - (data.lpLockedPct ?? 0));

      const result: BirdeyeSecurityData = {
        address,
        securityScore,
        isHoneypot,
        isRugPull,
        noMintAuthority:   !hasMintRisk,
        noFreezeAuthority: !hasFreezeRisk,
        top10HolderPercent: Math.round(top10HolderPercent),
      };

      // Cache for 5 minutes
      await this.redisClient.setEx(cacheKey, 300, JSON.stringify(result));
      logger.info(`[RugCheck] ${address} → score=${securityScore}, mint=${hasMintRisk}, freeze=${hasFreezeRisk}`, 'BirdeyeService');
      return result;
    } catch (err: any) {
      logger.warn(`[RugCheck] Failed for ${address}: ${err.message} — using safe fallback`, 'BirdeyeService');
      // Graceful fallback — don't break the worker pipeline
      return { address, securityScore: 50, isHoneypot: false, isRugPull: false, noMintAuthority: false, noFreezeAuthority: false, top10HolderPercent: 0 };
    }
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
      circulatingSupply: data.data?.circulating_supply ?? 0,
      marketCap: data.data?.market_cap ?? 0,
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
