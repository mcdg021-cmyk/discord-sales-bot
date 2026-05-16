import http from 'http';
import 'dotenv/config';

// Servidor HTTP para o Render
http.createServer((_, res) => res.end('Bot online!')).listen(process.env.PORT || 3000);

async function bootstrap(): Promise<void> {
  const { BotClient } = await import('./client');
  const { connectDatabase } = await import('./config/database');
  const { connectRedis } = await import('./config/redis');
  const { logger } = await import('./utils/logger');

  logger.info('🚀 Iniciando Discord Sales Bot...');

  // Tentar conectar MongoDB sem travar o bot
  connectDatabase().catch((err) => {
    logger.error('MongoDB falhou, tentando novamente em 30s...', { err: err.message });
    setTimeout(() => connectDatabase().catch(() => {}), 30000);
  });

  // Tentar conectar Redis sem travar o bot  
  connectRedis().catch((err) => {
    logger.warn('Redis falhou', { err: err.message });
  });

  const client = new BotClient();
  await client.initialize();
}

bootstrap().catch(console.error);