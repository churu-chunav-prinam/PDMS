import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createPool } from '../../src/config/db.js';
import { APP_TABLE_PRIVILEGES } from '../../src/db/grants.js';
import { loadTestEnv } from './env.js';

export const testEnv = loadTestEnv();

const APPEND_ONLY_TABLES = new Set(
  Object.entries(APP_TABLE_PRIVILEGES)
    .filter(([, privileges]) => !privileges.includes('DELETE'))
    .map(([table]) => table),
);

function pool(user: string, password: string): Pool {
  return createPool({ host: testEnv.DB_HOST, port: testEnv.DB_PORT, database: testEnv.TEST_DB, user, password });
}
export const createTestAppPool = () => pool(testEnv.DB_APP_USER, testEnv.DB_APP_PASSWORD);
export const createTestMigrationPool = () => pool(testEnv.DB_MIGRATION_USER, testEnv.DB_MIGRATION_PASSWORD);

async function assertTestDb(p: Pool): Promise<string> {
  const [rows] = await p.query<RowDataPacket[]>('SELECT DATABASE() AS db');
  const name: unknown = rows[0]?.db;
  if (typeof name !== 'string' || !name.endsWith('_test')) throw new Error('refused: not a *_test database');
  return name;
}

/** Empties every app table (migration user; append-only tables are truncated, which skips triggers). */
export async function resetData(migrationPool: Pool): Promise<void> {
  await assertTestDb(migrationPool);
  const conn = await migrationPool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of Object.keys(APP_TABLE_PRIVILEGES)) {
      await conn.query(APPEND_ONLY_TABLES.has(table) ? 'TRUNCATE TABLE ??' : 'DELETE FROM ??', [table]);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

/** Used by global setup before rolling migrations back. */
export async function wipeAllData(migrationPool: Pool): Promise<void> {
  const name = await assertTestDb(migrationPool);
  const [tables] = await migrationPool.execute<RowDataPacket[]>(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT LIKE 'knex%'",
    [name],
  );
  const conn = await migrationPool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const row of tables) await conn.query('TRUNCATE TABLE ??', [String(row.t)]);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

export async function insert(p: Pool, sql: string, params: (string | number | null)[]): Promise<number> {
  const [result] = await p.execute<ResultSetHeader>(sql, params);
  return result.insertId;
}

export async function countRows(p: Pool, sql: string, params: (string | number)[] = []): Promise<number> {
  const [rows] = await p.execute<RowDataPacket[]>(sql, params);
  return Number(rows[0]?.n ?? 0);
}
