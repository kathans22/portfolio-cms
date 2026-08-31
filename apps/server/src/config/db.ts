import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URI as string);
  logger.info('MongoDB connected');
}

export function dbState() {
  // 1 = connected — used by the health check endpoint
  return mongoose.connection.readyState;
}

// A real round-trip to MongoDB, not just a readyState check — used by the health
// check endpoint so it also keeps a free-tier Atlas cluster from scaling to zero.
export async function pingDB(): Promise<boolean> {
  try {
    if (!mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
