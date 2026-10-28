import dotenv from 'dotenv';
import { z } from 'zod';

// Every environment variable is validated here. On failure only the variable NAME and the kind
// of problem are reported; values are never printed (they may be secrets).

const nonEmpty = z.string().trim().min(1);
const identifier = nonEmpty.regex(/^[a-z0-9_]+$/, 'must contain only a-z, 0-9 and _');
const password = z.string().min(12, 'must be at least 12 characters');
const port = z.coerce.number().int().min(1).max(65535);
const isoDate = nonEmpty.regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const dbConnection = { DB_HOST: nonEmpty, DB_PORT: port, DB_NAME: identifier };

/** An origin exactly as the browser sends it: scheme://host[:port], no path or trailing slash. */
const origin = nonEmpty.refine((value) => {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}, 'must be an origin like https://poll.example.in (no path, no trailing slash)');

const trustProxy = z
  .string()
  .trim()
  .regex(/^(false|loopback|[1-9])$/, 'must be false, loopback or a hop count (1-9); never true')
  .transform((v): false | 'loopback' | number =>
    v === 'false' ? false : v === 'loopback' ? 'loopback' : Number(v),
  );

export const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: port,
  ...dbConnection,
  DB_APP_USER: identifier,
  DB_APP_PASSWORD: password,
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
  APP_ORIGIN: origin,
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(60),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(24).default(20),
  TRUST_PROXY: trustProxy.default(false),
  POLL_DATE: isoDate,
  FRONTEND_DIST: nonEmpty.default('../frontend/dist'),
  /** Login attempts per IP per 15 minutes. Officers share mobile-carrier IPs: keep it generous;
   *  the per-account lockout is the main defence. */
  LOGIN_RATE_LIMIT_PER_15MIN: z.coerce.number().int().min(5).max(10_000).default(300),
  /** Lets `npm run demo:poll` run in production (presentation only). MUST be false for real use. */
  DEMO_ALLOWED: z.enum(['true', 'false']).default('false'),
});
export type AppEnv = z.infer<typeof appEnvSchema>;

export const migrationEnvSchema = z.object({
  ...dbConnection,
  DB_NAME_TEST: identifier.regex(/_test$/, 'must end with _test'),
  DB_MIGRATION_USER: identifier,
  DB_MIGRATION_PASSWORD: password,
  DB_APP_USER: identifier,
});
export type MigrationEnv = z.infer<typeof migrationEnvSchema>;

export type EnvResult<T> = { ok: true; env: T } | { ok: false; problems: string[] };

/** Pure: validates `raw` against `schema`; problems are safe to print (names only). */
export function parseEnv<T extends z.ZodObject>(
  schema: T,
  raw: NodeJS.ProcessEnv,
): EnvResult<z.infer<T>> {
  const cleaned: Record<string, string> = {};
  for (const key of Object.keys(schema.shape)) {
    const value = raw[key];
    if (value !== undefined && value !== '') cleaned[key] = value;
  }
  const result = schema.safeParse(cleaned);
  if (result.success) return { ok: true, env: result.data };
  const problems = result.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? '(unknown)');
    return name in cleaned ? `${name} is invalid: ${issue.message}` : `${name} is missing`;
  });
  return { ok: false, problems: [...new Set(problems)].sort() };
}

/** Loads backend/.env (relative to cwd), validates, and exits the process on failure. */
export function loadEnvOrExit<T extends z.ZodObject>(schema: T): z.infer<T> {
  dotenv.config({ quiet: true });
  const result = parseEnv(schema, process.env);
  if (!result.ok) {
    console.error('Configuration error: fix these environment variables (see backend/.env.example):');
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  return result.env;
}
