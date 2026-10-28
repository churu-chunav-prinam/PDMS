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

/** A step whose window is relative to the DB clock: opens/due in minutes from now (null = none). */
async function step(order: number, type: string, opensMin: number | null, dueMin: number | null, phase = 'POLL_DAY') {
  const at = (m: number | null) => (m === null ? 'NULL' : `NOW() + INTERVAL ${m} MINUTE`);
  return insert(
    pool,
    `INSERT INTO step (phase, sort_order, name_hi, name_en, step_type, number_label_hi, opens_at, due_by)
     VALUES (?, ?, ?, ?, ?, ?, ${at(opensMin)}, ${at(dueMin)})`,
    [phase, order, `चरण ${order}`, `Step ${order}`, type, type === 'NUMBER' ? 'संख्या' : null],
  );
}

const turnout = (male: number, female: number, third = 0) => ({ turnout: { male, female, third } });

describe('polling officer app', () => {
  let a: Agent;
  let b: Agent;
  let boothA = 0;
  let boothB = 0;
  beforeEach(async () => {
    await resetData(migrationPool);
    const geo = await seedGeography(pool); // every booth has 800 registered voters
    boothA = geo.rtg[0] ?? 0;
    boothB = geo.rtg[1] ?? 0;
    await createUser(pool, { username: 'RTG-001', role: 'POLLING_OFFICER', password: 'pw-a-12345', boothId: boothA });
    await createUser(pool, { username: 'RTG-002', role: 'POLLING_OFFICER', password: 'pw-b-12345', boothId: boothB });
    const app = buildApp(pool);
    a = request.agent(app);
    b = request.agent(app);
    await login(a, 'RTG-001', 'pw-a-12345');
    await login(b, 'RTG-002', 'pw-b-12345');
  });

  it('home shows only the officer’s own booth and progress', async () => {
    await step(10, 'DONE', -60, 60);
    const res = await a.get('/api/officer/home');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ booth: { id: boothA, boothNo: 1, registeredVoters: 800 }, progress: { done: 0, total: 1 } });
  });

  it('an officer can never write another booth: reports go to their own booth only', async () => {
    const s = await step(10, 'DONE', -60, 60);
    // The API has no booth parameter at all: extra fields are refused, not obeyed.
    expect((await post(a, `/api/officer/steps/${s}/report`, { boothId: boothB })).status).toBe(400);
    expect((await post(a, `/api/officer/steps/${s}/report`, {})).status).toBe(201);
    expect(await countRows(pool, 'SELECT COUNT(*) AS n FROM step_report WHERE booth_id = ?', [boothB])).toBe(0);
    const bSteps = await b.get('/api/officer/steps?phase=POLL_DAY');
    expect((bSteps.body as { steps: { status: string }[] }).steps[0]?.status).toBe('pending');
  });

  it('an officer cannot resolve another booth’s issue', async () => {
    const res = await post(b, '/api/officer/issues', { type: 'EVM_FAULT', note: 'EVM बंद' });
    const issueId = (res.body as { id: number }).id;
    expect((await post(a, `/api/officer/issues/${issueId}/resolve`, { resolution: 'ठीक हो गया' })).status).toBe(404);
    expect((await a.get('/api/officer/issues')).body).toEqual({ issues: [] });
  });

  it('times ENFORCED: refuses a step before it opens, flags a late one, refuses a second report', async () => {
    await setEnforceStepTimes(pool, true);
    const locked = await step(10, 'DONE', 30, 60);
    const late = await step(20, 'DONE', -60, -5);
    const res = await post(a, `/api/officer/steps/${locked}/report`, {});
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'STEP_NOT_OPEN' });
    expect((await post(a, `/api/officer/steps/${late}/report`, {})).body).toMatchObject({ late: true });
    expect((await post(a, `/api/officer/steps/${late}/report`, {})).status).toBe(409);
  });

  it('times OFF (default): a not-yet-open step can be reported, nothing is late, no times are shown', async () => {
    const locked = await step(10, 'DONE', 30, 60);
    const past = await step(20, 'DONE', -60, -5);
    const steps = (await a.get('/api/officer/steps?phase=POLL_DAY')).body as { enforceStepTimes: boolean; steps: { status: string; opensAt: unknown; dueBy: unknown }[] };
    expect(steps.enforceStepTimes).toBe(false);
    expect(steps.steps.map((s) => [s.status, s.opensAt, s.dueBy])).toEqual([['pending', null, null], ['pending', null, null]]);
    expect((await post(a, `/api/officer/steps/${locked}/report`, {})).body).toMatchObject({ late: false });
    expect((await post(a, `/api/officer/steps/${past}/report`, {})).body).toMatchObject({ late: false });
    expect((await post(a, `/api/officer/steps/${past}/report`, {})).status).toBe(409); // still one report per step
    expect(((await a.get('/api/officer/home')).body as { phases: { overdue: number }[] }).phases.every((p) => p.overdue === 0)).toBe(true);
  });

  it('times OFF: the data rules still apply (cumulative, registered voters, edit reason)', async () => {
    const nine = await step(30, 'TURNOUT', 60, 90); // opens in the future: irrelevant when times are off
    const eleven = await step(40, 'TURNOUT', 120, 150);
    expect((await post(a, `/api/officer/steps/${nine}/report`, turnout(100, 90, 1))).status).toBe(201);
    expect((await post(a, `/api/officer/steps/${eleven}/report`, turnout(99, 90, 1))).body).toMatchObject({ problems: [{ code: 'BELOW_PREVIOUS' }] });
    expect((await post(a, `/api/officer/steps/${eleven}/report`, turnout(500, 300, 1))).body).toMatchObject({ problems: [{ code: 'EXCEEDS_REGISTERED' }] });
    expect((await post(a, `/api/officer/steps/${nine}/edit`, turnout(101, 90, 1))).status).toBe(400); // no reason
  });

  it('turnout: cumulative across slots and capped by registered voters', async () => {
    const nine = await step(30, 'TURNOUT', -120, 60);
    const eleven = await step(40, 'TURNOUT', -60, 60);
    expect((await post(a, `/api/officer/steps/${nine}/report`, turnout(100, 90, 1))).status).toBe(201);
    const below = await post(a, `/api/officer/steps/${eleven}/report`, turnout(150, 80, 1));
    expect(below.status).toBe(400);
    expect(below.body).toMatchObject({ error: 'REPORT_INVALID', problems: [{ code: 'BELOW_PREVIOUS', field: 'female', previous: 90 }] });
    expect((await post(a, `/api/officer/steps/${eleven}/report`, turnout(500, 300, 1))).body).toMatchObject({
      problems: [{ code: 'EXCEEDS_REGISTERED', total: 801 }],
    });
    expect((await post(a, `/api/officer/steps/${eleven}/report`, turnout(200, 150, 1))).status).toBe(201);
    // Editing the earlier slot above the later one is refused.
    const up = await post(a, `/api/officer/steps/${nine}/edit`, { ...turnout(201, 90, 1), reason: 'गलत संख्या' });
    expect(up.body).toMatchObject({ problems: [{ code: 'ABOVE_NEXT' }] });
    const steps = (await a.get('/api/officer/steps?phase=POLL_DAY')).body as { steps: { previousTurnout: { total: number } | null }[] };
    expect(steps.steps[1]?.previousTurnout?.total).toBe(191);
  });

  it('an edit needs a reason and keeps the old values in history', async () => {
    const s = await step(10, 'NUMBER', -60, 60);
    await post(a, `/api/officer/steps/${s}/report`, { value: 3 });
    expect((await post(a, `/api/officer/steps/${s}/edit`, { value: 4 })).status).toBe(400);
    expect((await post(a, `/api/officer/steps/${s}/edit`, { value: 4, reason: 'एक अभिकर्ता देर से आए' })).status).toBe(200);
    const [rows] = await pool.query('SELECT old_value, new_value, reason FROM step_report_history');
    expect(rows).toEqual([{ old_value: { value: 3 }, new_value: { value: 4 }, reason: 'एक अभिकर्ता देर से आए' }]);
    await expect(pool.execute('DELETE FROM step_report_history')).rejects.toThrow();
  });

  it('issues: one open at a time; resolving stores time and duration, then a new one is allowed', async () => {
    expect((await post(a, '/api/officer/issues', { type: 'LAW_ORDER', note: null })).status).toBe(201);
    const second = await post(a, '/api/officer/issues', { type: 'OTHER', note: null });
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ error: 'ISSUE_ALREADY_OPEN' });
    const list = (await a.get('/api/officer/issues')).body as { issues: { id: number }[] };
    const id = list.issues[0]?.id ?? 0;
    expect((await post(a, `/api/officer/issues/${id}/resolve`, { resolution: 'पुलिस पहुँची' })).status).toBe(204);
    expect((await post(a, `/api/officer/issues/${id}/resolve`, { resolution: 'फिर से' })).status).toBe(409);
    const after = (await a.get('/api/officer/issues')).body as { issues: { resolvedAt: string | null; durationSeconds: number | null }[] };
    expect(after.issues[0]?.resolvedAt).not.toBeNull();
    expect(after.issues[0]?.durationSeconds).toBeGreaterThanOrEqual(0);
    expect((await post(a, '/api/officer/issues', { type: 'OTHER', note: 'नई समस्या' })).status).toBe(201);
  });

  it('an admin is not an officer: /api/officer is refused', async () => {
    await createUser(pool, { username: 'admin', role: 'DISTRICT_ADMIN', password: 'admin-pass-123' });
    const admin = request.agent(buildApp(pool));
    await login(admin, 'admin', 'admin-pass-123');
    expect((await admin.get('/api/officer/home')).status).toBe(403);
  });
});
