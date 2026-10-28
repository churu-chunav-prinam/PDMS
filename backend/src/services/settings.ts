import type { Pool, RowDataPacket } from 'mysql2/promise';
import { writeAudit } from './audit.js';
import { inTransaction } from './db.js';
import type { Db } from './db.js';

const POLL_DATE_KEY = 'poll_date';

export async function getPollDate(db: Db, fallback: string): Promise<string> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT setting_value FROM app_settings WHERE setting_key = ?', [POLL_DATE_KEY]);
  return (rows[0]?.setting_value as string | undefined) ?? fallback;
}

const dayNumber = (iso: string) => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000);

/**
 * Sets the poll date and moves every step's opens_at/due_by by the same number of days, so the
 * step times stay the same clock times relative to the poll day. One transaction, audited.
 */
export async function setPollDate(
  pool: Pool,
  userId: number,
  pollDate: string,
  fallback: string,
  ip: string | null,
): Promise<{ pollDate: string; shiftedDays: number }> {
  return inTransaction(pool, async (conn) => {
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? FOR UPDATE',
      [POLL_DATE_KEY],
    );
    const old = (rows[0]?.setting_value as string | undefined) ?? fallback;
    const days = dayNumber(pollDate) - dayNumber(old);
    if (days !== 0) {
      await conn.execute(
        'UPDATE step SET opens_at = opens_at + INTERVAL ? DAY, due_by = due_by + INTERVAL ? DAY',
        [days, days],
      );
    }
    await conn.execute(
      'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [POLL_DATE_KEY, pollDate],
    );
    await writeAudit(conn, {
      userId, action: 'POLL_DATE_SET', entity: 'app_settings', entityId: null,
      oldValue: { poll_date: old }, newValue: { poll_date: pollDate, shifted_days: days }, ip,
    });
    return { pollDate, shiftedDays: days };
  });
}

const ENFORCE_KEY = 'enforce_step_times';

/**
 * "समय सीमा लागू करें". false (the default, also when never saved): every active step can be
 * reported at any time and nothing is ever late or behind. true: opens_at / due_by apply.
 */
export async function getEnforceStepTimes(db: Db): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT setting_value FROM app_settings WHERE setting_key = ?', [ENFORCE_KEY]);
  return rows[0]?.setting_value === 'true';
}

export async function setEnforceStepTimes(pool: Pool, userId: number, enabled: boolean, ip: string | null): Promise<void> {
  await inTransaction(pool, async (conn) => {
    const old = await getEnforceStepTimes(conn);
    await conn.execute(
      'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [ENFORCE_KEY, String(enabled)],
    );
    await writeAudit(conn, {
      userId, action: 'ENFORCE_STEP_TIMES_SET', entity: 'app_settings', entityId: null,
      oldValue: { enforce_step_times: old }, newValue: { enforce_step_times: enabled }, ip,
    });
  });
}
