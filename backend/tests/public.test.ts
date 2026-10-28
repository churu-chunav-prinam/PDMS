import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, createUser, csrfToken, login, seedGeography } from './helpers/app.js';
import { createTestAppPool, createTestMigrationPool, resetData } from './helpers/db.js';

const pool: Pool = createTestAppPool();
const migrationPool = createTestMigrationPool();
afterAll(async () => {
  await pool.end();
  await migrationPool.end();
});

describe('public endpoints and login', () => {
  let geo: Awaited<ReturnType<typeof seedGeography>>;
  let app: ReturnType<typeof buildApp>;
  beforeEach(async () => {
    await resetData(migrationPool);
    geo = await seedGeography(pool);
    await createUser(pool, { username: 'RTG-001', role: 'POLLING_OFFICER', password: 'pw-a-12345', boothId: geo.rtg[0] ?? 0 });
    await createUser(pool, { username: 'admin', role: 'DISTRICT_ADMIN', password: 'admin-pass-123' });
    app = buildApp(pool);
  });

  it('only the landing info is public (no cookie); the booth lists are gone', async () => {
    const info = await request(app).get('/api/public/info');
    expect(info.status).toBe(200);
    expect(info.headers['set-cookie']).toBeUndefined();
    expect(info.body).toMatchObject({ pollDate: '2026-11-12', election: { hi: expect.stringContaining('2026') as unknown } });
    for (const path of ['/api/public/ps', `/api/public/ps/${geo.rtgPs}/wards`, '/api/public/wards/1/booths']) {
      expect((await request(app).get(path)).status, path).toBe(404);
    }
  });

  it('the booth-based login route is gone; officers log in with username + password', async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    const res = await agent.post('/api/auth/login-booth').set('X-CSRF-Token', token).send({ boothId: geo.rtg[0], password: 'pw-a-12345' });
    expect(res.status).toBe(404);
    expect((await login(request.agent(app), 'RTG-001', 'pw-a-12345')).body).toMatchObject({ user: { role: 'POLLING_OFFICER' } });
  });

  it('the add-officer booth picker lists are admin only', async () => {
    const paths = ['/api/admin/ps', `/api/admin/ps/${geo.rtgPs}/wards`];
    for (const path of paths) expect((await request(app).get(path)).status, path).toBe(401);
    const officer = request.agent(app);
    await login(officer, 'RTG-001', 'pw-a-12345');
    for (const path of paths) expect((await officer.get(path)).status, path).toBe(403);
    const admin = request.agent(app);
    await login(admin, 'admin', 'admin-pass-123');
    const wards = (await admin.get(`/api/admin/ps/${geo.rtgPs}/wards`)).body as { wards: { id: number; wardNo: number }[] };
    expect(wards.wards).toHaveLength(1);
    const booths = (await admin.get(`/api/admin/wards/${wards.wards[0]?.id ?? 0}/booths`)).body as { booths: unknown[] };
    expect(booths.booths).toEqual([
      { id: geo.rtg[0], boothNo: 1, nameHi: 'बूथ 1' },
      { id: geo.rtg[1], boothNo: 2, nameHi: 'बूथ 2' },
      { id: geo.rtg[2], boothNo: 45, nameHi: 'बूथ 45' },
    ]);
  });
});
