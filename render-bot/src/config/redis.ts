import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redis: Redis;

export async function connectRedis(): Promise<void> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  
  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    tls: url.startsWith('rediss://') ? {} : undefined,
  });

  redis.on('connect', () => logger.info('✅ Redis conectado'));
  redis.on('error', (err) => logger.error('Redis erro', { err: err.message }));

  await redis.connect();
}

export function getRedis(): Redis {
  if (!redis) throw new Error('Redis não inicializado.');
  return redis;
}