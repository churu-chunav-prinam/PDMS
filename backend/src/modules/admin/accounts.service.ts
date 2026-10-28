import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { BOOTH_NO_PAD, OFFICER_BCRYPT_COST } from '../../config/constants.js';
import { ApiError } from '../../middleware/errors.js';
import { writeAudit } from '../../services/audit.js';
import { passwordProblem, usernameKey } from '../../services/credential-rules.js';
import { inTransaction } from '../../services/db.js';
import { hashPassword, matchesHash } from '../../services/passwords.js';
import { endSessionsOf } from '../../services/sessions.js';

/**
 * Officer accounts. The admin chooses every username and password; nothing is generated and no
 * password is ever stored readable or written to the audit log. One account row per booth:
 * disabling keeps it, and adding an officer to that booth later re-activates it with the new
 * details. A POLLING_OFFICER always has exactly one user_booth row.
 */

const HASH_PARALLEL = 8;
const ER_DUP_ENTRY = 1062;
const isDuplicate = (err: unknown) => typeof err === 'object' && err !== null && 'errno' in err && err.errno === ER_DUP_ENTRY;

/** "RTG-045": how a booth is written in Excel files and on screen. */
export const boothLabel = (psCode: string, boothNo: number) => `${psCode}-${String(boothNo).padStart(BOOTH_NO_PAD, '0')}`;

export interface OfficerInput {
  boothId: number;
  fullName: string;
  mobile: string;
  username: string;
  password: string;
}

export interface CreatedOfficer {
  userId: number;
  boothId: number;
  username: string;
  fullName: string;
}

interface Actor {
  userId: number;
  ip: string | null;
}

/** 400 PASSWORD_WEAK with the exact reason, before anything is hashed or written. */
export function assertPassword(password: string, username: string): void {
  const reason = passwordProblem(password, username);
  if (reason) throw new ApiError(400, 'PASSWORD_WEAK', { reason });
}

async function hashAll(passwords: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < passwords.length; i += HASH_PARALLEL) {
    out.push(...(await Promise.all(passwords.slice(i, i + HASH_PARALLEL).map((p) => hashPassword(p, OFFICER_BCRYPT_COST)))));
  }
  return out;
}

interface BoothAccountRow extends RowDataPacket {
  booth_id: number;
  user_id: number | null;
  is_active: number | null;
}

/** Locks the booths (FOR UPDATE) and returns each with its officer account, if any. */
async function lockBooths(conn: PoolConnection, boothIds: readonly number[]): Promise<Map<number, BoothAccountRow>> {
  const found = new Map<number, BoothAccountRow>();
  if (boothIds.length === 0) return found;
  const [rows] = await conn.execute<BoothAccountRow[]>(
    `SELECT b.id AS booth_id, u.id AS user_id, u.is_active
       FROM booth b
       LEFT JOIN user_booth ub ON ub.booth_id = b.id
       LEFT JOIN users u ON u.id = ub.user_id AND u.role = 'POLLING_OFFICER'
      WHERE b.id IN (${boothIds.map(() => '?').join(', ')})
      ORDER BY b.id
      FOR UPDATE`,
    [...boothIds],
  );
  for (const row of rows) if (!found.has(row.booth_id) || row.user_id !== null) found.set(row.booth_id, row);
  return found;
}

/**
 * Creates (or re-activates) the officer account of each booth, all in one transaction.
 * Refuses everything if any booth is unknown, already has an active officer, or a username is taken.
 */
