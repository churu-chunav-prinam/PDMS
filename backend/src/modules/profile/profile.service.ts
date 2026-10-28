import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../../middleware/errors.js';
import { writeAudit } from '../../services/audit.js';
import { inTransaction } from '../../services/db.js';
import { hashPassword, matchesHash } from '../../services/passwords.js';
import { endSessionsOf } from '../../services/sessions.js';
import { assertPassword } from '../admin/accounts.service.js';
import { requireReauth } from '../auth/auth.service.js';

const ER_DUP_ENTRY = 1062;
const isDuplicate = (err: unknown) => typeof err === 'object' && err !== null && 'errno' in err && err.errno === ER_DUP_ENTRY;

interface Ctx {
  userId: number;
  ip: string | null;
  /** This browser's session stays; every other session of the user ends. */
  sessionId: string;
}

async function hashOf(pool: Pool, userId: number): Promise<{ username: string; hash: string }> {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT username, password_hash FROM users WHERE id = ?', [userId]);
  const r = rows[0];
  if (!r) throw new ApiError(404, 'USER_NOT_FOUND');
  return { username: String(r.username), hash: String(r.password_hash) };
}

/** Own username change: needs the current password (counts toward the lockout). */
export async function changeOwnUsername(pool: Pool, ctx: Ctx, currentPassword: string, username: string): Promise<void> {
  await requireReauth(pool, ctx.userId, currentPassword, ctx.ip);
  const me = await hashOf(pool, ctx.userId);
  if (await matchesHash(username, me.hash)) throw new ApiError(400, 'PASSWORD_WEAK', { reason: 'PASSWORD_SAME_AS_USERNAME' });
  try {
    await inTransaction(pool, async (conn) => {
      await conn.execute('UPDATE users SET username = ? WHERE id = ?', [username, ctx.userId]);
      await endSessionsOf(conn, ctx.userId, ctx.sessionId);
      await writeAudit(conn, {
        userId: ctx.userId, action: 'PROFILE_USERNAME_CHANGE', entity: 'users', entityId: ctx.userId,
        oldValue: { username: me.username }, newValue: { username }, ip: ctx.ip,
      });
    });
  } catch (err) {
    if (isDuplicate(err)) throw new ApiError(409, 'USERNAME_TAKEN');
    throw err;
  }
}

/** Own password change: needs the current password; the new one follows the same rules. */
export async function changeOwnPassword(pool: Pool, ctx: Ctx, currentPassword: string, password: string): Promise<void> {
  await requireReauth(pool, ctx.userId, currentPassword, ctx.ip);
  const me = await hashOf(pool, ctx.userId);
  assertPassword(password, me.username);
  const hash = await hashPassword(password);
  await inTransaction(pool, async (conn) => {
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, ctx.userId]);
    await endSessionsOf(conn, ctx.userId, ctx.sessionId);
    await writeAudit(conn, {
      userId: ctx.userId, action: 'PROFILE_PASSWORD_CHANGE', entity: 'users', entityId: ctx.userId,
      newValue: { username: me.username }, ip: ctx.ip,
    });
  });
}
