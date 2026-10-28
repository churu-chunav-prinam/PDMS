import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../../middleware/errors.js';
import { assertBoothAccess } from '../../services/access.js';
import { writeAudit } from '../../services/audit.js';
import { inTransaction } from '../../services/db.js';
import { isLate, validateReport } from '../../services/report-rules.js';
import type { ReportValues, StepRef, Turnout } from '../../services/report-rules.js';
import { getEnforceStepTimes } from '../../services/settings.js';
import { STEP_ORDER_SQL, dbNow, loadStep } from '../../services/steps.js';
import type { AuthUser } from '../../types/auth.js';

export type ReportMode = { kind: 'create' } | { kind: 'edit'; reason: string };

/** ip for the audit row. `at`: the dev demo script only (routes never pass it); default = DB time. */
export interface WriteContext {
  ip: string | null;
  at?: Date;
}

interface ReportRow extends RowDataPacket {
  id: number;
  value_number: number | null;
  turnout_male: number | null;
  turnout_female: number | null;
  turnout_third: number | null;
}

/** What is stored for a report, as kept in the edit history. */
function storedValues(r: ReportRow | ReportValues): ReportValues {
  if ('id' in r) {
    return {
      ...(r.value_number !== null ? { value: r.value_number } : {}),
      ...(r.turnout_male !== null
        ? { turnout: { male: r.turnout_male, female: r.turnout_female ?? 0, third: r.turnout_third ?? 0 } }
        : {}),
    };
  }
  return r;
}

interface TurnoutRow extends RowDataPacket {
  step_id: number;
  name_hi: string;
  turnout_male: number;
  turnout_female: number;
  turnout_third: number;
}

/** Nearest reported turnout steps before and after `stepId` in poll order (all steps, active or not). */
async function turnoutNeighbours(conn: PoolConnection, boothId: number, stepId: number) {
  const [rows] = await conn.execute<TurnoutRow[]>(
    `SELECT s.id AS step_id, s.name_hi, r.turnout_male, r.turnout_female, r.turnout_third
       FROM step s LEFT JOIN step_report r ON r.step_id = s.id AND r.booth_id = ?
      WHERE s.step_type = 'TURNOUT' AND (r.id IS NOT NULL OR s.id = ?)
      ORDER BY ${STEP_ORDER_SQL}`,
    [boothId, stepId],
  );
  const at = rows.findIndex((r) => r.step_id === stepId);
  const pick = (r: TurnoutRow | undefined): (StepRef & Turnout) | null =>
    r ? { id: r.step_id, nameHi: r.name_hi, male: r.turnout_male, female: r.turnout_female, third: r.turnout_third } : null;
  return { previous: pick(rows[at - 1]), next: pick(rows[at + 1]) };
}

/**
 * Creates or edits the report of one step for one booth, in one transaction.
 * The booth row is locked so two reports of the same booth are checked one after the other.
 */
export async function saveReport(
  pool: Pool,
  user: AuthUser,
  boothId: number,
  stepId: number,
  values: ReportValues,
  mode: ReportMode,
  { ip, at }: WriteContext,
): Promise<{ reportId: number; late: boolean }> {
  return inTransaction(pool, async (conn) => {
    await assertBoothAccess(conn, user, boothId);
    const [booths] = await conn.execute<RowDataPacket[]>(
      'SELECT registered_voters_total FROM booth WHERE id = ? FOR UPDATE',
      [boothId],
    );
    const registeredVoters = Number(booths[0]?.registered_voters_total ?? 0);
    const step = await loadStep(conn, stepId);
    if (!step?.active) throw new ApiError(404, 'STEP_NOT_FOUND');
    const now = at ?? (await dbNow(conn));
    const enforceTimes = await getEnforceStepTimes(conn);
    if (enforceTimes && step.opensAt && now < step.opensAt) {
      throw new ApiError(409, 'STEP_NOT_OPEN', { opensAt: step.opensAt.toISOString() });
    }

    const [existingRows] = await conn.execute<ReportRow[]>(
      `SELECT id, value_number, turnout_male, turnout_female, turnout_third
         FROM step_report WHERE booth_id = ? AND step_id = ? FOR UPDATE`,
      [boothId, stepId],
    );
    const existing = existingRows[0];
    if (mode.kind === 'create' && existing) throw new ApiError(409, 'ALREADY_REPORTED');
    if (mode.kind === 'edit' && !existing) throw new ApiError(409, 'NOT_REPORTED');

    const errors = validateReport(values, {
      type: step.type,
      registeredVoters,
      ...(step.type === 'TURNOUT' ? await turnoutNeighbours(conn, boothId, stepId) : { previous: null, next: null }),
    });
    if (errors.length > 0) throw new ApiError(400, 'REPORT_INVALID', { problems: errors });

    const t = values.turnout;
    const columns = [values.value ?? null, t?.male ?? null, t?.female ?? null, t?.third ?? null];
    if (mode.kind === 'create') {
      const late = enforceTimes && isLate(now, step.dueBy);
      const [res] = await conn.execute<ResultSetHeader>(
        `INSERT INTO step_report (booth_id, step_id, value_number, turnout_male, turnout_female, turnout_third,
                                  reported_at, reported_by, is_late)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [boothId, stepId, ...columns, now, user.id, late ? 1 : 0],
      );
      await writeAudit(conn, {
        userId: user.id, action: 'STEP_REPORT', entity: 'step_report', entityId: res.insertId,
        newValue: { booth_id: boothId, step_id: stepId, ...values, late }, ip,
      });
      return { reportId: res.insertId, late };
    }

    if (!existing) throw new Error('internal: edit without report');
    const before = storedValues(existing);
    if (JSON.stringify(before) === JSON.stringify(storedValues(values))) throw new ApiError(409, 'NO_CHANGE');
    // The original reported_at and late flag stay: they record when the step was first reported.
    await conn.execute(
      `UPDATE step_report SET value_number = ?, turnout_male = ?, turnout_female = ?, turnout_third = ?,
              version = version + 1, updated_by = ? WHERE id = ?`,
      [...columns, user.id, existing.id],
    );
    await conn.execute(
      'INSERT INTO step_report_history (report_id, old_value, new_value, reason, changed_by) VALUES (?, ?, ?, ?, ?)',
      [existing.id, JSON.stringify(before), JSON.stringify(storedValues(values)), mode.reason, user.id],
    );
    await writeAudit(conn, {
      userId: user.id, action: 'STEP_REPORT_EDIT', entity: 'step_report', entityId: existing.id,
      oldValue: before, newValue: values, reason: mode.reason, ip,
    });
    const [lateRows] = await conn.execute<RowDataPacket[]>('SELECT is_late FROM step_report WHERE id = ?', [existing.id]);
    return { reportId: existing.id, late: Number(lateRows[0]?.is_late) === 1 };
  });
}
