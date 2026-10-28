import type { Request, RequestHandler } from 'express';
import type { Role } from '../config/constants.js';
import type { AuthUser } from '../types/auth.js';
import { ApiError } from './errors.js';

/** 401 if not logged in; 403 unless the user has one of the given roles (none given = any role). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

export const requireAuth = requireRole();

/** The logged-in user inside a handler guarded by requireRole (throws if the guard was skipped). */
export function userOf(req: Request): AuthUser {
  if (!req.user) throw new ApiError(401, 'UNAUTHENTICATED');
  return req.user;
}
