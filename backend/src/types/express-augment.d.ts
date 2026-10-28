import type { AuthUser } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    /** Epoch milliseconds of the login; enforces the absolute session lifetime. */
    loginAt: number;
    csrfToken: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Set by the current-user middleware for a valid, active, logged-in session. */
      user?: AuthUser;
    }
  }
}

export {};
