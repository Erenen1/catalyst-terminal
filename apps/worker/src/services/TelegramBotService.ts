import TelegramBot from 'node-telegram-bot-api';
import { UserModel, RuleModel } from '@chaintrigger/shared';

export class TelegramBotService {
  private bot: TelegramBot;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupListeners();
    console.log('🤖 Telegram Bot Service started with polling.');
  }

  private setupListeners() {
    this.bot.onText(/\/start (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const verificationToken = match?.[1];
      const username = msg.from?.username || msg.from?.first_name || 'User';

      if (!verificationToken) return;

      try {
        let user = await UserModel.findOneAndUpdate(
          { telegramVerificationToken: verificationToken },
          { 
            telegramChatId: chatId,
            telegramUsername: username,
            telegramVerificationToken: null // Clear token after use
          },
          { new: true }
        );

        if (user) {
          // Check for Referral Reward
          const ruleCount = await RuleModel.countDocuments({ userId: user.walletAddress.toLowerCase() });
          
          // Safety Check: Has this Telegram account ever claimed a reward before?
          const isTelegramUsed = await UserModel.findOne({ 
            telegramChatId: chatId, 
            isReferralRewardClaimed: true 
          });

          if (ruleCount >= 1 && user.referredBy && !user.isReferralRewardClaimed && !isTelegramUsed) {
            const rewardDays = 7;
            const rewardMs = rewardDays * 24 * 60 * 60 * 1000;
            
            // Update Referrer
            const referrer = await UserModel.findOne({ referralCode: user.referredBy });
            if (referrer) {
              const newProUntil = new Date(Math.max(
                referrer.proUntil?.getTime() || Date.now(),
                Date.now()
              ) + rewardMs);
              
              await UserModel.updateOne(
                { _id: referrer._id },
                { $set: { proUntil: newProUntil, tier: 'pro' } }
              );
            }

            // Update Referee (Current User)
            const newUserProUntil = new Date(Date.now() + rewardMs);
            user = await UserModel.findOneAndUpdate(
              { _id: user._id },
              { $set: { proUntil: newUserProUntil, tier: 'pro', isReferralRewardClaimed: true } },
              { new: true }
            );

            await this.bot.sendMessage(chatId, `🎉 *Referral Bonus Activated!*\n\nYou and your referrer have both been granted *${rewardDays} days of PRO access*. Enjoy premium features!`, { parse_mode: 'Markdown' });
          }

          await this.bot.sendMessage(chatId, `✅ *Connection Successful!*\n\nYour wallet \`${user!.walletAddress}\` is now linked to this Telegram account. You will receive on-chain alerts here.`, { parse_mode: 'Markdown' });
        } else {
          await this.bot.sendMessage(chatId, '❌ *Invalid or expired token.*\nPlease try linking again from the dashboard.');
        }
      } catch (error) {
        console.error('Error in telegram verification:', error);
        await this.bot.sendMessage(chatId, '⚠️ An error occurred during verification.');
      }
    });

    this.bot.onText(/\/start$/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, '👋 *Welcome to Birdeye Catalyst!*\n\nTo link your account, please use the "Connect Telegram" button on the dashboard.', { parse_mode: 'Markdown' });
    });
  }

  public async stop() {
    await this.bot.stopPolling();
  }
}
