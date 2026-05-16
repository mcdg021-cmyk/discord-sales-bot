import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redis: Redis;

export async function connectRedis(): Promise<void> {
  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redis.on('connect', () => logger.info('✅ Redis conectado'));
  redis.on('error', (err) => logger.error('Redis erro', { err }));

  await redis.connect();
}

export function getRedis(): Redis {
  if (!redis) throw new Error('Redis não inicializado. Chame connectRedis() primeiro.');
  return redis;
}
