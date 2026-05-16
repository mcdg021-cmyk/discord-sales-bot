import 'dotenv/config';
import { BotClient } from './client';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  logger.info('🚀 Iniciando Discord Sales Bot...');

  try {
    await connectDatabase();
    await connectRedis();

    const client = new BotClient();
    await client.initialize();

    process.on('SIGINT', async () => {
      logger.info('🛑 Encerrando bot gracefully...');
      client.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 SIGTERM recebido, encerrando...');
      client.destroy();
      process.exit(0);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Falha ao iniciar o bot', { error });
    process.exit(1);
  }
}

bootstrap();