export async function createOfficers(
  pool: Pool,
  inputs: readonly OfficerInput[],
  actor: Actor,
  action: 'OFFICER_CREATE' | 'OFFICER_BULK_CREATE',
): Promise<CreatedOfficer[]> {
  for (const i of inputs) assertPassword(i.password, i.username);
  const keys = inputs.map((i) => usernameKey(i.username));
  if (new Set(keys).size !== keys.length) throw new ApiError(409, 'USERNAME_TAKEN');
  const hashes = await hashAll(inputs.map((i) => i.password));
  try {
    return await inTransaction(pool, async (conn) => {
      const booths = await lockBooths(conn, inputs.map((i) => i.boothId));
      const created: CreatedOfficer[] = [];
      for (const [n, input] of inputs.entries()) {
        const booth = booths.get(input.boothId);
        const hash = hashes[n];
        if (!booth || hash === undefined) throw new ApiError(404, 'BOOTH_NOT_FOUND', { boothId: input.boothId });
        if (booth.user_id !== null && booth.is_active === 1) throw new ApiError(409, 'BOOTH_HAS_OFFICER', { boothId: input.boothId });
        let userId: number;
        if (booth.user_id === null) {
          const [res] = await conn.execute<ResultSetHeader>(
            `INSERT INTO users (username, password_hash, role, full_name, mobile, created_by)
             VALUES (?, ?, 'POLLING_OFFICER', ?, ?, ?)`,
            [input.username, hash, input.fullName, input.mobile, actor.userId],
          );
          userId = res.insertId;
          await conn.execute('INSERT INTO user_booth (user_id, booth_id) VALUES (?, ?)', [userId, input.boothId]);
        } else {
          userId = booth.user_id;
          await conn.execute(
            `UPDATE users SET username = ?, password_hash = ?, full_name = ?, mobile = ?, is_active = 1,
                    failed_login_count = 0, locked_until = NULL WHERE id = ?`,
            [input.username, hash, input.fullName, input.mobile, userId],
          );
          await endSessionsOf(conn, userId);
        }
        created.push({ userId, boothId: input.boothId, username: input.username, fullName: input.fullName });
      }
      // Usernames only: the audit log never sees a password.
      await writeAudit(conn, {
        userId: actor.userId,
        action,
        entity: 'users',
        entityId: created.length === 1 ? (created[0]?.userId ?? null) : null,
        newValue: { count: created.length, usernames: created.map((c) => c.username) },
        ip: actor.ip,
      });
      return created;
    });
  } catch (err) {
    if (isDuplicate(err)) throw new ApiError(409, 'USERNAME_TAKEN');
    throw err;
  }
}

interface OfficerRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  full_name: string | null;
  mobile: string | null;
  is_active: number;
}

async function lockOfficer(conn: PoolConnection, userId: number): Promise<OfficerRow> {
  const [rows] = await conn.execute<OfficerRow[]>(
    "SELECT id, username, password_hash, full_name, mobile, is_active FROM users WHERE id = ? AND role = 'POLLING_OFFICER' FOR UPDATE",
    [userId],
  );
  const row = rows[0];
  if (!row) throw new ApiError(404, 'OFFICER_NOT_FOUND');
  return row;
}

/** The admin types a new password for an officer. Ends that officer's sessions; resets the lockout. */
export async function setOfficerPassword(pool: Pool, userId: number, password: string, actor: Actor): Promise<void> {
  await inTransaction(pool, async (conn) => {
    const officer = await lockOfficer(conn, userId);
    assertPassword(password, officer.username);
    const hash = await hashPassword(password, OFFICER_BCRYPT_COST);
    await conn.execute('UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?', [hash, userId]);
    await endSessionsOf(conn, userId);
    await writeAudit(conn, {
      userId: actor.userId, action: 'OFFICER_PASSWORD_SET', entity: 'users', entityId: userId,
      newValue: { username: officer.username }, ip: actor.ip,
    });
  });
}

export async function setOfficerActive(pool: Pool, userId: number, active: boolean, actor: Actor): Promise<void> {
  await inTransaction(pool, async (conn) => {
    const officer = await lockOfficer(conn, userId);
    if ((officer.is_active === 1) === active) return;
    await conn.execute('UPDATE users SET is_active = ? WHERE id = ?', [active ? 1 : 0, userId]);
    if (!active) await endSessionsOf(conn, userId);
    await writeAudit(conn, {
      userId: actor.userId, action: active ? 'OFFICER_ENABLE' : 'OFFICER_DISABLE', entity: 'users', entityId: userId,
      newValue: { username: officer.username }, ip: actor.ip,
    });
  });
}

/** Name, mobile and username. A new username ends the officer's sessions. */
export async function updateOfficerDetails(
  pool: Pool,
  userId: number,
  details: { fullName: string; mobile: string; username: string },
  actor: Actor,
): Promise<void> {
  try {
    await inTransaction(pool, async (conn) => {
      const officer = await lockOfficer(conn, userId);
      const renamed = details.username !== officer.username;
      // The rule "password differs from username" also holds when only the username changes.
      if (renamed && (await matchesHash(details.username, officer.password_hash))) {
        throw new ApiError(400, 'PASSWORD_WEAK', { reason: 'PASSWORD_SAME_AS_USERNAME' });
      }
      await conn.execute('UPDATE users SET full_name = ?, mobile = ?, username = ? WHERE id = ?', [details.fullName, details.mobile, details.username, userId]);
      if (renamed) await endSessionsOf(conn, userId);
      await writeAudit(conn, {
        userId: actor.userId, action: 'OFFICER_UPDATE', entity: 'users', entityId: userId,
        oldValue: { username: officer.username, full_name: officer.full_name, mobile: officer.mobile },
        newValue: { username: details.username, full_name: details.fullName, mobile: details.mobile },
        ip: actor.ip,
      });
    });
  } catch (err) {
    if (isDuplicate(err)) throw new ApiError(409, 'USERNAME_TAKEN');
    throw err;
  }
}
