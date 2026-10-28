import type { RowDataPacket } from 'mysql2/promise';
import type { Phase, StepType } from '../config/constants.js';
import type { Db } from './db.js';

export interface Step {
  id: number;
  phase: Phase;
  sortOrder: number;
  nameHi: string;
  nameEn: string;
  type: StepType;
  numberLabelHi: string | null;
  numberLabelEn: string | null;
  opensAt: Date | null;
  dueBy: Date | null;
  active: boolean;
  marker: 'POLL_START' | null;
}

/** Steps in poll order: phase, then sort_order. */
export const stepOrderSql = (alias = '') =>
  `FIELD(${alias}phase, 'PRE_POLL', 'POLL_DAY', 'POST_POLL'), ${alias}sort_order`;
export const STEP_ORDER_SQL = stepOrderSql();

const STEP_COLUMNS =
  'id, phase, sort_order, name_hi, name_en, step_type, number_label_hi, number_label_en, opens_at, due_by, is_active, marker';

export function toStep(r: RowDataPacket): Step {
  return {
    id: Number(r.id),
    phase: r.phase as Phase,
    sortOrder: Number(r.sort_order),
    nameHi: String(r.name_hi),
    nameEn: String(r.name_en),
    type: r.step_type as StepType,
    numberLabelHi: (r.number_label_hi as string | null) ?? null,
    numberLabelEn: (r.number_label_en as string | null) ?? null,
    opensAt: (r.opens_at as Date | null) ?? null,
    dueBy: (r.due_by as Date | null) ?? null,
    active: Number(r.is_active) === 1,
    marker: (r.marker as 'POLL_START' | null) ?? null,
  };
}

export async function loadSteps(db: Db, opts: { activeOnly: boolean }): Promise<Step[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${STEP_COLUMNS} FROM step ${opts.activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY ${STEP_ORDER_SQL}`,
  );
  return rows.map(toStep);
}

export async function loadStep(db: Db, stepId: number): Promise<Step | null> {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT ${STEP_COLUMNS} FROM step WHERE id = ?`, [stepId]);
  return rows[0] ? toStep(rows[0]) : null;
}

/** Server time from the database (one clock for everyone). */
export async function dbNow(db: Db): Promise<Date> {
  const [rows] = await db.query<RowDataPacket[]>('SELECT NOW(3) AS now');
  const now = rows[0]?.now as Date | undefined;
  if (!(now instanceof Date)) throw new Error('internal: NOW() did not return a date');
  return now;
}
