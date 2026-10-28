import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import type { AppConfig } from '../../config/app-config.js';
import { requireAuth, userOf } from '../../middleware/auth.js';
import { ensureCsrfToken, rotateCsrfToken } from '../../middleware/csrf.js';
import { loginRateLimit } from '../../middleware/rate-limit.js';
import {
  clearSessionCookie,
  destroySession,
  regenerateSession,
  saveSession,
} from '../../middleware/session.js';
import { writeAudit } from '../../services/audit.js';
import { usernameField } from '../../services/credential-rules.js';
import { attemptLogin } from './auth.service.js';
import type { LoginOutcome } from './auth.service.js';

// The column collation is case-insensitive, so "rtg-045" finds "RTG-045".
export const loginBody = z
  .object({
    username: usernameField,
    password: z.string().min(1).max(128),
  })
  .strict();

export function authRouter(pool: Pool, config: AppConfig): Router {
  const router = Router();
  const limitLogins = loginRateLimit(config.loginRateLimit);

  /** Errors, or a new session id + new CSRF token. */
  async function finishLogin(req: Request, res: Response, outcome: LoginOutcome): Promise<void> {
    if (outcome.kind === 'invalid') {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }
    if (outcome.kind === 'locked') {
      res.status(423).json({ error: 'ACCOUNT_LOCKED', retryAfterSeconds: outcome.retryAfterSeconds });
      return;
    }
    await regenerateSession(req); // no session fixation
    req.session.userId = outcome.user.id;
    req.session.loginAt = Date.now();
    const csrfToken = rotateCsrfToken(req);
    await saveSession(req);
    res.json({ user: outcome.user, csrfToken });
  }

  /** CSRF token for this session (creates the session if needed). Fetch again after login/logout. */
  router.get('/csrf', (req, res) => {
    res.json({ csrfToken: ensureCsrfToken(req) });
  });

  router.post('/login', limitLogins, async (req, res) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_FAILED' });
      return;
    }
    await finishLogin(req, res, await attemptLogin(pool, parsed.data.username, parsed.data.password, req.ip ?? null));
  });

  router.post('/logout', async (req, res) => {
    if (req.user) {
      await writeAudit(pool, {
        userId: req.user.id,
        action: 'LOGOUT',
        entity: 'users',
        entityId: req.user.id,
        ip: req.ip ?? null,
      });
    }
    await destroySession(req);
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: userOf(req) });
  });

  return router;
}
