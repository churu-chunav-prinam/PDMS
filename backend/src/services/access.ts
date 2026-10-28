import type { RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../middleware/errors.js';
import type { AuthUser } from '../types/auth.js';
import type { Db } from './db.js';

/**
 * The single place that decides which booths a user may read or write.
 * DISTRICT_ADMIN: all. Everyone else: only booths in their user_booth rows.
 * A wrong booth answers 404 (not 403), so ids of other booths reveal nothing.
 */
export async function assertBoothAccess(db: Db, user: AuthUser, boothId: number): Promise<void> {
  if (user.role === 'DISTRICT_ADMIN') return;
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT 1 FROM user_booth WHERE user_id = ? AND booth_id = ?',
    [user.id, boothId],
  );
  if (rows.length === 0) throw new ApiError(404, 'BOOTH_NOT_FOUND');
}

/** The one booth of a POLLING_OFFICER (404 if none is assigned). */
export async function officerBoothId(db: Db, user: AuthUser): Promise<number> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT booth_id FROM user_booth WHERE user_id = ? ORDER BY booth_id',
    [user.id],
  );
  const first = rows[0];
  if (user.role !== 'POLLING_OFFICER' || rows.length !== 1 || !first) {
    throw new ApiError(404, 'BOOTH_NOT_FOUND');
  }
  return Number(first.booth_id);
}
