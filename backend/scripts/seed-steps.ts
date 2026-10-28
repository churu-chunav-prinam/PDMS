// npm run seed:steps   Inserts the default steps (src/config/step-seed.ts) placed on POLL_DATE.
// Only into an empty step table: after that, steps are edited in the step master screen.
import type { RowDataPacket } from 'mysql2/promise';
import { STEP_SEED, seedDateTime } from '../src/config/step-seed.js';
import { writeAudit } from '../src/services/audit.js';
import { inTransaction } from '../src/services/db.js';
import { isMainModule, runScript } from './lib/script-db.js';

if (isMainModule(import.meta.url)) {
  await runScript(async (pool, env) =>
    inTransaction(pool, async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM step FOR UPDATE');
      if (Number(rows[0]?.n) > 0) {
        console.error('Steps already exist; edit them in the step master. Nothing written.');
        return false;
      }
      const order = new Map<string, number>();
      for (const s of STEP_SEED) {
        const n = (order.get(s.phase) ?? 0) + 1;
        order.set(s.phase, n);
        await conn.execute(
          `INSERT INTO step (phase, sort_order, name_hi, name_en, step_type, marker, number_label_hi, number_label_en, opens_at, due_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.phase, n * 10, s.nameHi, s.nameEn, s.type, s.marker ?? null, s.numberLabelHi ?? null, s.numberLabelEn ?? null,
            s.opens ? seedDateTime(env.POLL_DATE, s.opens) : null,
            s.due ? seedDateTime(env.POLL_DATE, s.due) : null,
          ],
        );
      }
      await writeAudit(conn, {
        userId: null, action: 'SEED_STEPS', entity: 'step', entityId: null,
        newValue: { count: STEP_SEED.length, poll_date: env.POLL_DATE }, ip: null,
      });
      console.log(`Seeded ${STEP_SEED.length} steps on poll date ${env.POLL_DATE}.`);
      return true;
    }),
  );
}
