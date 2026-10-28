import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { IssueType } from '../../config/constants.js';
import { ApiError } from '../../middleware/errors.js';
import { assertBoothAccess } from '../../services/access.js';
import { writeAudit } from '../../services/audit.js';
import { inTransaction } from '../../services/db.js';
import type { Db } from '../../services/db.js';
import type { AuthUser } from '../../types/auth.js';
import type { WriteContext } from './reports.service.js';

const ER_DUP_ENTRY = 1062;
const isDuplicate = (err: unknown) =>
  typeof err === 'object' && err !== null && 'errno' in err && err.errno === ER_DUP_ENTRY;

export interface IssueView {
  id: number;
  type: IssueType;
  note: string | null;
  startedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  durationSeconds: number | null;
}

/** Opens an issue. One open issue per booth is enforced by the database (unique open_booth). */
export async function openIssue(
  pool: Pool,
  user: AuthUser,
  boothId: number,
  input: { type: IssueType; note: string | null },
  { ip, at }: WriteContext,
): Promise<number> {
  return inTransaction(pool, async (conn) => {
    await assertBoothAccess(conn, user, boothId);
    let id: number;
    try {
      const [res] = await conn.execute<ResultSetHeader>(
        'INSERT INTO issue (booth_id, issue_type, note, started_at, started_by) VALUES (?, ?, ?, COALESCE(?, NOW(3)), ?)',
        [boothId, input.type, input.note, at ?? null, user.id],
      );
      id = res.insertId;
    } catch (err) {
      if (isDuplicate(err)) throw new ApiError(409, 'ISSUE_ALREADY_OPEN');
      throw err;
    }
    await writeAudit(conn, {
      userId: user.id, action: 'ISSUE_OPEN', entity: 'issue', entityId: id,
      newValue: { booth_id: boothId, ...input }, ip,
    });
    return id;
  });
}

/** Resolves an open issue of this booth. Another booth's issue id answers 404. */
export async function resolveIssue(
  pool: Pool,
  user: AuthUser,
  boothId: number,
  issueId: number,
  resolution: string,
  { ip, at }: WriteContext,
): Promise<void> {
  await inTransaction(pool, async (conn) => {
    await assertBoothAccess(conn, user, boothId);
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT resolved_at FROM issue WHERE id = ? AND booth_id = ? FOR UPDATE',
      [issueId, boothId],
    );
    if (!rows[0]) throw new ApiError(404, 'ISSUE_NOT_FOUND');
    if (rows[0].resolved_at !== null) throw new ApiError(409, 'ISSUE_NOT_OPEN');
    await conn.execute(
      'UPDATE issue SET resolved_at = COALESCE(?, NOW(3)), resolved_by = ?, resolution = ? WHERE id = ?',
      [at ?? null, user.id, resolution, issueId],
    );
    await writeAudit(conn, {
      userId: user.id, action: 'ISSUE_RESOLVE', entity: 'issue', entityId: issueId,
      newValue: { booth_id: boothId, resolution }, ip,
    });
  });
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

export async function listIssues(db: Db, boothId: number): Promise<IssueView[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, issue_type, note, started_at, resolved_at, resolution, duration_seconds
       FROM issue WHERE booth_id = ? ORDER BY started_at DESC, id DESC`,
    [boothId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    type: r.issue_type as IssueType,
    note: (r.note as string | null) ?? null,
    startedAt: iso(r.started_at) ?? '',
    resolvedAt: iso(r.resolved_at),
    resolution: (r.resolution as string | null) ?? null,
    durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
  }));
}
