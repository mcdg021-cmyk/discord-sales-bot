import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não definida');

  mongoose.connection.on('connected', () => logger.info('✅ MongoDB conectado'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB erro', { err }));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    maxPoolSize: 5,
  });
}