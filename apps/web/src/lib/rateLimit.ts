import { getRedisClient } from './redis';

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ success: boolean; remaining: number }> {
  try {
    const redis = await getRedisClient();
    const redisKey = `ratelimit:${key}`;
    
    const count = await redis.incr(redisKey);
    
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count)
    };
  } catch (err) {
    console.error('Rate limit error:', err);
    return { success: true, remaining: limit }; // Fail open to not block users on redis error
  }
}
