import type { Pool, RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BULK_TEMPLATE } from '../src/modules/admin/officers.read.js';
import { readRows, writeWorkbook } from '../src/services/xlsx.js';
import type { Cell } from '../src/services/xlsx.js';
import { buildApp, createUser, csrfToken, login, post, seedGeography } from './helpers/app.js';
import type { Agent } from './helpers/app.js';
import { countRows, createTestAppPool, createTestMigrationPool, resetData } from './helpers/db.js';

const pool: Pool = createTestAppPool();
const migrationPool = createTestMigrationPool();
afterAll(async () => {
  await pool.end();
  await migrationPool.end();
});

const ADMIN_PW = 'admin-pass-123';
const officers = () => countRows(pool, "SELECT COUNT(*) AS n FROM users WHERE role = 'POLLING_OFFICER'");
const bulkFile = async (rows: Cell[][]) => (await writeWorkbook([{ ...BULK_TEMPLATE, rows }])).toString('base64');
const officer = (boothId: number, over: Record<string, unknown> = {}) => ({
  boothId, fullName: 'राम कुमार', mobile: '9876543210', username: 'ram.kumar', password: 'Ratan2026', confirmPassword: 'Ratan2026', ...over,
});

/** Every audit_log value as one text, to prove no password ever reached it. */
async function auditText(): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT action, old_value, new_value, reason FROM audit_log');
  return JSON.stringify(rows);
}

