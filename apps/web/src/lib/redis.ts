import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

let redisClient: any;

export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err: any) => console.error('Redis Client Error', err));
    await redisClient.connect();
  }
  return redisClient;
}
