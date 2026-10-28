import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, createUser, login, post, seedGeography, setEnforceStepTimes } from './helpers/app.js';
import type { Agent } from './helpers/app.js';
import { countRows, createTestAppPool, createTestMigrationPool, insert, resetData } from './helpers/db.js';

const pool: Pool = createTestAppPool();
const migrationPool = createTestMigrationPool();
afterAll(async () => {
  await pool.end();
  await migrationPool.end();
});

const step = (order: number, type: string, marker: string | null = null) =>
  insert(
    pool,
    `INSERT INTO step (phase, sort_order, name_hi, name_en, step_type, marker, opens_at, due_by)
     VALUES ('POLL_DAY', ?, ?, ?, ?, ?, NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 1 MINUTE)`,
    [order, `चरण ${order}`, `Step ${order}`, type, marker],
  );

const stepBody = (over: object = {}) => ({
  phase: 'POLL_DAY', sortOrder: 10, nameHi: 'मतदान प्रारंभ', nameEn: 'Poll started', type: 'DONE',
  numberLabelHi: null, numberLabelEn: null, opensAt: null, dueBy: null, ...over,
});

describe('district dashboard and step master', () => {
  let admin: Agent;
  let officer: Agent;
  let booths: number[];
  beforeEach(async () => {
    await resetData(migrationPool);
    const geo = await seedGeography(pool);
    booths = [...geo.rtg, ...geo.chu];
    await createUser(pool, { username: 'admin', role: 'DISTRICT_ADMIN', password: 'admin-pass-123' });
    await createUser(pool, { username: 'RTG-001', role: 'POLLING_OFFICER', password: 'pw-a-12345', boothId: booths[0] ?? 0 });
    const app = buildApp(pool);
    admin = request.agent(app);
    officer = request.agent(app);
    await login(admin, 'admin', 'admin-pass-123');
    await login(officer, 'RTG-001', 'pw-a-12345');
  });

  it('an officer can read nothing of the district', async () => {
    for (const path of ['/api/district/dashboard', '/api/district/booths', `/api/district/booths/${booths[1] ?? 0}`, '/api/district/audit', '/api/district/export/reports', '/api/district/steps']) {
      expect((await officer.get(path)).status, path).toBe(403);
    }
    expect((await post(officer, '/api/district/settings/poll-date', { pollDate: '2026-01-01' })).status).toBe(403);
  });

  it('dashboard with times ENFORCED: poll started, turnout %, booths behind, open issues', async () => {
    await setEnforceStepTimes(pool, true);
    const start = await step(10, 'DONE', 'POLL_START');
    const nine = await step(20, 'TURNOUT');
    await post(officer, `/api/officer/steps/${start}/report`, {});
    await post(officer, `/api/officer/steps/${nine}/report`, { turnout: { male: 60, female: 39, third: 1 } });
    await post(officer, '/api/officer/issues', { type: 'EVM_FAULT', note: null });
    const d = (await admin.get('/api/district/dashboard')).body as {
      cards: { totalBooths: number; pollStarted: number; turnout: { percent: number }; boothsBehind: number };
      openIssues: unknown[];
      perStep: { reported: number; late: number }[];
    };
    // 4 booths x 800 voters; one booth reported 100 -> 12.5% of reporting booths.
    expect(d.cards).toMatchObject({ totalBooths: 4, pollStarted: 1, turnout: { percent: 12.5 }, boothsBehind: 3 });
    expect(d.openIssues).toHaveLength(1);
    expect(d.perStep[0]).toMatchObject({ reported: 1, late: 1 });
    const pending = (await admin.get(`/api/district/steps/${start}/pending`)).body as { booths: unknown[] };
    expect(pending.booths).toHaveLength(3);
    const issueOnly = (await admin.get('/api/district/booths?filter=issue')).body as { total: number };
    expect(issueOnly.total).toBe(1);
  });

  it('dashboard with times OFF (default): nothing behind, overdue, late or locked', async () => {
    const start = await step(10, 'DONE', 'POLL_START');
    await post(officer, `/api/officer/steps/${start}/report`, {});
    const d = (await admin.get('/api/district/dashboard')).body as {
      enforceStepTimes: boolean;
      cards: { boothsBehind: number; pollStarted: number };
      perStep: { late: number; overdue: boolean; open: boolean }[];
    };
    expect(d.enforceStepTimes).toBe(false);
    expect(d.cards).toMatchObject({ pollStarted: 1, boothsBehind: 0 });
    expect(d.perStep[0]).toMatchObject({ late: 0, overdue: false, open: true });
    expect(((await admin.get('/api/district/booths?filter=behind')).body as { total: number }).total).toBe(0);
  });

  it('the time setting: admin only, audited, default off', async () => {
    expect(((await admin.get('/api/district/settings')).body as { enforceStepTimes: boolean }).enforceStepTimes).toBe(false);
    expect((await post(officer, '/api/district/settings/enforce-step-times', { enabled: true })).status).toBe(403);
    expect((await post(admin, '/api/district/settings/enforce-step-times', { enabled: true })).body).toEqual({ enforceStepTimes: true });
    expect(((await admin.get('/api/district/settings')).body as { enforceStepTimes: boolean }).enforceStepTimes).toBe(true);
    expect(await countRows(pool, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'ENFORCE_STEP_TIMES_SET'")).toBe(1);
    const s = await step(10, 'DONE');
    await pool.execute('UPDATE step SET opens_at = NOW() + INTERVAL 1 HOUR, due_by = NOW() + INTERVAL 2 HOUR WHERE id = ?', [s]);
    expect((await post(officer, `/api/officer/steps/${s}/report`, {})).body).toMatchObject({ error: 'STEP_NOT_OPEN' });
    await post(admin, '/api/district/settings/enforce-step-times', { enabled: false });
    expect((await post(officer, `/api/officer/steps/${s}/report`, {})).status).toBe(201);
  });

  it('poll date: moving it shifts every step by the same days', async () => {
    await post(admin, '/api/district/steps', stepBody({ opensAt: '2026-11-12T07:30', dueBy: '2026-11-12T07:45' }));
    const res = await post(admin, '/api/district/settings/poll-date', { pollDate: '2026-11-15' });
    expect(res.body).toEqual({ pollDate: '2026-11-15', shiftedDays: 3 });
    expect(await countRows(pool, "SELECT COUNT(*) AS n FROM step WHERE opens_at = '2026-11-15 07:30:00' AND due_by = '2026-11-15 07:45:00'")).toBe(1);
    expect(((await admin.get('/api/district/settings')).body as { pollDate: string }).pollDate).toBe('2026-11-15');
  });

  it('a step with reports can be deactivated, but not deleted or changed in type', async () => {
    const s = await step(10, 'DONE');
    await post(officer, `/api/officer/steps/${s}/report`, {});
    expect((await post(admin, `/api/district/steps/${s}/delete`)).status).toBe(409);
    expect((await post(admin, `/api/district/steps/${s}/update`, stepBody({ type: 'NUMBER', numberLabelHi: 'संख्या' }))).body).toMatchObject({ error: 'STEP_HAS_REPORTS' });
    expect((await post(admin, `/api/district/steps/${s}/active`, { active: false })).status).toBe(204);
    expect(((await officer.get('/api/officer/home')).body as { progress: { total: number } }).progress.total).toBe(0);
    const fresh = await step(20, 'DONE');
    expect((await post(admin, `/api/district/steps/${fresh}/delete`)).status).toBe(204);
  });
});
