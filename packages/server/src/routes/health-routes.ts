/**
 * Health Check Routes
 *
 * Simple endpoints for liveness and readiness probes.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';

export function createHealthRoutes(): Router {
  const router = Router();

  // GET /health - Basic liveness check
  router.get('/', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // GET /health/ready - Readiness check (can be expanded to check DB)
  router.get('/ready', asyncHandler(async (req, res) => {
    // TODO: Add DB ping if needed
    res.json({ status: 'ready' });
  }));

  return router;
}
