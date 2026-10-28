import type { RowDataPacket } from 'mysql2/promise';
import type { Role } from '../config/constants.js';
import type { AuthUser } from '../types/auth.js';
import type { Db } from './db.js';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: number;
}

/** The active user with this id, or null if it does not exist or is disabled. */
export async function loadActiveUser(db: Db, userId: number): Promise<AuthUser | null> {
  const [rows] = await db.execute<UserRow[]>(
    'SELECT id, username, full_name, role, is_active FROM users WHERE id = ?',
    [userId],
  );
  const row = rows[0];
  if (row?.is_active !== 1) return null;
  return { id: row.id, username: row.username, fullName: row.full_name, role: row.role };
}
