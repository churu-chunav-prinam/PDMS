import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { Pool } from 'mysql2/promise';
import { createPool, dbFallbackWarnings, dbSslFromEnv } from '../../src/config/db.js';
import { appEnvSchema, loadEnvOrExit } from '../../src/config/env.js';
import type { AppEnv } from '../../src/config/env.js';

/** CLI scripts connect as the least-privilege app user, like the server. */
export function scriptPool(env: AppEnv): Pool {
  return createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_APP_USER,
    password: env.DB_APP_PASSWORD,
    ssl: dbSslFromEnv(env.DB_SSL_CA),
  });
}

export function isMainModule(url: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && url === pathToFileURL(resolve(entry)).href;
}

/** Runs a script body with env + pool; exit code 1 on failure or when it returns false. */
export async function runScript(body: (pool: Pool, env: AppEnv) => Promise<boolean>): Promise<void> {
  const env = loadEnvOrExit(appEnvSchema);
  for (const warning of dbFallbackWarnings(env)) console.warn(warning);
  const pool = scriptPool(env);
  try {
    process.exitCode = (await body(pool, env)) ? 0 : 1;
  } catch (err) {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
