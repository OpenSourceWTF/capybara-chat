
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SERVER_DEFAULTS, CORS_DEFAULTS } from '@capybara-chat/types';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env.local') });

export const CONFIG = {
  PORT: process.env.PORT || SERVER_DEFAULTS.SERVER_PORT,
  DATABASE_PATH: process.env.DATABASE_PATH,

  // Auth
  API_KEY: process.env.CAPYBARA_API_KEY,
  ALLOW_DEV_KEY: process.env.ALLOW_DEV_KEY === 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret',
  ADMIN_GITHUB_ID: process.env.ADMIN_GITHUB_ID,
  ADMIN_GITHUB_LOGIN: process.env.ADMIN_GITHUB_LOGIN,

  // CORS
  CORS: {
    ORIGIN: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim())
      : process.env.NODE_ENV === 'production'
        ? [...CORS_DEFAULTS.PRODUCTION_ORIGINS]
        : [...CORS_DEFAULTS.DEVELOPMENT_ORIGINS],
    CREDENTIALS: true,
  }
};
