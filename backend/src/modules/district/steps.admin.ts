import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Phase, StepType } from '../../config/constants.js';
import { ApiError } from '../../middleware/errors.js';
import { writeAudit } from '../../services/audit.js';
import { inTransaction } from '../../services/db.js';
import { loadStep, loadSteps } from '../../services/steps.js';
import type { Step } from '../../services/steps.js';

export interface StepInput {
  phase: Phase;
  sortOrder: number;
  nameHi: string;
  nameEn: string;
  type: StepType;
  numberLabelHi: string | null;
  numberLabelEn: string | null;
  /** IST wall clock "YYYY-MM-DDTHH:MM", or null. */
  opensAt: string | null;
  dueBy: string | null;
}

const ER_DUP_ENTRY = 1062;
const isDuplicate = (err: unknown) => typeof err === 'object' && err !== null && 'errno' in err && err.errno === ER_DUP_ENTRY;
const toSql = (local: string | null) => (local === null ? null : `${local.replace('T', ' ')}:00`);

function check(input: StepInput): void {
  if (input.opensAt !== null && input.dueBy !== null && input.dueBy < input.opensAt) throw new ApiError(400, 'DUE_BEFORE_OPENS');
  if (input.type === 'NUMBER' && input.numberLabelHi === null) throw new ApiError(400, 'NUMBER_LABEL_REQUIRED');
}

const params = (i: StepInput) => [
  i.phase, i.sortOrder, i.nameHi, i.nameEn, i.type,
  i.type === 'NUMBER' ? i.numberLabelHi : null, i.type === 'NUMBER' ? i.numberLabelEn : null,
  toSql(i.opensAt), toSql(i.dueBy),
];

export async function listStepsWithCounts(pool: Pool): Promise<(Step & { reports: number })[]> {
  const steps = await loadSteps(pool, { activeOnly: false });
  const [rows] = await pool.query<RowDataPacket[]>('SELECT step_id, COUNT(*) AS n FROM step_report GROUP BY step_id');
  const counts = new Map(rows.map((r) => [Number(r.step_id), Number(r.n)]));
  return steps.map((s) => ({ ...s, reports: counts.get(s.id) ?? 0 }));
}

async function reportCount(conn: Pool | PoolConnection, stepId: number): Promise<number> {
  const [rows] = await conn.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM step_report WHERE step_id = ?', [stepId]);
  return Number(rows[0]?.n ?? 0);
}

export async function createStep(pool: Pool, userId: number, input: StepInput, ip: string | null): Promise<number> {
  check(input);
  return inTransaction(pool, async (conn) => {
    try {
      const [res] = await conn.execute<ResultSetHeader>(
        `INSERT INTO step (phase, sort_order, name_hi, name_en, step_type, number_label_hi, number_label_en, opens_at, due_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params(input),
      );
      await writeAudit(conn, { userId, action: 'STEP_CREATE', entity: 'step', entityId: res.insertId, newValue: input, ip });
      return res.insertId;
    } catch (err) {
      if (isDuplicate(err)) throw new ApiError(409, 'ORDER_TAKEN');
      throw err;
    }
  });
}

/** A step that already has reports keeps its phase and type (the reports depend on them). */
export async function updateStep(pool: Pool, userId: number, stepId: number, input: StepInput, ip: string | null): Promise<void> {
  check(input);
  await inTransaction(pool, async (conn) => {
    const [locked] = await conn.execute<RowDataPacket[]>('SELECT id FROM step WHERE id = ? FOR UPDATE', [stepId]);
    if (!locked[0]) throw new ApiError(404, 'STEP_NOT_FOUND');
    const before = await loadStep(conn, stepId);
    if (!before) throw new ApiError(404, 'STEP_NOT_FOUND');
    if ((before.type !== input.type || before.phase !== input.phase) && (await reportCount(conn, stepId)) > 0) {
      throw new ApiError(409, 'STEP_HAS_REPORTS');
    }
    try {
      await conn.execute(
        `UPDATE step SET phase = ?, sort_order = ?, name_hi = ?, name_en = ?, step_type = ?, number_label_hi = ?,
                number_label_en = ?, opens_at = ?, due_by = ? WHERE id = ?`,
        [...params(input), stepId],
      );
    } catch (err) {
      if (isDuplicate(err)) throw new ApiError(409, 'ORDER_TAKEN');
      throw err;
    }
    await writeAudit(conn, { userId, action: 'STEP_UPDATE', entity: 'step', entityId: stepId, oldValue: before, newValue: input, ip });
  });
}

export async function setStepActive(pool: Pool, userId: number, stepId: number, active: boolean, ip: string | null): Promise<void> {
  await inTransaction(pool, async (conn) => {
    const [res] = await conn.execute<ResultSetHeader>('UPDATE step SET is_active = ? WHERE id = ?', [active ? 1 : 0, stepId]);
    if (res.affectedRows === 0) throw new ApiError(404, 'STEP_NOT_FOUND');
    await writeAudit(conn, { userId, action: active ? 'STEP_ACTIVATE' : 'STEP_DEACTIVATE', entity: 'step', entityId: stepId, ip });
  });
}

/** Only a step without any report can be deleted; otherwise it can only be deactivated. */
export async function deleteStep(pool: Pool, userId: number, stepId: number, ip: string | null): Promise<void> {
  await inTransaction(pool, async (conn) => {
    const before = await loadStep(conn, stepId);
    if (!before) throw new ApiError(404, 'STEP_NOT_FOUND');
    if ((await reportCount(conn, stepId)) > 0) throw new ApiError(409, 'STEP_HAS_REPORTS');
    await conn.execute('DELETE FROM step WHERE id = ?', [stepId]);
    await writeAudit(conn, { userId, action: 'STEP_DELETE', entity: 'step', entityId: stepId, oldValue: before, ip });
  });
}
