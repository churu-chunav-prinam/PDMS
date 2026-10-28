import type { RowDataPacket } from 'mysql2/promise';
import type { Db } from '../../services/db.js';
import type { SheetSpec } from '../../services/xlsx.js';

export interface PsSummary {
  id: number;
  code: string;
  nameHi: string;
  nameEn: string;
  booths: number;
  activeOfficers: number;
}

export async function listPanchayatSamitis(db: Db): Promise<PsSummary[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT ps.id, ps.code, ps.name_hindi, ps.name_english,
            (SELECT COUNT(*) FROM booth b WHERE b.panchayat_samiti_id = ps.id) AS booths,
            (SELECT COUNT(*) FROM booth b JOIN user_booth ub ON ub.booth_id = b.id
               JOIN users u ON u.id = ub.user_id AND u.role = 'POLLING_OFFICER' AND u.is_active = 1
              WHERE b.panchayat_samiti_id = ps.id) AS active_officers
       FROM panchayat_samiti ps ORDER BY ps.name_hindi`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    code: String(r.code),
    nameHi: String(r.name_hindi),
    nameEn: String(r.name_english),
    booths: Number(r.booths),
    activeOfficers: Number(r.active_officers),
  }));
}

export async function listPsWards(db: Db, psId: number): Promise<{ id: number; wardNo: number }[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, ward_no FROM ward WHERE ward_type = 'PS' AND panchayat_samiti_id = ? ORDER BY ward_no",
    [psId],
  );
  return rows.map((r) => ({ id: Number(r.id), wardNo: Number(r.ward_no) }));
}

export async function listWardBooths(db: Db, wardId: number): Promise<{ id: number; boothNo: number; nameHi: string }[]> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT id, booth_no, name_hindi FROM booth WHERE ps_ward_id = ? ORDER BY booth_no', [wardId]);
  return rows.map((r) => ({ id: Number(r.id), boothNo: Number(r.booth_no), nameHi: String(r.name_hindi) }));
}

export interface BoothOfficer {
  boothId: number;
  boothNo: number;
  boothName: string;
  psWardNo: number;
  zpWardNo: number;
  voters: number;
  officer: {
    id: number;
    username: string;
    fullName: string | null;
    mobile: string | null;
    active: boolean;
    locked: boolean;
    lastLoginAt: string | null;
  } | null;
}

const BOOTH_OFFICER_SQL = `
  SELECT b.id AS booth_id, b.booth_no, b.name_hindi, pw.ward_no AS ps_ward_no, zw.ward_no AS zp_ward_no,
         b.registered_voters_total, u.id AS user_id, u.username, u.full_name, u.mobile, u.is_active,
         (u.locked_until IS NOT NULL AND u.locked_until > NOW(3)) AS is_locked, u.last_login_at
    FROM booth b
    JOIN ward pw ON pw.id = b.ps_ward_id
    JOIN ward zw ON zw.id = b.zp_ward_id
    LEFT JOIN user_booth ub ON ub.booth_id = b.id
      AND ub.user_id IN (SELECT id FROM users WHERE role = 'POLLING_OFFICER')
    LEFT JOIN users u ON u.id = ub.user_id`;

function toBoothOfficer(r: RowDataPacket): BoothOfficer {
  return {
    boothId: Number(r.booth_id),
    boothNo: Number(r.booth_no),
    boothName: String(r.name_hindi),
    psWardNo: Number(r.ps_ward_no),
    zpWardNo: Number(r.zp_ward_no),
    voters: Number(r.registered_voters_total),
    officer:
      r.user_id === null
        ? null
        : {
            id: Number(r.user_id),
            username: String(r.username),
            fullName: (r.full_name as string | null) ?? null,
            mobile: (r.mobile as string | null) ?? null,
            active: Number(r.is_active) === 1,
            locked: Number(r.is_locked) === 1,
            lastLoginAt: r.last_login_at instanceof Date ? r.last_login_at.toISOString() : null,
          },
  };
}

export async function listBoothOfficers(db: Db, psId: number): Promise<BoothOfficer[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `${BOOTH_OFFICER_SQL} WHERE b.panchayat_samiti_id = ? ORDER BY b.booth_no`,
    [psId],
  );
  return rows.map(toBoothOfficer);
}

/** Login details for one PS: booth, officer, mobile, username. No passwords (nobody knows them). */
export async function credentialsSheet(db: Db, psId: number): Promise<SheetSpec> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT b.booth_no, b.name_hindi, u.username, u.full_name, u.mobile, u.is_active
       FROM booth b
       JOIN user_booth ub ON ub.booth_id = b.id
       JOIN users u ON u.id = ub.user_id AND u.role = 'POLLING_OFFICER'
      WHERE b.panchayat_samiti_id = ? ORDER BY b.booth_no`,
    [psId],
  );
  return {
    name: 'Officers',
    columns: [
      { header: 'बूथ सं. / Booth', width: 10 },
      { header: 'बूथ / Booth name', width: 50 },
      { header: 'अधिकारी / Officer', width: 26 },
      { header: 'मोबाइल / Mobile', width: 14 },
      { header: 'Username', width: 18 },
      { header: 'स्थिति / Status', width: 12 },
    ],
    rows: rows.map((r) => [
      Number(r.booth_no),
      String(r.name_hindi),
      (r.full_name as string | null) ?? null,
      (r.mobile as string | null) ?? null,
      String(r.username),
      Number(r.is_active) === 1 ? 'सक्रिय' : 'बंद',
    ]),
  };
}

/** Bulk upload template: every column is required. */
export const BULK_TEMPLATE: SheetSpec = {
  name: 'Officers',
  columns: [
    { header: 'booth', width: 12 },
    { header: 'name', width: 30 },
    { header: 'mobile', width: 14 },
    { header: 'username', width: 18 },
    { header: 'password', width: 18 },
  ],
  rows: [],
};
