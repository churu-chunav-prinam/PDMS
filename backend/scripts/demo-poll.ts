// DEV ONLY. npm run demo:poll -- --officer-password <pw>  -> ~150 demo booths with realistic reports as of now
//           (new demo officers get username "demo-<booth>", e.g. demo-rtg-045, and that one password)
//           npm run demo:poll -- --reset -> removes the demo booths' reports and issues
// Every write goes through the same services as the app (accounts, report rules, issues); only
// the report time is supplied (`at`), so the demo can show a morning that already happened.
// In production it refuses unless DEMO_ALLOWED=true (presentation only). Before real use: run
// `npm run demo:poll -- --reset` and set DEMO_ALLOWED=false again.
import { parseArgs } from 'node:util';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ISSUE_TYPES } from '../src/config/constants.js';
import { boothLabel, createOfficers } from '../src/modules/admin/accounts.service.js';
import { passwordProblem } from '../src/services/credential-rules.js';
import { openIssue, resolveIssue } from '../src/modules/officer/issues.service.js';
import { saveReport } from '../src/modules/officer/reports.service.js';
import type { ReportValues } from '../src/services/report-rules.js';
import { dbNow, loadSteps } from '../src/services/steps.js';
import type { Step } from '../src/services/steps.js';
import type { AuthUser } from '../src/types/auth.js';
import { isMainModule, runScript } from './lib/script-db.js';

const DEMO_KEY = 'demo_booth_ids';
const DEMO_BOOTHS = 150;
const MINUTE = 60_000;

/** Small seeded RNG so a demo run is repeatable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const FIRST = ['राम', 'सुरेश', 'महेंद्र', 'सुनीता', 'कविता', 'राजेश', 'पूजा', 'विनोद', 'अनीता', 'मुकेश', 'सरिता', 'दिनेश'];
const LAST = ['शर्मा', 'सैनी', 'मीणा', 'जाट', 'राठौड़', 'स्वामी', 'चौधरी', 'प्रजापत', 'गुप्ता'];
const RESOLUTIONS = ['पुलिस पहुँची, स्थिति सामान्य', 'EVM बदली गई', 'जनरेटर चालू किया', 'BLO से सूची मिलान किया', 'सेक्टर अधिकारी ने सुलझाया'];

/** Share of registered voters who have voted by each turnout slot (cumulative), by slot index. */
const TURNOUT_CURVE = [0.1, 0.26, 0.42, 0.56, 0.66, 0.71];

async function demoBoothIds(pool: Pool): Promise<number[]> {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT setting_value FROM app_settings WHERE setting_key = ?', [DEMO_KEY]);
  const raw = rows[0]?.setting_value as string | undefined;
  return raw ? (JSON.parse(raw) as number[]) : [];
}

async function pickBooths(pool: Pool, rand: () => number): Promise<number[]> {
  const existing = await demoBoothIds(pool);
  if (existing.length > 0) return existing;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT b.id, b.panchayat_samiti_id FROM booth b
      WHERE NOT EXISTS (SELECT 1 FROM user_booth ub WHERE ub.booth_id = b.id)`,
  );
  // Spread across all PS: shuffle, then take round-robin by PS.
  const byPs = new Map<number, number[]>();
  for (const r of rows.sort(() => rand() - 0.5)) byPs.set(Number(r.panchayat_samiti_id), [...(byPs.get(Number(r.panchayat_samiti_id)) ?? []), Number(r.id)]);
  const picked: number[] = [];
  while (picked.length < DEMO_BOOTHS && [...byPs.values()].some((l) => l.length > 0)) {
    for (const list of byPs.values()) {
      const id = list.pop();
      if (id !== undefined && picked.length < DEMO_BOOTHS) picked.push(id);
    }
  }
  await pool.execute(
    'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [DEMO_KEY, JSON.stringify(picked)],
  );
  return picked;
}

async function officersOf(pool: Pool, boothIds: readonly number[]): Promise<Map<number, AuthUser>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ub.booth_id, u.id, u.username, u.full_name FROM user_booth ub JOIN users u ON u.id = ub.user_id
      WHERE u.role = 'POLLING_OFFICER' AND ub.booth_id IN (${boothIds.map(Number).join(',') || '0'})`,
  );
  return new Map(rows.map((r) => [Number(r.booth_id), { id: Number(r.id), username: String(r.username), fullName: r.full_name as string | null, role: 'POLLING_OFFICER' }]));
}

