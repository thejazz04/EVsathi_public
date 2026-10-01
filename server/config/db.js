import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export const maskMongoUri = (uri) => {
  if (!uri) return 'undefined';
  return uri.replace(/:([^@]+)@/, ':****@');
};

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    logger.error('DATABASE CONNECTION FAILED: MONGODB_URI is not defined in environment variables.');
    return null;
  }

  // Support explicit test memory server fallback ONLY if process.env.USE_MEMORY_DB === 'true'
  if (process.env.USE_MEMORY_DB === 'true') {
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoMemoryInstance = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryInstance.getUri();
      const conn = await mongoose.connect(memoryUri, { autoIndex: true });
      logger.info(`MongoDB Connected via MongoMemoryServer (Test Mode): ${memoryUri}`);
      return conn;
    } catch (memErr) {
      logger.error('DATABASE CONNECTION FAILED (Memory DB)', { error: memErr.message });
      return null;
    }
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 30000, // Increased from 5000ms to 30000ms
      socketTimeoutMS: 45000, // Socket timeout
      connectTimeoutMS: 30000, // Connection timeout
      maxPoolSize: 10, // Connection pool size
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
    });

    logger.info(`MongoDB Atlas Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error(`DATABASE CONNECTION FAILED (${maskMongoUri(mongoUri)})`, {
      error: error.message,
    });
    return null;
  }
};

export default connectDB;
