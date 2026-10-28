import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { AppConfig } from '../../config/app-config.js';
import { ELECTION_NAME } from '../../config/election.js';
import { publicRateLimit } from '../../middleware/rate-limit.js';
import { getPollDate } from '../../services/settings.js';

// PUBLIC, read-only, no session: only what the landing page shows (election name, poll date).
// Mounted before the session middleware (no cookie is set).

export function publicRouter(pool: Pool, config: AppConfig): Router {
  const router = Router();
  router.use(publicRateLimit(config.publicRateLimit));
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/info', async (_req, res) => {
    res.json({ election: ELECTION_NAME, pollDate: await getPollDate(pool, config.pollDateDefault) });
  });

  return router;
}
