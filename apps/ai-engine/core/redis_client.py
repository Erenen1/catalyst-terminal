import os
import redis
import json
import logging

logger = logging.getLogger(__name__)

class RedisCache:
    def __init__(self):
        # Fallback to local redis if REDIS_URL is not set
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        try:
            self.client = redis.Redis.from_url(redis_url, decode_responses=True)
            # Ping to check connection
            self.client.ping()
            self.enabled = True
            logger.info("Connected to Redis cache successfully.")
        except Exception as e:
            self.enabled = False
            logger.warning(f"Redis cache disabled or unreachable: {e}")

    def get_analysis(self, token_address: str):
        if not self.enabled: return None
        try:
            data = self.client.get(f"catalyst:analysis:{token_address}")
            return json.loads(data) if data else None
        except Exception:
            return None

    def set_analysis(self, token_address: str, data: dict, expire_seconds: int = 60):
        if not self.enabled: return
        try:
            self.client.setex(f"catalyst:analysis:{token_address}", expire_seconds, json.dumps(data))
        except Exception:
            pass
