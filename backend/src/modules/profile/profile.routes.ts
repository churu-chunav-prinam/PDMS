import { Router } from 'express';
import type { Request } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { requireRole, userOf } from '../../middleware/auth.js';
import { parseInput } from '../../middleware/validate.js';
import { passwordField, usernameField } from '../../services/credential-rules.js';
import { changeOwnPassword, changeOwnUsername } from './profile.service.js';

const usernameBody = z.object({ currentPassword: passwordField, username: usernameField }).strict();
const passwordBody = z
  .object({ currentPassword: passwordField, password: passwordField, confirmPassword: passwordField })
  .strict()
  .refine((b) => b.password === b.confirmPassword, { message: 'PASSWORD_MISMATCH', path: ['confirmPassword'] });

/** The DISTRICT_ADMIN's own account. */
export function profileRouter(pool: Pool): Router {
  const router = Router();
  router.use(requireRole('DISTRICT_ADMIN'));
  const ctx = (req: Request) => ({ userId: userOf(req).id, ip: req.ip ?? null, sessionId: req.sessionID });

  router.post('/username', async (req, res) => {
    const body = parseInput(usernameBody, req.body);
    await changeOwnUsername(pool, ctx(req), body.currentPassword, body.username);
    res.status(204).end();
  });

  router.post('/password', async (req, res) => {
    const body = parseInput(passwordBody, req.body);
    await changeOwnPassword(pool, ctx(req), body.currentPassword, body.password);
    res.status(204).end();
  });

  return router;
}
