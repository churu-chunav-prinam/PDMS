import type { RowDataPacket } from 'mysql2/promise';
import { ISSUE_TYPES } from '../../config/constants.js';
import type { Db } from '../../services/db.js';
import type { SheetSpec } from '../../services/xlsx.js';
import { STEP_ORDER_SQL, stepOrderSql } from '../../services/steps.js';
import { boothCard, boothHistory, boothSteps } from '../officer/booth.read.js';
import { listIssues } from '../officer/issues.service.js';

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

/** Everything about one booth for the district booth page. */
export async function boothDetail(db: Db, boothId: number) {
  const booth = await boothCard(db, boothId);
  const [officers] = await db.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.full_name, u.mobile, u.is_active, u.last_login_at
       FROM user_booth ub JOIN users u ON u.id = ub.user_id AND u.role = 'POLLING_OFFICER' WHERE ub.booth_id = ?`,
    [boothId],
  );
  const [edits] = await db.execute<RowDataPacket[]>(
    `SELECT h.created_at, s.name_hi, h.old_value, h.new_value, h.reason, u.username
       FROM step_report_history h JOIN step_report r ON r.id = h.report_id JOIN step s ON s.id = r.step_id
       JOIN users u ON u.id = h.changed_by WHERE r.booth_id = ? ORDER BY h.id DESC`,
    [boothId],
  );
  const o = officers[0];
  return {
    booth,
    officer: o
      ? {
          username: String(o.username), fullName: (o.full_name as string | null) ?? null, mobile: (o.mobile as string | null) ?? null,
          active: Number(o.is_active) === 1, lastLoginAt: iso(o.last_login_at),
        }
      : null,
    steps: (await boothSteps(db, boothId, booth.registeredVoters)).steps,
    issues: await listIssues(db, boothId),
    edits: edits.map((e) => ({
      at: iso(e.created_at) ?? '', stepNameHi: String(e.name_hi), oldValue: e.old_value as unknown,
      newValue: e.new_value as unknown, reason: String(e.reason), byUsername: String(e.username),
    })),
    history: await boothHistory(db, boothId),
  };
}

const IST = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
const ist = (d: unknown) => (d instanceof Date ? IST.format(d) : null);

export async function reportsSheet(db: Db): Promise<SheetSpec> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ps.code, b.booth_no, b.name_hindi, s.name_hi, r.reported_at, r.is_late, r.value_number,
            r.turnout_male, r.turnout_female, r.turnout_third, r.turnout_total, u.username, r.version
       FROM step_report r JOIN booth b ON b.id = r.booth_id JOIN panchayat_samiti ps ON ps.id = b.panchayat_samiti_id
       JOIN step s ON s.id = r.step_id JOIN users u ON u.id = r.reported_by
      ORDER BY ps.code, b.booth_no, ${stepOrderSql('s.')}`,
  );
  return {
    name: 'Reports',
    columns: ['PS', 'बूथ', 'बूथ नाम', 'चरण', 'समय', 'देर से', 'संख्या', 'पुरुष', 'महिला', 'तृतीय', 'कुल', 'द्वारा', 'संशोधित'].map((header) => ({ header })),
    rows: rows.map((r) => [
      String(r.code), Number(r.booth_no), String(r.name_hindi), String(r.name_hi), ist(r.reported_at),
      Number(r.is_late) === 1 ? 'हाँ' : '', r.value_number as number | null, r.turnout_male as number | null,
      r.turnout_female as number | null, r.turnout_third as number | null, r.turnout_total as number | null,
      String(r.username), Number(r.version) > 1 ? 'हाँ' : '',
    ]),
  };
}

export async function turnoutSheet(db: Db): Promise<SheetSpec> {
  const [steps] = await db.query<RowDataPacket[]>(`SELECT id, name_hi FROM step WHERE step_type = 'TURNOUT' AND is_active = 1 ORDER BY ${STEP_ORDER_SQL}`);
  const [booths] = await db.query<RowDataPacket[]>(
    `SELECT b.id, ps.code, b.booth_no, b.name_hindi, b.registered_voters_total
       FROM booth b JOIN panchayat_samiti ps ON ps.id = b.panchayat_samiti_id ORDER BY ps.code, b.booth_no`,
  );
  const [reports] = await db.query<RowDataPacket[]>(
    "SELECT r.booth_id, r.step_id, r.turnout_total FROM step_report r JOIN step s ON s.id = r.step_id WHERE s.step_type = 'TURNOUT'",
  );
  const totals = new Map(reports.map((r) => [`${String(r.booth_id)}|${String(r.step_id)}`, Number(r.turnout_total)]));
  return {
    name: 'Turnout',
    columns: [
      ...['PS', 'बूथ', 'बूथ नाम', 'मतदाता'].map((header) => ({ header })),
      ...steps.flatMap((s) => [{ header: String(s.name_hi) }, { header: '%', width: 8 }]),
    ],
    rows: booths.map((b) => {
      const voters = Number(b.registered_voters_total);
      return [
        String(b.code), Number(b.booth_no), String(b.name_hindi), voters,
        ...steps.flatMap((s) => {
          const t = totals.get(`${String(b.id)}|${String(s.id)}`);
          return t === undefined ? [null, null] : [t, voters > 0 ? Math.round((t / voters) * 1000) / 10 : null];
        }),
      ];
    }),
  };
}

const ISSUE_HI: Record<(typeof ISSUE_TYPES)[number], string> = {
  LAW_ORDER: 'कानून व्यवस्था', EVM_FAULT: 'EVM खराबी', POWER_WATER: 'बिजली/पानी', VOTER_LIST: 'मतदाता सूची', OTHER: 'अन्य',
};

export async function issuesSheet(db: Db): Promise<SheetSpec> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ps.code, b.booth_no, b.name_hindi, i.issue_type, i.note, i.started_at, i.resolved_at, i.duration_seconds, i.resolution
       FROM issue i JOIN booth b ON b.id = i.booth_id JOIN panchayat_samiti ps ON ps.id = b.panchayat_samiti_id
      ORDER BY i.started_at`,
  );
  return {
    name: 'Issues',
    columns: ['PS', 'बूथ', 'बूथ नाम', 'प्रकार', 'विवरण', 'शुरू', 'हल', 'अवधि (मिनट)', 'समाधान'].map((header) => ({ header })),
    rows: rows.map((r) => [
      String(r.code), Number(r.booth_no), String(r.name_hindi), ISSUE_HI[r.issue_type as keyof typeof ISSUE_HI],
      (r.note as string | null) ?? null, ist(r.started_at), ist(r.resolved_at),
      r.duration_seconds === null ? null : Math.round(Number(r.duration_seconds) / 60), (r.resolution as string | null) ?? null,
    ]),
  };
}

export async function auditPage(db: Db, beforeId: number | null, limit: number) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT a.id, a.created_at, a.action, a.entity, a.entity_id, a.old_value, a.new_value, a.reason, a.ip, u.username
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE (? IS NULL OR a.id < ?) ORDER BY a.id DESC LIMIT ${String(limit)}`,
    [beforeId, beforeId],
  );
  return rows.map((r) => ({
    id: Number(r.id), at: iso(r.created_at) ?? '', action: String(r.action), entity: String(r.entity),
    entityId: r.entity_id === null ? null : Number(r.entity_id), username: (r.username as string | null) ?? null,
    oldValue: r.old_value as unknown, newValue: r.new_value as unknown, reason: (r.reason as string | null) ?? null,
  }));
}
