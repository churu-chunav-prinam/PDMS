import type { RowDataPacket } from 'mysql2/promise';
import { MOBILE_REGEX } from '../../config/constants.js';
import { USERNAME_REGEX, passwordProblem, usernameKey } from '../../services/credential-rules.js';
import type { PasswordProblem } from '../../services/credential-rules.js';
import type { Db } from '../../services/db.js';
import { readRows } from '../../services/xlsx.js';
import type { Cell } from '../../services/xlsx.js';
import { boothLabel } from './accounts.service.js';
import type { OfficerInput } from './accounts.service.js';
import { OFFICER_NAME_REGEX } from './officer-fields.js';

/** Bulk officer sheet: one row per booth, every column required. booth = "RTG-045" (PS code-booth no). */
export const BULK_COLUMNS = ['booth', 'name', 'mobile', 'username', 'password'] as const;

export type RowProblem =
  | 'BOOTH_INVALID'
  | 'PS_CODE_UNKNOWN'
  | 'BOOTH_NOT_FOUND'
  | 'DUPLICATE_IN_FILE'
  | 'BOOTH_HAS_OFFICER'
  | 'NAME_INVALID'
  | 'MOBILE_INVALID'
  | 'USERNAME_INVALID'
  | 'USERNAME_TAKEN'
  | 'DUPLICATE_USERNAME_IN_FILE'
  | 'PASSWORD_REQUIRED'
  | PasswordProblem;

/** What the dry run shows per row. Never contains the password. */
export interface BulkRowResult {
  rowNumber: number;
  booth: string | null;
  boothName: string | null;
  officerName: string | null;
  username: string | null;
  problems: RowProblem[];
}

export type BulkCheck =
  | { ok: false; fileError: 'UNREADABLE' | 'MISSING_COLUMNS' | 'EMPTY'; columns?: string[] }
  | { ok: true; rows: BulkRowResult[]; inputs: OfficerInput[]; problemRows: number };

interface BoothRow extends RowDataPacket {
  id: number;
  booth_no: number;
  name_hindi: string;
  ps_code: string;
  /** SQL boolean: the pool may return it as a BIGINT string, so always use Number(). */
  has_active_officer: string | number;
}

const text = (v: Cell): string | null => (v === null ? null : String(v).trim() || null);
const BOOTH_CELL = /^([A-Za-z]{2,5})\s*-?\s*0*(\d{1,4})$/;

/** Validates every row against the database with the same rules as a single add. Never writes. */
export async function checkBulkFile(db: Db, file: Buffer): Promise<BulkCheck> {
  const sheet = await readRows(file, BULK_COLUMNS);
  if (!sheet.ok) return { ok: false, fileError: sheet.error, ...(sheet.columns ? { columns: sheet.columns } : {}) };
  if (sheet.rows.length === 0) return { ok: false, fileError: 'EMPTY' };

  const [booths] = await db.query<BoothRow[]>(
    `SELECT b.id, b.booth_no, b.name_hindi, ps.code AS ps_code,
            EXISTS (SELECT 1 FROM user_booth ub JOIN users u ON u.id = ub.user_id
                     WHERE ub.booth_id = b.id AND u.role = 'POLLING_OFFICER' AND u.is_active = 1) AS has_active_officer
       FROM booth b JOIN panchayat_samiti ps ON ps.id = b.panchayat_samiti_id`,
  );
  // Existing usernames -> the booth whose (disabled) account owns it; re-using it for that booth is fine.
  const [users] = await db.query<RowDataPacket[]>(
    'SELECT u.username, ub.booth_id FROM users u LEFT JOIN user_booth ub ON ub.user_id = u.id',
  );
  const owners = new Map(users.map((u) => [usernameKey(String(u.username)), u.booth_id === null ? null : Number(u.booth_id)]));
  const byKey = new Map(booths.map((b) => [`${b.ps_code}|${b.booth_no}`, b]));
  const psCodes = new Set(booths.map((b) => b.ps_code));

  const seenBooths = new Set<number>();
  const seenUsernames = new Set<string>();
  const rows: BulkRowResult[] = [];
  const inputs: OfficerInput[] = [];
  for (const row of sheet.rows) {
    const problems: RowProblem[] = [];
    const boothText = text(row.cells.booth ?? null);
    const name = text(row.cells.name ?? null);
    const mobile = text(row.cells.mobile ?? null)?.replace(/\s/g, '') ?? null;
    const username = text(row.cells.username ?? null);
    // Passwords are taken exactly as typed (no trimming inside), but a number cell becomes text.
    const password = row.cells.password === null || row.cells.password === undefined ? null : String(row.cells.password);

    const m = boothText === null ? null : BOOTH_CELL.exec(boothText);
    const psCode = m?.[1]?.toUpperCase() ?? null;
    const boothNo = m?.[2] === undefined ? null : Number(m[2]);
    let booth: BoothRow | undefined;
    if (psCode === null || boothNo === null) problems.push('BOOTH_INVALID');
    else if (!psCodes.has(psCode)) problems.push('PS_CODE_UNKNOWN');
    else {
      booth = byKey.get(`${psCode}|${boothNo}`);
      if (!booth) problems.push('BOOTH_NOT_FOUND');
    }
    if (booth) {
      if (seenBooths.has(booth.id)) problems.push('DUPLICATE_IN_FILE');
      seenBooths.add(booth.id);
      if (Number(booth.has_active_officer) === 1) problems.push('BOOTH_HAS_OFFICER');
    }
    if (name === null || !OFFICER_NAME_REGEX.test(name)) problems.push('NAME_INVALID');
    if (mobile === null || !MOBILE_REGEX.test(mobile)) problems.push('MOBILE_INVALID');
    if (username === null || !USERNAME_REGEX.test(username)) problems.push('USERNAME_INVALID');
    else {
      const key = usernameKey(username);
      const owner = owners.get(key);
      if (owner !== undefined && (owner === null || owner !== booth?.id)) problems.push('USERNAME_TAKEN');
      if (seenUsernames.has(key)) problems.push('DUPLICATE_USERNAME_IN_FILE');
      seenUsernames.add(key);
    }
    if (password === null || password === '') problems.push('PASSWORD_REQUIRED');
    else {
      const weak = passwordProblem(password, username ?? '');
      if (weak) problems.push(weak);
    }

    rows.push({
      rowNumber: row.rowNumber,
      booth: booth ? boothLabel(booth.ps_code, booth.booth_no) : boothText,
      boothName: booth?.name_hindi ?? null,
      officerName: name,
      username,
      problems,
    });
    if (booth && name && mobile && username && password && problems.length === 0) {
      inputs.push({ boothId: booth.id, fullName: name, mobile, username, password });
    }
  }
  return { ok: true, rows, inputs, problemRows: rows.filter((r) => r.problems.length > 0).length };
}