describe('officer accounts: typed by the admin, never generated', () => {
  let geo: Awaited<ReturnType<typeof seedGeography>>;
  let admin: Agent;
  let app: ReturnType<typeof buildApp>;
  beforeEach(async () => {
    await resetData(migrationPool);
    geo = await seedGeography(pool);
    await createUser(pool, { username: 'admin', role: 'DISTRICT_ADMIN', password: ADMIN_PW });
    app = buildApp(pool);
    admin = request.agent(app);
    await login(admin, 'admin', ADMIN_PW);
  });

  it('creates the account with exactly the username and password typed', async () => {
    const res = await post(admin, '/api/admin/officers', officer(geo.rtg[2] ?? 0));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ officer: { username: 'ram.kumar' } });
    expect(JSON.stringify(res.body)).not.toContain('Ratan2026'); // the password never comes back
    expect((await login(request.agent(app), 'RAM.KUMAR', 'Ratan2026')).status).toBe(200); // case-insensitive username
  });

  it('every field is required', async () => {
    for (const field of ['fullName', 'mobile', 'username', 'password', 'confirmPassword']) {
      const body = Object.fromEntries(Object.entries(officer(geo.rtg[0] ?? 0)).filter(([k]) => k !== field));
      const res = await post(admin, '/api/admin/officers', body);
      expect(res.status, field).toBe(400);
    }
    expect(await officers()).toBe(0);
  });

  it('mobile: exactly 10 digits starting 6-9', async () => {
    for (const mobile of ['5876543210', '987654321', '98765432101', '98765abcde']) {
      expect((await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0, { mobile }))).status, mobile).toBe(400);
    }
    expect((await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0, { mobile: '6000000000' }))).status).toBe(201);
  });

  it('username: allowed characters, and unique ignoring case', async () => {
    expect((await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0, { username: 'ab' }))).status).toBe(400);
    expect((await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0, { username: 'ram kumar' }))).status).toBe(400);
    expect((await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0))).status).toBe(201);
    const dup = await post(admin, '/api/admin/officers', officer(geo.rtg[1] ?? 0, { username: 'RAM.Kumar' }));
    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ error: 'USERNAME_TAKEN' });
    const taken = await post(admin, '/api/admin/officers', officer(geo.rtg[1] ?? 0, { username: 'ADMIN' }));
    expect(taken.body).toEqual({ error: 'USERNAME_TAKEN' });
    expect(await officers()).toBe(1);
  });

  it('weak passwords are refused with the reason', async () => {
    const cases: [string, string][] = [
      ['abc123', 'PASSWORD_TOO_SHORT'],
      ['abcdefgh', 'PASSWORD_NEEDS_LETTER_AND_DIGIT'],
      ['12345678', 'PASSWORD_NEEDS_LETTER_AND_DIGIT'],
      ['Ram.kumar1', 'PASSWORD_SAME_AS_USERNAME'],
    ];
    for (const [password, reason] of cases) {
      const res = await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0, { username: 'ram.kumar1', password, confirmPassword: password }));
      expect(res.body, password).toEqual({ error: 'PASSWORD_WEAK', reason });
    }
    const mismatch = await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0, { confirmPassword: 'Other2026' }));
    expect(mismatch.status).toBe(400);
    expect(await officers()).toBe(0);
  });

  it('refuses a second active officer for the same booth', async () => {
    await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0));
    const res = await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0, { username: 'other' }));
    expect(res.body).toMatchObject({ error: 'BOOTH_HAS_OFFICER' });
  });

  it('set password / change username end the officer sessions', async () => {
    const id = ((await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0))).body as { officer: { userId: number } }).officer.userId;
    const phone = request.agent(app);
    await login(phone, 'ram.kumar', 'Ratan2026');
    expect((await phone.get('/api/officer/home')).status).toBe(200);

    expect((await post(admin, `/api/admin/officers/${id}/password`, { password: 'Churu2026x', confirmPassword: 'Churu2026x' })).status).toBe(204);
    expect((await phone.get('/api/officer/home')).status).toBe(401); // session ended
    expect((await login(request.agent(app), 'ram.kumar', 'Ratan2026')).status).toBe(401);
    expect((await login(phone, 'ram.kumar', 'Churu2026x')).status).toBe(200);

    const edit = { fullName: 'राम कुमार शर्मा', mobile: '9123456780', username: 'rk.sharma' };
    expect((await post(admin, `/api/admin/officers/${id}/update`, edit)).status).toBe(204);
    expect((await phone.get('/api/officer/home')).status).toBe(401); // session ended again
    expect((await login(request.agent(app), 'rk.sharma', 'Churu2026x')).status).toBe(200);
    // A weak new password is refused; a username equal to the password is refused too.
    expect((await post(admin, `/api/admin/officers/${id}/password`, { password: 'short1', confirmPassword: 'short1' })).body).toMatchObject({ error: 'PASSWORD_WEAK' });
    expect((await post(admin, `/api/admin/officers/${id}/update`, { ...edit, username: 'Churu2026x' })).body).toEqual({ error: 'PASSWORD_WEAK', reason: 'PASSWORD_SAME_AS_USERNAME' });
  });

  it('bulk: dry run checks every rule, never echoes passwords, and a bad file writes nothing', async () => {
    const file = await bulkFile([
      ['RTG-001', 'Ram', '9876543210', 'ram01', 'Ratan2026'],
      ['RTG-1', 'Shyam', '9876543211', 'shyam01', 'Ratan2026'], // same booth again
      ['XXX-002', 'Mohan', '9876543212', 'mohan01', 'Ratan2026'], // unknown PS
      ['CHU-001', 'Sita', '123', 'RAM01', 'weak'], // bad mobile, username dup in file, weak password
      ['RTG-045', 'Gita', '9876543213', 'admin', 'Gita20261'], // username taken
    ]);
    const dry = await post(admin, '/api/admin/officers/bulk', { file, commit: false });
    expect(dry.status).toBe(200);
    const rows = (dry.body as { rows: { problems: string[] }[] }).rows;
    expect(rows.map((r) => r.problems)).toEqual([
      [],
      ['DUPLICATE_IN_FILE'],
      ['PS_CODE_UNKNOWN'],
      ['MOBILE_INVALID', 'DUPLICATE_USERNAME_IN_FILE', 'PASSWORD_TOO_SHORT'],
      ['USERNAME_TAKEN'],
    ]);
    expect(JSON.stringify(dry.body)).not.toMatch(/Ratan2026|Gita20261|weak/);
    expect((await post(admin, '/api/admin/officers/bulk', { file, commit: true })).status).toBe(409);
    expect(await officers()).toBe(0);
  });

  it('bulk: a clean file creates every account in one go', async () => {
    const file = await bulkFile([
      ['RTG-001', 'Ram', '9876543210', 'ram01', 'Ratan2026'],
      ['chu 1', 'Sita Devi', 9876543211, 'sita01', 'Sita2026x'],
    ]);
    const res = await post(admin, '/api/admin/officers/bulk', { file, commit: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ committed: true, created: 2 });
    expect((await login(request.agent(app), 'sita01', 'Sita2026x')).status).toBe(200);
  });

  it('no password in the audit log or the officer Excel', async () => {
    const id = ((await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0))).body as { officer: { userId: number } }).officer.userId;
    await post(admin, `/api/admin/officers/${id}/password`, { password: 'Churu2026x', confirmPassword: 'Churu2026x' });
    await post(admin, '/api/admin/officers/bulk', { file: await bulkFile([['RTG-002', 'Shyam', '9876543211', 'shyam01', 'Shyam2026']]), commit: true });
    await post(admin, '/api/profile/password', { currentPassword: ADMIN_PW, password: 'NewAdmin2026', confirmPassword: 'NewAdmin2026' });
    const audit = await auditText();
    for (const pw of ['Ratan2026', 'Churu2026x', 'Shyam2026', 'NewAdmin2026', ADMIN_PW]) expect(audit, pw).not.toContain(pw);

    const token = await csrfToken(admin); // before building the request (supertest binds a server per request)
    const xlsx = await admin
      .post('/api/admin/credentials')
      .set('X-CSRF-Token', token)
      .send({ psId: geo.rtgPs, password: 'NewAdmin2026' })
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => {
          chunks.push(c);
        });
        r.on('end', () => {
          cb(null, Buffer.concat(chunks));
        });
      });
    expect(xlsx.status).toBe(200);
    const sheet = await readRows(xlsx.body as Buffer, ['Username', 'मोबाइल / Mobile']);
    expect(sheet.ok && sheet.rows.map((r) => r.cells.Username)).toEqual(['ram.kumar', 'shyam01']);
    expect((xlsx.body as Buffer).toString('latin1')).not.toMatch(/Password|Churu2026x|Shyam2026/);
  });

  it('audit_log is append-only for the app user', async () => {
    await post(admin, '/api/admin/officers', officer(geo.rtg[0] ?? 0));
    await expect(pool.execute('DELETE FROM audit_log')).rejects.toThrow();
    await expect(pool.execute("UPDATE audit_log SET action = 'X'")).rejects.toThrow();
  });
});