/** When this booth reports a step: inside its window, ~6% late, never in the future; null = skip. */
function reportTime(step: Step, now: Date, rand: () => number, late: boolean): Date | null {
  const due = step.dueBy?.getTime() ?? now.getTime();
  const opens = step.opensAt?.getTime() ?? due - 3 * 60 * MINUTE;
  const t = late ? due + (5 + rand() * 40) * MINUTE : opens + rand() * Math.max(MINUTE, due - opens);
  return t <= now.getTime() ? new Date(t) : null;
}

async function run(pool: Pool, officerPassword: string | undefined): Promise<boolean> {
  const rand = rng(20261112);
  const [admins] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE role = 'DISTRICT_ADMIN' ORDER BY id LIMIT 1");
  const adminId = Number(admins[0]?.id ?? 0);
  if (adminId === 0) throw new Error('create the admin first (npm run admin:create)');
  const steps = await loadSteps(pool, { activeOnly: true });
  if (steps.length === 0) throw new Error('no steps (npm run seed:steps)');
  const now = await dbNow(pool);

  const boothIds = await pickBooths(pool, rand);
  const officers = await officersOf(pool, boothIds);
  const missing = boothIds.filter((b) => !officers.has(b));
  if (missing.length > 0) {
    if (officerPassword === undefined) throw new Error('new demo officers need --officer-password <pw> (8+ chars, a letter and a digit)');
    const [labels] = await pool.query<RowDataPacket[]>(
      `SELECT b.id, ps.code, b.booth_no FROM booth b JOIN panchayat_samiti ps ON ps.id = b.panchayat_samiti_id WHERE b.id IN (${missing.join(',')})`,
    );
    const labelOf = new Map(labels.map((r) => [Number(r.id), boothLabel(String(r.code), Number(r.booth_no))]));
    await createOfficers(
      pool,
      missing.map((boothId) => ({
        boothId,
        fullName: `${FIRST[Math.floor(rand() * FIRST.length)] ?? 'राम'} ${LAST[Math.floor(rand() * LAST.length)] ?? 'शर्मा'}`,
        mobile: `9${String(Math.floor(rand() * 1e9)).padStart(9, '0')}`,
        username: `demo-${(labelOf.get(boothId) ?? String(boothId)).toLowerCase()}`,
        password: officerPassword,
      })),
      { userId: adminId, ip: null },
      'OFFICER_BULK_CREATE',
    );
  }
  const officerByBooth = await officersOf(pool, boothIds);
  const [voterRows] = await pool.query<RowDataPacket[]>(`SELECT id, registered_voters_total FROM booth WHERE id IN (${boothIds.join(',')})`);
  const voters = new Map(voterRows.map((r) => [Number(r.id), Number(r.registered_voters_total)]));

  let reports = 0;
  let skipped = 0;
  const reasons = new Map<string, number>();
  for (const [i, boothId] of boothIds.entries()) {
    const officer = officerByBooth.get(boothId);
    if (!officer) continue;
    if (i % 12 === 5) continue; // ~8% of booths have reported nothing
    const registered = voters.get(boothId) ?? 0;
    const finalShare = 0.6 + rand() * 0.18;
    const maleShare = 0.5 + rand() * 0.06;
    const third = rand() < 0.08 ? 1 : 0; // per booth: turnout is cumulative, so it never drops
    const slow = i % 9 === 3; // a few booths stop reporting part way (they show as "behind")
    let slot = 0;
    for (const [n, step] of steps.entries()) {
      if (slow && n > 6) break;
      const at = reportTime(step, now, rand, rand() < 0.06);
      if (at === null) continue;
      let values: ReportValues = {};
      if (step.type === 'NUMBER') values = { value: step.numberLabelHi?.includes('कतार') ? Math.floor(rand() * 40) : 2 + Math.floor(rand() * 5) };
      if (step.type === 'TURNOUT') {
        const share = Math.min(TURNOUT_CURVE[slot] ?? 0.7, 0.75) * (finalShare / 0.71);
        slot++;
        const total = Math.min(registered, Math.round(registered * share));
        const male = Math.round(total * maleShare);
        values = { turnout: { male, female: Math.max(0, total - male - third), third } };
      }
      try {
        await saveReport(pool, officer, boothId, step.id, values, { kind: 'create' }, { ip: null, at });
        reports++;
      } catch (err) {
        skipped++; // already reported in an earlier run, or a rule refused it: the rules win
        const code = err instanceof Error ? err.message : 'unknown';
        reasons.set(code, (reasons.get(code) ?? 0) + 1);
      }
    }
  }

  // Issues: ~10 resolved (earlier today) and ~6 still open.
  let issues = 0;
  const [existingIssues] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM issue WHERE booth_id IN (${boothIds.join(',')})`);
  const issueBooths = Number(existingIssues[0]?.n) > 0 ? [] : boothIds.slice(20, 36); // once per demo
  for (const [n, boothId] of issueBooths.entries()) {
    const officer = officerByBooth.get(boothId);
    if (!officer) continue;
    const resolved = n < 10;
    const started = new Date(now.getTime() - (resolved ? 120 + rand() * 300 : 5 + rand() * 75) * MINUTE);
    try {
      const type = ISSUE_TYPES[Math.floor(rand() * ISSUE_TYPES.length)] ?? 'OTHER';
      const id = await openIssue(pool, officer, boothId, { type, note: null }, { ip: null, at: started });
      if (resolved) {
        const end = new Date(started.getTime() + (10 + rand() * 80) * MINUTE);
        await resolveIssue(pool, officer, boothId, id, RESOLUTIONS[n % RESOLUTIONS.length] ?? 'हल', { ip: null, at: end });
      }
      issues++;
    } catch {
      skipped++; // an issue is already open there
    }
  }
  console.log(`Demo: ${boothIds.length} booths, ${reports} reports, ${issues} issues (${skipped} skipped${reasons.size > 0 ? `: ${JSON.stringify(Object.fromEntries(reasons))}` : ''}). As of ${now.toISOString()}.`);
  return true;
}

async function reset(pool: Pool): Promise<boolean> {
  const ids = await demoBoothIds(pool);
  if (ids.length === 0) {
    console.log('No demo booths recorded; nothing to reset.');
    return true;
  }
  const list = ids.map(Number).join(',');
  const [hist] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM step_report_history h JOIN step_report r ON r.id = h.report_id WHERE r.booth_id IN (${list})`,
  );
  if (Number(hist[0]?.n) > 0) {
    console.error('Demo booths have edit history (append-only, cannot be deleted). Reset refused.');
    return false;
  }
  const [r] = await pool.query(`DELETE FROM step_report WHERE booth_id IN (${list})`);
  const [i] = await pool.query(`DELETE FROM issue WHERE booth_id IN (${list})`);
  console.log(`Reset: ${(r as { affectedRows: number }).affectedRows} reports and ${(i as { affectedRows: number }).affectedRows} issues removed (demo officers kept).`);
  return true;
}

if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: { reset: { type: 'boolean', default: false }, 'officer-password': { type: 'string' } } });
  await runScript(async (pool, env) => {
    // --reset only removes demo data, so it is always allowed (also after DEMO_ALLOWED=false).
    if (!values.reset && env.NODE_ENV === 'production' && env.DEMO_ALLOWED !== 'true') {
      console.error('demo:poll refuses to run in production (DEMO_ALLOWED is not true).');
      return false;
    }
    if (!values.reset && env.NODE_ENV === 'production') {
      console.warn('WARNING: demo data in PRODUCTION. Before real use: npm run demo:poll -- --reset, then DEMO_ALLOWED=false.');
    }
    const pw = values['officer-password'];
    if (pw !== undefined && passwordProblem(pw, 'demo') !== null) {
      console.error(`--officer-password not accepted: ${String(passwordProblem(pw, 'demo'))}`);
      return false;
    }
    return values.reset ? reset(pool) : run(pool, pw);
  });
}
