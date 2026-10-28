import { resolve } from 'node:path';
import { findFrontendDist } from '../modules/frontend/static.js';
import type { AppEnv } from './env.js';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

/** Everything createApp() needs besides the DB pool. Built from env in server.ts; tests build their own. */
export interface AppConfig {
  production: boolean;
  sessionSecret: string;
  appOrigin: string;
  sessionIdleMs: number;
  sessionAbsoluteMs: number;
  trustProxy: false | 'loopback' | number;
  loginRateLimit: RateLimitConfig;
  apiRateLimit: RateLimitConfig;
  publicRateLimit: RateLimitConfig;
  frontendDist: string | null;
  /** POLL_DATE from env: used until the admin saves one in settings. */
  pollDateDefault: string;
}

export const LOGIN_RATE_LIMIT: RateLimitConfig = { limit: 30, windowMs: 15 * 60_000 };
// 1,359 officers may sit behind a few mobile-carrier NAT IPs: keep the per-IP API limit generous.
export const API_RATE_LIMIT: RateLimitConfig = { limit: 3000, windowMs: 60_000 };
/** Login dropdowns: ~4 requests per officer login; carrier NAT IPs again need headroom. */
export const PUBLIC_RATE_LIMIT: RateLimitConfig = { limit: 600, windowMs: 60_000 };

export function appConfigFromEnv(env: AppEnv): AppConfig {
  return {
    production: env.NODE_ENV === 'production',
    sessionSecret: env.SESSION_SECRET,
    appOrigin: env.APP_ORIGIN,
    sessionIdleMs: env.SESSION_IDLE_MINUTES * 60_000,
    sessionAbsoluteMs: env.SESSION_ABSOLUTE_HOURS * 3_600_000,
    trustProxy: env.TRUST_PROXY,
    loginRateLimit: { limit: env.LOGIN_RATE_LIMIT_PER_15MIN, windowMs: LOGIN_RATE_LIMIT.windowMs },
    apiRateLimit: API_RATE_LIMIT,
    publicRateLimit: PUBLIC_RATE_LIMIT,
    frontendDist: findFrontendDist(resolve(process.cwd(), env.FRONTEND_DIST)),
    pollDateDefault: env.POLL_DATE,
  };
}
