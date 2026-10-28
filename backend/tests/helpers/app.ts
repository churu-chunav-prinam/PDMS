import bcrypt from 'bcrypt';
import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import type { Response } from 'supertest';
import { createApp } from '../../src/app.js';
import { API_RATE_LIMIT, LOGIN_RATE_LIMIT, PUBLIC_RATE_LIMIT } from '../../src/config/app-config.js';
import type { AppConfig } from '../../src/config/app-config.js';
import type { Role } from '../../src/config/constants.js';
import { insert } from './db.js';

export const TEST_ORIGIN = 'http://localhost:5174';

export function testAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    production: false,
    sessionSecret: 'test-session-secret-that-is-long-enough-1234',
    appOrigin: TEST_ORIGIN,
    sessionIdleMs: 30 * 60_000,
    sessionAbsoluteMs: 14 * 3_600_000,
    trustProxy: false,
    loginRateLimit: LOGIN_RATE_LIMIT,
    apiRateLimit: API_RATE_LIMIT,
    publicRateLimit: PUBLIC_RATE_LIMIT,
    frontendDist: null,
    pollDateDefault: '2026-11-12',
    ...overrides,
  };
}

export const buildApp = (pool: Pool, overrides: Partial<AppConfig> = {}) =>
  createApp({ pool, config: testAppConfig(overrides) });

export type Agent = ReturnType<typeof request.agent>;

/** Two PS (RTG with booths 1-3, CHU with booth 1). Returns booth ids. */
export async function seedGeography(pool: Pool): Promise<{ rtg: number[]; chu: number[]; rtgPs: number; chuPs: number }> {
  const d = await insert(pool, "INSERT INTO district (code, name_english, name_hindi) VALUES ('CHURU','Churu','चूरू')", []);
  const ps = async (code: string, en: string, hi: string) =>
    insert(pool, 'INSERT INTO panchayat_samiti (district_id, code, name_english, name_hindi) VALUES (?,?,?,?)', [d, code, en, hi]);
  const rtgPs = await ps('RTG', 'RATANGARH PANCHAYAT SAMITI', 'रतनगढ़');
  const chuPs = await ps('CHU', 'CHURU PANCHAYAT SAMITI', 'चूरू');
  const zp = await insert(pool, "INSERT INTO ward (ward_type, panchayat_samiti_id, ward_no) VALUES ('ZP', NULL, 1)", []);
  const booths = async (psId: number, nos: number[]) => {
    const w = await insert(pool, "INSERT INTO ward (ward_type, panchayat_samiti_id, ward_no) VALUES ('PS', ?, 1)", [psId]);
    const ids: number[] = [];
    for (const no of nos) {
      ids.push(
        await insert(
          pool,
          'INSERT INTO booth (panchayat_samiti_id, booth_no, name_hindi, ps_ward_id, zp_ward_id, registered_voters_total) VALUES (?,?,?,?,?,?)',
          [psId, no, `बूथ ${no}`, w, zp, 800],
        ),
      );
    }
    return ids;
  };
  return { rtg: await booths(rtgPs, [1, 2, 45]), chu: await booths(chuPs, [1]), rtgPs, chuPs };
}

export async function createUser(
  pool: Pool,
  u: { username: string; role: Role; password: string; boothId?: number; active?: boolean },
): Promise<number> {
  const id = await insert(
    pool,
    'INSERT INTO users (username, password_hash, role, full_name, is_active) VALUES (?, ?, ?, ?, ?)',
    [u.username, await bcrypt.hash(u.password, 4), u.role, `Full ${u.username}`, u.active === false ? 0 : 1],
  );
  if (u.boothId !== undefined) await insert(pool, 'INSERT INTO user_booth (user_id, booth_id) VALUES (?, ?)', [id, u.boothId]);
  return id;
}

export async function csrfToken(agent: Agent): Promise<string> {
  const res = await agent.get('/api/auth/csrf');
  const token: unknown = (res.body as { csrfToken?: unknown }).csrfToken;
  if (typeof token !== 'string') throw new Error(`csrf failed: ${res.status}`);
  return token;
}

export async function login(agent: Agent, username: string, password: string): Promise<Response> {
  const token = await csrfToken(agent);
  return agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ username, password });
}

/** POST with a fresh CSRF token (the agent must be logged in). */
export async function post(agent: Agent, path: string, body: object = {}): Promise<Response> {
  const token = await csrfToken(agent); // before creating the request: supertest binds a server per request
  return agent.post(path).set('X-CSRF-Token', token).send(body);
}

/** Turns "समय सीमा लागू करें" on or off directly (the default after resetData is off). */
export async function setEnforceStepTimes(pool: Pool, enabled: boolean): Promise<void> {
  await pool.execute(
    "INSERT INTO app_settings (setting_key, setting_value) VALUES ('enforce_step_times', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [String(enabled)],
  );
}
