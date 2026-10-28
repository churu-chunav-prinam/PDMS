// npm run import:geography -- [--file ../docs/polling-stations.xlsx] [--fixes ../docs/fixes-official.json]
//                              [--ps-master ../docs/ps-master.json] [--commit]
// Dry run unless --commit. Refuses unless the counts match the official Churu numbers, and refuses
// once officer accounts or reports exist (geography is loaded once, before accounts).
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { writeAudit } from '../src/services/audit.js';
import { inTransaction } from '../src/services/db.js';
import { readRows } from '../src/services/xlsx.js';
import { GEO_COLUMNS, GEO_SHEET, buildBooths } from './lib/geography.js';
import type { Fix, GeoBooth } from './lib/geography.js';
import { isMainModule, runScript } from './lib/script-db.js';

/** Thrown inside the transaction to roll a fully checked dry run back. */
class DryRun extends Error {}

const fixSchema = z.array(
  z
    .object({
      panchayat_samiti: z.string().min(1),
      booth_no: z.number().int().min(1),
      field: z.enum(['ps_ward_no', 'zp_ward_no', 'name_hindi', 'name_english']),
      value: z.union([z.number().int().min(1), z.string().min(1)]),
      reason: z.string().min(1),
      approved_by: z.string().min(1),
      approved_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict(),
);
const psMasterSchema = z.record(
  z.string(),
  z.object({ code: z.string().regex(/^[A-Z]{2,5}$/), hindi: z.string().min(1) }).strict(),
);

async function readJson<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  return schema.parse(JSON.parse(await readFile(path, 'utf8')));
}

async function count(conn: PoolConnection, sql: string): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(sql);
  return Number(rows[0]?.n ?? 0);
}

async function write(
  conn: PoolConnection,
  booths: readonly GeoBooth[],
  psMaster: z.infer<typeof psMasterSchema>,
): Promise<void> {
  const insert = async (sql: string, params: (string | number | null)[]) =>
    (await conn.execute<ResultSetHeader>(sql, params))[0].insertId;
  await conn.execute('DELETE FROM booth');
  await conn.execute('DELETE FROM ward');
  await conn.execute('DELETE FROM panchayat_samiti');
  await conn.execute('DELETE FROM district');
  const districtId = await insert(
    "INSERT INTO district (code, name_english, name_hindi) VALUES ('CHURU', 'Churu', 'चूरू')",
    [],
  );
  const psIds = new Map<string, number>();
  const psWardIds = new Map<string, number>();
  const zpWardIds = new Map<number, number>();
  const sorted = [...booths].sort((a, b) => a.psName.localeCompare(b.psName) || a.boothNo - b.boothNo);
  for (const b of sorted) {
    let psId = psIds.get(b.psName);
    if (psId === undefined) {
      const m = psMaster[b.psName];
      if (!m) throw new Error(`ps-master has no entry for "${b.psName}"`);
      psId = await insert(
        'INSERT INTO panchayat_samiti (district_id, code, name_english, name_hindi) VALUES (?, ?, ?, ?)',
        [districtId, m.code, b.psName, m.hindi],
      );
      psIds.set(b.psName, psId);
    }
    const psWardKey = `${psId}|${b.psWardNo}`;
    let psWardId = psWardIds.get(psWardKey);
    if (psWardId === undefined) {
      psWardId = await insert("INSERT INTO ward (ward_type, panchayat_samiti_id, ward_no) VALUES ('PS', ?, ?)", [psId, b.psWardNo]);
      psWardIds.set(psWardKey, psWardId);
    }
    let zpWardId = zpWardIds.get(b.zpWardNo);
    if (zpWardId === undefined) {
      zpWardId = await insert("INSERT INTO ward (ward_type, panchayat_samiti_id, ward_no) VALUES ('ZP', NULL, ?)", [b.zpWardNo]);
      zpWardIds.set(b.zpWardNo, zpWardId);
    }
    await conn.execute(
      `INSERT INTO booth (panchayat_samiti_id, booth_no, name_hindi, name_english, ps_ward_id, zp_ward_id,
                          registered_voters_total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [psId, b.boothNo, b.nameHindi, b.nameEnglish || null, psWardId, zpWardId, b.voters],
    );
  }
}

if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', default: '../docs/polling-stations.xlsx' },
      fixes: { type: 'string', default: '../docs/fixes-official.json' },
      'ps-master': { type: 'string', default: '../docs/ps-master.json' },
      commit: { type: 'boolean', default: false },
    },
  });
  await runScript(async (pool) => {
    const fixes: Fix[] = await readJson(values.fixes, fixSchema);
    const psMaster = await readJson(values['ps-master'], psMasterSchema);
    const sheet = await readRows(values.file, Object.values(GEO_COLUMNS), GEO_SHEET);
    if (!sheet.ok) {
      console.error(`Cannot read ${values.file} sheet ${GEO_SHEET}: ${sheet.error} ${sheet.columns?.join(', ') ?? ''}`);
      return false;
    }
    const result = buildBooths(sheet.rows, fixes);
    console.log(`Rows: ${sheet.rows.length}; fixes applied: ${fixes.length}`);
    console.log('Counts:', JSON.stringify(result.counts));
    const missingPs = [...new Set(result.booths.map((b) => b.psName))].filter((p) => !psMaster[p]);
    for (const p of missingPs) result.errors.push(`ps-master has no code/Hindi name for "${p}"`);
    if (result.errors.length > 0) {
      for (const e of result.errors) console.error(`ERROR ${e}`);
      console.error(`FAILED with ${result.errors.length} error(s). Nothing written.`);
      return false;
    }
    await inTransaction(pool, async (conn) => {
      const used = await count(conn, 'SELECT (SELECT COUNT(*) FROM user_booth) + (SELECT COUNT(*) FROM step_report) + (SELECT COUNT(*) FROM issue) AS n');
      if (used > 0) throw new Error('officer accounts or reports already exist; geography can no longer be replaced');
      await write(conn, result.booths, psMaster);
      await writeAudit(conn, {
        userId: null,
        action: 'IMPORT_GEOGRAPHY',
        entity: 'geography',
        entityId: null,
        newValue: { counts: result.counts, fixes },
        ip: null,
      });
      if (!values.commit) throw new DryRun();
    }).catch((err: unknown) => {
      if (!(err instanceof DryRun)) throw err;
    });
    console.log(values.commit ? 'COMMITTED.' : 'DRY RUN OK: everything checked, nothing written. Add --commit.');
    return true;
  });
}
