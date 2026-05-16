import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não definida no .env');

  mongoose.connection.on('connected', () => logger.info('✅ MongoDB conectado'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB erro', { err }));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB desconectado, reconectando...'));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB desconectado');
}
