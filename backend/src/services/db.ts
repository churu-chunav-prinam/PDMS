import type { Pool, PoolConnection } from 'mysql2/promise';

export type Db = Pool | PoolConnection;

/** Runs `work` in one transaction: commit on success, rollback on any error. */
export async function inTransaction<T>(
  pool: Pool,
  work: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const value = await work(conn);
    await conn.commit();
    return value;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
