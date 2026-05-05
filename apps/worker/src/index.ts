import path from 'path';
import dotenv from 'dotenv';

// Konteynır içinde veya yerelde .env dosyasını garantili bul
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { createClient } from 'redis';
import { Queue } from 'bullmq';
import { MongoRuleRepository } from './repositories/MongoRuleRepository';
import { BirdeyeService } from './services/BirdeyeService';
import { RuleEngine } from './engine/RuleEngine';
import { TelegramProvider } from './dispatchers/providers/TelegramProvider';
import { CustomWebhookProvider } from './dispatchers/providers/CustomWebhookProvider';
import { NotificationDispatcher } from './dispatchers/NotificationDispatcher';
import { TelegramBotService } from './services/TelegramBotService';
import { GlobalWatcherService } from './services/GlobalWatcherService';
import type { NotificationJobPayload } from '@chaintrigger/shared';

const QUEUE_NAME = 'notifications';

async function bootstrap() {
  console.log('🚀 Birdeye Catalyst Worker başlatılıyor...');

  const mongoUri = process.env.MONGO_URI || 'mongodb://mongodb:27017/chaintrigger';
  const redisHost = process.env.REDIS_HOST || 'redis';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const birdeyeApiKey = process.env.BIRDEYE_API_KEY;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

  // Debug: Değişkenlerin kaynağını doğrula
  if (birdeyeApiKey) {
    console.log(`[Config] Birdeye API Key detected from System Environment: ${birdeyeApiKey.slice(0, 4)}...${birdeyeApiKey.slice(-4)}`);
  } else {
    console.warn('[Config] ⚠️ Birdeye API Key MISSING from environment! Using fallback.');
  }

  if (telegramBotToken) {
    console.log(`[Config] Telegram Token detected from System Environment: ${telegramBotToken.slice(0, 6)}...`);
  } else {
    console.warn('[Config] ⚠️ Telegram Token MISSING from environment! Using fallback.');
  }

  const finalBirdeyeKey = birdeyeApiKey || 'test_api_key';
  const finalTelegramToken = telegramBotToken || 'test_bot_token';

  // 1. Veritabanı Bağlantıları
  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB bağlantısı başarılı.');

  const redisClient = createClient({ url: `redis://${redisHost}:${redisPort}` });
  await redisClient.connect();
  console.log('✅ Redis cache bağlantısı başarılı.');

  // 2. Bağımlılık Enjeksiyonu (Dependency Injection)
  const ruleRepo = new MongoRuleRepository();
  const birdeyeService = new BirdeyeService(finalBirdeyeKey, redisClient);

  // Queue Oluşturma (Engine job ekler, Dispatcher dinler)
  const notificationQueue = new Queue<NotificationJobPayload>(QUEUE_NAME, {
    connection: { host: redisHost, port: redisPort },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  });

  // 3. Engine, Dispatcher ve Global Watcher Başlatma
  const ruleEngine = new RuleEngine(ruleRepo, birdeyeService, notificationQueue, redisClient);

  const dispatcher = new NotificationDispatcher(
    { host: redisHost, port: redisPort },
    [
      new TelegramProvider(finalTelegramToken),
      new CustomWebhookProvider()
    ]
  );

  const globalWatcher = new GlobalWatcherService(ruleRepo, birdeyeService, ruleEngine);

  // 4. Telegram Bot Service (For deep-linking /start)
  const telegramBotService = new TelegramBotService(finalTelegramToken);


  console.log('⚙️ Worker Engine aktif. Global Watcher başlatılıyor...');

  // 4. Global Watcher Döngüleri (Polling)
  await globalWatcher.start();

  // Graceful Shutdown
  process.on('SIGINT', async () => {
    console.log('🔴 Kapatılıyor...');
    await globalWatcher.stopAll();
    await telegramBotService.stop();
    await dispatcher.close();
    await redisClient.disconnect();
    await mongoose.disconnect();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('Başlatma hatası:', err);
  process.exit(1);
});


