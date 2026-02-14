/**
 * Express Application Module
 */

import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { CORS_DEFAULTS } from '@capybara-chat/types';

export interface CorsConfig {
  origin: string[] | false;
  credentials: boolean;
}

export function getCorsConfig(): CorsConfig {
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : process.env.NODE_ENV === 'production'
      ? [...CORS_DEFAULTS.PRODUCTION_ORIGINS]
      : [...CORS_DEFAULTS.DEVELOPMENT_ORIGINS];

  return {
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  };
}

export function createExpressApp(corsConfig?: CorsConfig): Express {
  const app = express();
  const config = corsConfig ?? getCorsConfig();

  app.use(cors(config));
  app.use(express.json());
  app.use(cookieParser());

  return app;
}
