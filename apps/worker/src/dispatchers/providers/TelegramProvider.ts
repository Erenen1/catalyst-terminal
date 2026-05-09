/**
 * @file apps/worker/src/dispatchers/providers/TelegramProvider.ts
 * @description INotificationProvider'ın Telegram implementasyonu.
 */

import TelegramBot from 'node-telegram-bot-api';
import type { INotificationProvider } from './INotificationProvider';
import type { NotificationJobPayload, TelegramAction } from '@chaintrigger/shared';

export class TelegramProvider implements INotificationProvider {
  readonly type = 'telegram';
  private readonly bot: TelegramBot;

  constructor(botToken: string) {
    this.bot = new TelegramBot(botToken, { polling: false });
  }

  async send(payload: NotificationJobPayload): Promise<void> {
    const action = payload.action as TelegramAction;
    
    if (!action || !action.chatId) {
      console.warn(`[TelegramProvider] ⚠️ SKIP: Missing chat_id for user ${payload.userId}.`);
      return;
    }

    const message = this.buildMessage(payload);
    const buttons = this.buildButtons(payload);

    try {
      if (payload.token.logoURI) {
        await this.bot.sendPhoto(action.chatId, payload.token.logoURI, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      } else {
        await this.bot.sendMessage(action.chatId, message, { 
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      }
      console.log(`[TelegramProvider] 📨 SENT: Message delivered to ${action.chatId} (Token: ${payload.token.symbol})`);
    } catch (error: any) {
      console.error(`[TelegramProvider] ❌ ERROR: Failed to send to ${action.chatId}.`, error.message);
      throw error;
    }
  }

  private buildButtons(payload: NotificationJobPayload) {
    const { token, chain } = payload;
    const buttons = [
      [
        { text: '📊 View on Birdeye', url: `https://birdeye.so/token/${token.address}?chain=${chain}` }
      ]
    ];

    if (chain === 'solana') {
      buttons.push([
        { text: '⚡ Quick Swap (Jupiter)', url: `https://jup.ag/swap/SOL-${token.address}` },
        { text: '🛡️ RugCheck Scan', url: `https://rugcheck.xyz/tokens/${token.address}` }
      ]);
    } else if (chain === 'ethereum') {
      buttons.push([
        { text: '🦄 Swap on Uniswap', url: `https://app.uniswap.org/#/swap?outputCurrency=${token.address}` }
      ]);
    }

    return buttons;
  }

  private buildMessage(payload: NotificationJobPayload): string {
    const { token, security, marketData, triggeredAt, userId, chain, triggerType } = payload;
    const isPublic = userId === 'PUBLIC';

    const triggerEmoji: Record<string, string> = {
      'new_listing': '🆕',
      'trending_entry': '📈',
      'whale_radar': '🐳',
      'liquidity_drain': '⚠️',
      'volatility_breakout': '⚡',
      'pump_fun_migration': '🚀'
    };

    const triggerLabel: Record<string, string> = {
      'new_listing': 'New Listing',
      'trending_entry': 'Trending Entry',
      'whale_radar': 'Whale Entry',
      'liquidity_drain': 'Liquidity Drain',
      'volatility_breakout': 'Volatility Breakout',
      'pump_fun_migration': 'Pump.fun Migration'
    };

    // ─── 5. WHY NOW? (REASONING ENGINE) ──────────────────
    const reasons: string[] = [];
    const volLiqRatio = token.volume24h / (token.liquidity || 1);
    const mcapLiqRatio = (marketData?.marketCap || 0) / (token.liquidity || 1);
    
    if (volLiqRatio > 2) reasons.push(`**Extreme Hype:** Volume is ${volLiqRatio.toFixed(1)}x higher than liquidity.`);
    if (security.aiPrediction === 'BULLISH' && security.catalystScore! > 80) {
      reasons.push(`**AI Alpha:** High-confidence bullish pattern detected.`);
    }
    if (triggerType === 'trending_entry' && security.securityScore > 80) {
      reasons.push(`**Safe Trend:** Token trending with low rug risk.`);
    }
    if (mcapLiqRatio > 50) {
      reasons.push(`**Thin Liquidity:** Market Cap is ${mcapLiqRatio.toFixed(0)}x liquidity.`);
    }
    if (token.priceChange24h > 100) {
      reasons.push(`**Parabolic Move:** Growth >100% in 24h.`);
    }

    // ─── 3. SIGNAL SYNERGY ─────────────────────────────
    let synergyTag = "";
    if (triggerType === 'trending_entry' && security.aiPrediction === 'BULLISH') {
      synergyTag = " [POWER SIGNAL]";
    } else if (triggerType === 'new_listing' && token.liquidity > 50000) {
      synergyTag = " [QUALITY START]";
    }

    // ─── 1. RELATIVE SIGNIFICANCE (IMPACT) ──────────────
    const impactLevel = volLiqRatio > 5 ? 'EXTREME' : volLiqRatio > 1 ? 'HIGH' : 'NORMAL';

    const header = isPublic 
      ? `📢 **BIRDEYE GLOBAL ALPHA FEED**\n` 
      : `🚨 **Birdeye Catalyst Alarm**\n`;

    const triggerInfo = `${triggerEmoji[triggerType] || '🔔'} **${triggerLabel[triggerType] || triggerType}** [${chain.toUpperCase()}]${synergyTag}\n\n`;

    let msg = header + triggerInfo;

    // 1. Token Info
    msg += `**${token.name} (${token.symbol})**\n` +
           `Address: \`${token.address}\`\n\n`;

    // 2. Market Data
    const price = marketData?.price ? `$${marketData.price.toFixed(marketData.price < 0.01 ? 8 : 4)}` : 'N/A';
    const change = token.priceChange24h !== undefined ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%` : 'N/A';
    const changeEmoji = token.priceChange24h > 0 ? '🟢' : token.priceChange24h < 0 ? '🔴' : '⚪';
    const mcap = marketData?.marketCap ? `$${(marketData.marketCap / 1_000_000).toFixed(2)}M` : 'N/A';

    msg += `📊 **MARKET DATA**\n` +
           `├─ Price: ${price}\n` +
           `├─ 24h Chg: ${change} ${changeEmoji}\n` +
           `├─ M.Cap: ${mcap}\n` +
           `└─ Liq: $${token.liquidity?.toLocaleString('en-US') || 0}\n\n`;

    // 🎯 ALERT REASONING
    if (reasons.length > 0) {
      msg += `🎯 **WHY THIS ALERT?**\n`;
      reasons.forEach(r => msg += `• ${r}\n`);
      msg += `\n`;
    }

    msg += `Activity Intensity: **${impactLevel}** (${volLiqRatio.toFixed(2)}x Vol/Liq)\n\n`;

    // 3. AI Catalyst Insights
    if (security.catalystScore !== undefined) {
      const predictionEmoji = security.aiPrediction === 'BULLISH' ? '🟢' : security.aiPrediction === 'BEARISH' ? '🔴' : '🟡';
      msg += `🧠 **AI CATALYST INSIGHTS**\n` +
             `Score: ${security.catalystScore}/100 - **${security.aiPrediction || 'NEUTRAL'}** ${predictionEmoji}\n`;
      
      if (security.technicalTrace && security.technicalTrace.length > 0) {
        msg += `> *Technical Analysis:*\n`;
        security.technicalTrace.forEach(trace => {
          msg += `> • ${trace}\n`;
        });
      }
      msg += `\n`;
    }

    // 4. Security Status
    const mintIcon = security.noMintAuthority ? '✅' : '⚠️';
    const freezeIcon = security.noFreezeAuthority ? '✅' : '⚠️';
    const safetyLabel = security.securityScore > 80 ? 'Safe' : security.securityScore > 50 ? 'Moderate' : 'Risky';

    msg += `🛡️ **SECURITY STATUS**\n` +
           `├─ ${mintIcon} Mint Auth: ${security.noMintAuthority ? 'Disabled' : 'Enabled'}\n` +
           `├─ ${freezeIcon} Freeze Auth: ${security.noFreezeAuthority ? 'Disabled' : 'Enabled'}\n` +
           `├─ Concentration: ${security.top10HolderPercent?.toFixed(1) || '0.0'}% (Top 10)\n` +
           `└─ Score: ${security.securityScore}/100 (${safetyLabel})\n\n`;

    if (isPublic) {
      msg += `🚀 **PRO Alpha:** Upgrade for 10s polling and real-time alerts.\n` +
             `👉 [catalyst.syconlab.com/upgrade](https://catalyst.syconlab.com/upgrade)\n\n`;
    }

    msg += `--- \n` +
      `⚠️ Automated signal, NOT financial advice. DYOR.\n` +
      `_⏱ ${new Date(triggeredAt).toISOString()} | v2.3_`;

    return msg;
  }
}
}
