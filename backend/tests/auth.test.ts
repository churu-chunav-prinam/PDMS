import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MAX_FAILED_LOGINS } from '../src/config/constants.js';
import { buildApp, createUser, csrfToken, login, post, seedGeography } from './helpers/app.js';
import { countRows, createTestAppPool, createTestMigrationPool, resetData } from './helpers/db.js';

const pool: Pool = createTestAppPool();
const migrationPool = createTestMigrationPool();
afterAll(async () => {
  await pool.end();
  await migrationPool.end();
});

describe('login, lockout and roles', () => {
  let boothId = 0;
  beforeEach(async () => {
    await resetData(migrationPool);
    boothId = (await seedGeography(pool)).rtg[0] ?? 0;
    await createUser(pool, { username: 'admin', role: 'DISTRICT_ADMIN', password: 'admin-pass-123' });
    await createUser(pool, { username: 'RTG-001', role: 'POLLING_OFFICER', password: 'officer-pass', boothId });
  });

  it('logs in (username case-insensitive) and returns the role', async () => {
    const res = await login(request.agent(buildApp(pool)), 'rtg-001', 'officer-pass');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { username: 'RTG-001', role: 'POLLING_OFFICER' } });
  });

  it('gives the same answer for an unknown user and a wrong password', async () => {
    const app = buildApp(pool);
    const a = await login(request.agent(app), 'nobody', 'x');
    const b = await login(request.agent(app), 'admin', 'wrong');
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(a.body).toEqual(b.body);
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} wrong passwords, even for the right password`, async () => {
    const agent = request.agent(buildApp(pool));
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) expect((await login(agent, 'admin', 'bad')).status).toBe(401);
    const res = await login(agent, 'admin', 'admin-pass-123');
    expect(res.status).toBe(423);
    expect(res.body).toMatchObject({ error: 'ACCOUNT_LOCKED' });
    expect(await countRows(pool, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'ACCOUNT_LOCKED'")).toBe(1);
  });

  it('refuses a disabled user', async () => {
    await createUser(pool, { username: 'RTG-002', role: 'POLLING_OFFICER', password: 'pw-pw-pw', active: false });
    expect((await login(request.agent(buildApp(pool)), 'RTG-002', 'pw-pw-pw')).status).toBe(401);
  });

  it('refuses a state-changing request without the CSRF token', async () => {
    const agent = request.agent(buildApp(pool));
    await csrfToken(agent);
    const res = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin-pass-123' });
    expect(res.status).toBe(403);
  });

  it('keeps an officer and an anonymous user out of every admin route', async () => {
    const app = buildApp(pool);
    expect((await request(app).get('/api/admin/ps')).status).toBe(401);
    const officer = request.agent(app);
    await login(officer, 'RTG-001', 'officer-pass');
    expect((await officer.get('/api/admin/ps')).status).toBe(403);
    expect((await officer.get(`/api/admin/booths?ps=1`)).status).toBe(403);
    const add = { boothId, fullName: 'Ram', mobile: '9876543210', username: 'ram01', password: 'abcd1234', confirmPassword: 'abcd1234' };
    expect((await post(officer, '/api/admin/officers', add)).status).toBe(403);
    expect((await post(officer, '/api/admin/officers/1/password', { password: 'abcd1234', confirmPassword: 'abcd1234' })).status).toBe(403);
    expect((await post(officer, '/api/profile/password', { currentPassword: 'officer-pass', password: 'abcd1234', confirmPassword: 'abcd1234' })).status).toBe(403);
  });

  it('ends the session at once when the user is disabled', async () => {
    const agent = request.agent(buildApp(pool));
    await login(agent, 'RTG-001', 'officer-pass');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await pool.execute("UPDATE users SET is_active = 0 WHERE username = 'RTG-001'");
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('sends a strict CSP', async () => {
    const res = await request(buildApp(pool)).get('/api/auth/csrf');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});
