import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';

export interface DbConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: DbSsl | undefined;
}

export interface DbSsl {
  ca: string;
  rejectUnauthorized: true;
}

/**
 * DB_SSL_CA is either the CA certificate itself (PEM text, as pasted into Render; literal "\n"
 * sequences are accepted) or a path to the .pem file. Undefined = plain connection (local Docker).
 * The server certificate is always verified against this CA.
 */
export function dbSslFromEnv(value: string | undefined): DbSsl | undefined {
  if (value === undefined) return undefined;
  const ca = value.includes('-----BEGIN') ? value.replace(/\\n/g, '\n') : readFileSync(value, 'utf8');
  if (!ca.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('DB_SSL_CA is neither a PEM certificate nor a path to one');
  }
  return { ca, rejectUnauthorized: true };
}

/** Warnings for the Aiven fallbacks; printed by the server at startup and by the setup scripts. */
export function dbFallbackWarnings(env: {
  DB_FALLBACK_ADMIN_AS_APP_USER: 'true' | 'false';
  DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS: 'true' | 'false';
}): string[] {
  const warnings: string[] = [];
  if (env.DB_FALLBACK_ADMIN_AS_APP_USER === 'true') {
    warnings.push(
      'WARNING: DB_FALLBACK_ADMIN_AS_APP_USER=true - the app connects as the database ADMIN user; ' +
        'least-privilege table grants are NOT in force. Demo use only.',
    );
  }
  if (env.DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS === 'true') {
    warnings.push(
      'WARNING: DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS=true - audit_log and step_report_history are NOT ' +
        'protected by append-only triggers. Demo use only.',
    );
  }
  return warnings;
}

// Forced on every new connection so a mis-configured server can never silently weaken
// data checks (non-strict mode would turn a negative vote into 0 instead of rejecting it).
export const SESSION_SQL_MODE = [
  'STRICT_ALL_TABLES',
  'NO_ZERO_IN_DATE',
  'NO_ZERO_DATE',
  'ERROR_FOR_DIVISION_BY_ZERO',
  'NO_ENGINE_SUBSTITUTION',
  'ONLY_FULL_GROUP_BY',
].join(',');

export const SESSION_INIT_SQL = `SET SESSION time_zone = '+05:30', sql_mode = '${SESSION_SQL_MODE}'`;

export function createPool({ ssl, ...config }: DbConnectionConfig): Pool {
  const pool = mysql.createPool({
    ...config,
    ...(ssl ? { ssl } : {}),
    timezone: '+05:30',
    charset: 'UTF8MB4_UNICODE_CI',
    connectionLimit: 5, // small: free cloud MySQL plans allow few connections
    waitForConnections: true,
    connectTimeout: 5000,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
  });

  // The promise pool re-emits the core connection, so listen on the core pool for correct typing.
  pool.pool.on('connection', (connection) => {
    connection.query(SESSION_INIT_SQL, (err) => {
      if (err) {
        console.error('DB session init failed; dropping connection:', err.message);
        connection.destroy();
      }
    });
  });

  return pool;
}