describe('admin profile: own username and password with the current password', () => {
  let app: ReturnType<typeof buildApp>;
  let admin: Agent;
  beforeEach(async () => {
    await resetData(migrationPool);
    await createUser(pool, { username: 'admin', role: 'DISTRICT_ADMIN', password: ADMIN_PW });
    app = buildApp(pool);
    admin = request.agent(app);
    await login(admin, 'admin', ADMIN_PW);
  });

  it('wrong current password is refused and counts toward the lockout', async () => {
    const res = await post(admin, '/api/profile/password', { currentPassword: 'wrong', password: 'NewAdmin2026', confirmPassword: 'NewAdmin2026' });
    expect(res.body).toEqual({ error: 'REAUTH_FAILED' });
    expect(await countRows(pool, "SELECT failed_login_count AS n FROM users WHERE username = 'admin'")).toBe(1);
  });

  it('password change: this session stays, other sessions end, the old password stops working', async () => {
    const laptop = request.agent(app);
    await login(laptop, 'admin', ADMIN_PW);
    expect((await post(admin, '/api/profile/password', { currentPassword: ADMIN_PW, password: 'NewAdmin2026', confirmPassword: 'NewAdmin2026' })).status).toBe(204);
    expect((await admin.get('/api/auth/me')).status).toBe(200);
    expect((await laptop.get('/api/auth/me')).status).toBe(401);
    expect((await login(request.agent(app), 'admin', ADMIN_PW)).status).toBe(401);
    expect((await login(request.agent(app), 'admin', 'NewAdmin2026')).status).toBe(200);
    expect((await post(admin, '/api/profile/password', { currentPassword: 'NewAdmin2026', password: 'admin', confirmPassword: 'admin' })).body).toMatchObject({ error: 'PASSWORD_WEAK' });
  });

  it('username change: unique, and login uses the new name', async () => {
    await createUser(pool, { username: 'taken.name', role: 'POLLING_OFFICER', password: 'x' });
    expect((await post(admin, '/api/profile/username', { currentPassword: ADMIN_PW, username: 'TAKEN.name' })).body).toEqual({ error: 'USERNAME_TAKEN' });
    expect((await post(admin, '/api/profile/username', { currentPassword: ADMIN_PW, username: 'dm.churu' })).status).toBe(204);
    expect((await login(request.agent(app), 'dm.churu', ADMIN_PW)).status).toBe(200);
    expect((await login(request.agent(app), 'admin', ADMIN_PW)).status).toBe(401);
  });
});
