/**
 * @file packages/shared/src/types/index.ts
 * @description Core domain types shared across all applications in the monorepo.
 *              These are pure TypeScript interfaces — no runtime dependencies.
 */

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserTier = 'free' | 'pro';

/** Free tier için maksimum aktif kural sınırı */
export const FREE_TIER_RULE_LIMIT = 3;

export interface IUser {
  _id?: string;
  walletAddress: string; // Cüzdan adresi — primary key
  tier: UserTier;
  activeRuleCount: number;
  telegramChatId?: string;
  telegramVerificationToken?: string;
  telegramUsername?: string;
  proUntil?: Date; // Pro üyelik bitiş tarihi
  referralCode?: string; // Kullanıcının kendi referans kodu
  referredBy?: string; // Kullanıcıyı kimin getirdiği (referans kodu)
  isReferralRewardClaimed?: boolean; // Referans ödülü alındı mı?
  referralCount?: number; // Kaç kişiyi davet etti
  createdAt?: Date;
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export type TriggerType = 'new_listing' | 'trending_entry' | 'whale_radar' | 'liquidity_drain' | 'volatility_breakout' | 'pump_fun_migration';

// ─── Conditions ───────────────────────────────────────────────────────────────

export type ConditionOperator = '>=' | '<=' | '>' | '<' | '==';

export interface RuleCondition {
  field: 'security_score' | 'liquidity' | 'volume_24h' | 'price_change_24h' | 'no_mint_authority' | 'no_freeze_authority' | 'top_10_holder_percent';
  operator: ConditionOperator;
  value: number;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ActionType = 'telegram' | 'custom_webhook';

export interface TelegramAction {
  type: 'telegram';
  chatId: string;
}

export interface CustomWebhookAction {
  type: 'custom_webhook';
  endpoint: string;
}

export type RuleAction = TelegramAction | CustomWebhookAction;

// ─── Rule ─────────────────────────────────────────────────────────────────────

export interface IRule {
  _id?: string;
  userId: string;
  name: string;
  triggerType: TriggerType;
  conditions: RuleCondition[];
  action: RuleAction;
  chain: string; // 'solana', 'ethereum', 'base', etc.
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Birdeye API Payloads ─────────────────────────────────────────────────────

export interface BirdeyeToken {
  address: string;
  symbol: string;
  name: string;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
}

export interface BirdeyeSecurityData {
  address: string;
  securityScore: number;
  isHoneypot: boolean;
  isRugPull: boolean;
  noMintAuthority?: boolean;
  noFreezeAuthority?: boolean;
  top10HolderPercent?: number;
}

export interface BirdeyeMarketData {
  address: string;
  price: number;
  volume24h: number;
  liquidity: number;
  circulatingSupply: number;
  marketCap: number;
}

// ─── Queue Job Payloads ───────────────────────────────────────────────────────

export interface NotificationJobPayload {
  ruleId: string;
  userId: string;
  action: RuleAction;
  token: BirdeyeToken;
  security: BirdeyeSecurityData;
  marketData?: BirdeyeMarketData;
  chain: string;
  triggeredAt: Date;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface IAlert {
  _id?: string;
  ruleId: string;
  userId: string;
  triggerType: TriggerType;
  token: BirdeyeToken;
  security: BirdeyeSecurityData;
  chain: string;
  createdAt: Date;
}

// ─── Tracked Alpha ────────────────────────────────────────────────────────────

export interface ITrackedToken {
  _id?: string;
  userId: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  entryPrice: number;
  entryLiquidity: number;
  chain: string;
  createdAt: Date;
}
