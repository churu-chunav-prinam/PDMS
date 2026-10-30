// One-time database setup for a managed MySQL (Aiven), run from a laptop as the ADMIN user:
//   ENV_FILE=.env.aiven npm run db:init
// Creates DB_NAME and the least-privilege app user (no privileges here; `migrate` grants them),
// then checks that CREATE TRIGGER is allowed. If either is refused, nothing is weakened silently:
// it stops and names the env fallback flag to set.
import mysql from 'mysql2/promise';
import { z } from 'zod';
import { dbSslFromEnv } from '../src/config/db.js';
import { loadEnvOrExit, migrationEnvSchema } from '../src/config/env.js';
import { isMainModule } from './lib/script-db.js';

const initEnvSchema = migrationEnvSchema.extend({ DB_APP_PASSWORD: z.string().min(12) });

async function main(): Promise<boolean> {
  const env = loadEnvOrExit(initEnvSchema);
  const ssl = dbSslFromEnv(env.DB_SSL_CA);
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_MIGRATION_USER,
    password: env.DB_MIGRATION_PASSWORD,
    ...(ssl ? { ssl } : {}),
    connectTimeout: 15_000,
  });
  let ok = true;
  try {
    await conn.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [
      env.DB_NAME,
    ]);
    console.log(`Database ${env.DB_NAME}: ready`);

    if (env.DB_FALLBACK_ADMIN_AS_APP_USER === 'true') {
      console.warn('WARNING: DB_FALLBACK_ADMIN_AS_APP_USER=true - no separate app user is created.');
    } else {
      try {
        await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [env.DB_APP_USER, '%', env.DB_APP_PASSWORD]);
        await conn.query('ALTER USER ?@? IDENTIFIED BY ?', [env.DB_APP_USER, '%', env.DB_APP_PASSWORD]);
        console.log(`App user ${env.DB_APP_USER}: ready (table grants are applied by npm run migrate)`);
      } catch (err) {
        ok = false;
        console.error(`FAILED to create app user: ${err instanceof Error ? err.message : String(err)}`);
        console.error(
          'Fallback (demo only): set DB_APP_USER=<admin user>, DB_APP_PASSWORD=<admin password> and ' +
            'DB_FALLBACK_ADMIN_AS_APP_USER=true in .env.aiven AND on Render, then re-run.',
        );
      }
    }

    if (env.DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS !== 'true') {
      await conn.query('USE ??', [env.DB_NAME]);
      try {
        await conn.query('CREATE TABLE IF NOT EXISTS zz_trigger_probe (id INT PRIMARY KEY)');
        await conn.query(
          "CREATE TRIGGER zz_trigger_probe_no_delete BEFORE DELETE ON zz_trigger_probe FOR EACH ROW SIGNAL SQLSTATE '45000'",
        );
        console.log('CREATE TRIGGER: allowed (append-only triggers will be created by migrate)');
      } catch (err) {
        ok = false;
        console.error(`FAILED: CREATE TRIGGER refused: ${err instanceof Error ? err.message : String(err)}`);
        console.error(
          'Fallback (demo only): set DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS=true in .env.aiven AND on Render, then re-run.',
        );
      } finally {
        await conn.query('DROP TABLE IF EXISTS zz_trigger_probe');
      }
    }
  } finally {
    await conn.end();
  }
  return ok;
}

if (isMainModule(import.meta.url)) {
  main().then(
    (ok) => {
      process.exitCode = ok ? 0 : 1;
    },
    (err: unknown) => {
      console.error('FAILED:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    },
  );
}
