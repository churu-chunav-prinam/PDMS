import express from 'express';
import helmet from 'helmet';
import type { Express } from 'express';
import type { Pool } from 'mysql2/promise';
import type { AppConfig } from './config/app-config.js';
import { csrfCheck } from './middleware/csrf.js';
import { currentUser } from './middleware/current-user.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { originCheck } from './middleware/origin.js';
import { apiRateLimit } from './middleware/rate-limit.js';
import { createSessionStore, sessionMiddleware } from './middleware/session.js';
import type { SessionStore } from './middleware/session.js';
import { UPLOAD_PATHS, adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { districtRouter } from './modules/district/district.routes.js';
import { frontendStatic } from './modules/frontend/static.js';
import { healthRouter } from './modules/health/health.routes.js';
import { officerRouter } from './modules/officer/officer.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { publicRouter } from './modules/public/public.routes.js';

export interface AppDeps {
  pool: Pool;
  config: AppConfig;
  sessionStore?: SessionStore;
}

export function createApp({ pool, config, sessionStore }: AppDeps): Express {
  const app = express();
  const store = sessionStore ?? createSessionStore(pool, { clearExpired: false });

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Strict CSP: everything from our own origin, no inline scripts, no framing.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      strictTransportSecurity: config.production ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      xFrameOptions: { action: 'deny' },
    }),
  );

  app.use('/api/health', healthRouter(pool));
  // Built frontend: static, GET only, before sessions (never touches a session).
  if (config.frontendDist !== null) app.use(frontendStatic(config.frontendDist));

  app.use('/api', apiRateLimit(config.apiRateLimit));
  // Public read-only lists: before the body parser and sessions, so they never read or set a cookie.
  app.use('/api/public', publicRouter(pool, config));
  const json = express.json({ limit: '100kb' });
  app.use((req, res, next) => {
    if (UPLOAD_PATHS.has(req.path)) next();
    else json(req, res, next);
  });
  app.use(sessionMiddleware(config, store));
  app.use(currentUser(pool, config));
  app.use(originCheck(config.appOrigin));
  app.use(csrfCheck);

  app.use('/api/auth', authRouter(pool, config));
  app.use('/api/admin', adminRouter(pool));
  app.use('/api/officer', officerRouter(pool));
  app.use('/api/district', districtRouter(pool, config));
  app.use('/api/profile', profileRouter(pool));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
