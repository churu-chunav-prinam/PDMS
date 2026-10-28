import type { RequestHandler } from 'express';
import type { Pool } from 'mysql2/promise';
import type { AppConfig } from '../config/app-config.js';
import { writeAudit } from '../services/audit.js';
import { loadActiveUser } from '../services/users.js';
import { clearSessionCookie, destroySession } from './session.js';

/**
 * After express-session, on every request: ends sessions past the absolute lifetime, then re-loads
 * the user from the DB so a disabled user loses access at once. Role always comes from the DB.
 */
export function currentUser(pool: Pool, config: AppConfig): RequestHandler {
  return async (req, res, next) => {
    const userId = req.session.userId;
    if (userId === undefined) {
      next();
      return;
    }
    const loginAt = req.session.loginAt;
    if (loginAt === undefined || Date.now() - loginAt > config.sessionAbsoluteMs) {
      await writeAudit(pool, {
        userId,
        action: 'SESSION_EXPIRED_ABSOLUTE',
        entity: 'users',
        entityId: userId,
        ip: req.ip ?? null,
      });
      await destroySession(req);
      clearSessionCookie(res, config);
      res.status(401).json({ error: 'SESSION_EXPIRED' });
      return;
    }
    const user = await loadActiveUser(pool, userId);
    if (!user) {
      await destroySession(req);
      clearSessionCookie(res, config);
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }
    req.user = user;
    next();
  };
}
