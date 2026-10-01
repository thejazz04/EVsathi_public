import admin from 'firebase-admin';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

let firebaseAdmin = null;

const firebaseEnabled = process.env.FIREBASE_ENABLED === 'true';

if (firebaseEnabled) {
  try {
    const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'config/firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      logger.info('Firebase Admin SDK Initialized for Push Notifications');
    } else {
      logger.warn(`Firebase service account file not found at ${serviceAccountPath}. Push notifications will log locally.`);
    }
  } catch (err) {
    logger.warn('Failed to initialize Firebase Admin SDK', { error: err.message });
  }
} else {
  logger.info('Firebase Admin SDK disabled (FIREBASE_ENABLED=false)');
}

export const getFirebaseAdmin = () => firebaseAdmin;
