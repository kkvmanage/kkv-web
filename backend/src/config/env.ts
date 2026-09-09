import dotenv from 'dotenv';
import path from 'path';

// Multi-path .env resolution
const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(currentDir, '.env'),
  path.resolve(currentDir, '../.env'),
  path.resolve(currentDir, '../../.env'),
  path.resolve(currentDir, '../backend/.env')
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath, override: true });
}

// Canonical MongoDB URI resolution
const resolvedMongoUri = (
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/kkv_gold_finance')
).trim();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8080', 10),
  CORS_ORIGIN: process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '',
  JWT_SECRET: process.env.JWT_SECRET || 'kkv_gold_finance_rbac_secure_jwt_secret_2026_super_key_512',
  JWT_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m',
  ADMIN_NAME: (process.env.ADMIN_NAME || 'KKV Master Admin').trim(),
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@kkvgoldfinance.com').trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@123456',
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || path.resolve(process.cwd(), 'data'),
  MONGODB_URI: resolvedMongoUri,
  MONGODB_DB_NAME: (process.env.MONGODB_DB_NAME || 'kkv_gold_finance').trim(),
  RENTAL_MONGODB_DB_NAME: (process.env.RENTAL_MONGODB_DB_NAME || process.env.MONGODB_DB_NAME || 'kkv_gold_finance').trim(),
};

export function validateStartupConfig(): { isValid: boolean; missingVars: string[] } {
  const missingVars: string[] = [];
  if (!env.MONGODB_URI) missingVars.push('MONGODB_URI');

  return {
    isValid: missingVars.length === 0,
    missingVars
  };
}

export default env;
