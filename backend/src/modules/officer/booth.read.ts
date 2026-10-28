// Read views of one booth: card, steps with their state, history. Shared by the officer app and
// (Part 3) the district booth page. Callers check access first.
import type { RowDataPacket } from 'mysql2/promise';
import type { Phase, StepType } from '../../config/constants.js';
import { ApiError } from '../../middleware/errors.js';
import type { Db } from '../../services/db.js';
import { turnoutPercent, turnoutTotal } from '../../services/report-rules.js';
import type { Turnout } from '../../services/report-rules.js';
import { getEnforceStepTimes } from '../../services/settings.js';
import { stepStatus } from '../../services/step-status.js';
import type { StepStatus } from '../../services/step-status.js';
import { dbNow, loadSteps } from '../../services/steps.js';

export interface BoothCard {
  id: number;
  boothNo: number;
  nameHi: string;
  psCode: string;
  psNameHi: string;
  psWardNo: number;
  zpWardNo: number;
  registeredVoters: number;
}

export async function boothCard(db: Db, boothId: number): Promise<BoothCard> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT b.id, b.booth_no, b.name_hindi, ps.code, ps.name_hindi AS ps_name, pw.ward_no AS ps_ward, zw.ward_no AS zp_ward,
            b.registered_voters_total
       FROM booth b JOIN panchayat_samiti ps ON ps.id = b.panchayat_samiti_id
       JOIN ward pw ON pw.id = b.ps_ward_id JOIN ward zw ON zw.id = b.zp_ward_id
      WHERE b.id = ?`,
    [boothId],
  );
  const r = rows[0];
  if (!r) throw new ApiError(404, 'BOOTH_NOT_FOUND');
  return {
    id: Number(r.id),
    boothNo: Number(r.booth_no),
    nameHi: String(r.name_hindi),
    psCode: String(r.code),
    psNameHi: String(r.ps_name),
    psWardNo: Number(r.ps_ward),
    zpWardNo: Number(r.zp_ward),
    registeredVoters: Number(r.registered_voters_total),
  };
}


export interface BoothStep {
  id: number;
  phase: Phase;
  nameHi: string;
  nameEn: string;
  type: StepType;
  numberLabelHi: string | null;
  opensAt: string | null;
  dueBy: string | null;
  status: StepStatus;
  report: {
    reportedAt: string;
    late: boolean;
    value: number | null;
    turnout: (Turnout & { total: number; percent: number | null }) | null;
    edited: boolean;
  } | null;
  /** TURNOUT steps: the nearest earlier reported turnout (cumulative floor), shown on the form. */
  previousTurnout: (Turnout & { total: number; stepNameHi: string }) | null;
}

interface ReportRow extends RowDataPacket {
  step_id: number;
  value_number: number | null;
  turnout_male: number | null;
  turnout_female: number | null;
  turnout_third: number | null;
  reported_at: Date;
  is_late: number;
  version: number;
}

export async function boothSteps(db: Db, boothId: number, registeredVoters: number): Promise<{ now: Date; enforceTimes: boolean; steps: BoothStep[] }> {
  const now = await dbNow(db);
  // Times off: no times are sent at all, so no screen can show a lock, a deadline or "late".
  const enforceTimes = await getEnforceStepTimes(db);
  const steps = await loadSteps(db, { activeOnly: true });
  const [rows] = await db.execute<ReportRow[]>(
    `SELECT step_id, value_number, turnout_male, turnout_female, turnout_third, reported_at, is_late, version
       FROM step_report WHERE booth_id = ?`,
    [boothId],
  );
  const reports = new Map(rows.map((r) => [r.step_id, r]));
  let lastTurnout: BoothStep['previousTurnout'] = null;
  const out: BoothStep[] = [];
  for (const s of steps) {
    const r = reports.get(s.id);
    const turnout: Turnout | null =
      r && r.turnout_male !== null ? { male: r.turnout_male, female: r.turnout_female ?? 0, third: r.turnout_third ?? 0 } : null;
    const status = stepStatus(s, r !== undefined, now, enforceTimes);
    out.push({
      id: s.id,
      phase: s.phase,
      nameHi: s.nameHi,
      nameEn: s.nameEn,
      type: s.type,
      numberLabelHi: s.numberLabelHi,
      opensAt: enforceTimes ? (s.opensAt?.toISOString() ?? null) : null,
      dueBy: enforceTimes ? (s.dueBy?.toISOString() ?? null) : null,
      status,
      report: r
        ? {
            reportedAt: r.reported_at.toISOString(),
            late: enforceTimes && r.is_late === 1,
            value: r.value_number,
            turnout: turnout
              ? { ...turnout, total: turnoutTotal(turnout), percent: turnoutPercent(turnoutTotal(turnout), registeredVoters) }
              : null,
            edited: r.version > 1,
          }
        : null,
      previousTurnout: s.type === 'TURNOUT' ? lastTurnout : null,
    });
    if (s.type === 'TURNOUT' && turnout) lastTurnout = { ...turnout, total: turnoutTotal(turnout), stepNameHi: s.nameHi };
  }
  return { now, enforceTimes, steps: out };
}

export interface HistoryEvent {
  at: string;
  kind: 'REPORT' | 'EDIT' | 'ISSUE_OPEN' | 'ISSUE_RESOLVE';
  titleHi: string;
  detail: string | null;
  byUsername: string;
}

/** Everything that happened at this booth, newest first. */
export async function boothHistory(db: Db, boothId: number): Promise<HistoryEvent[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT r.reported_at AS at, 'REPORT' AS kind, s.name_hi AS title, NULL AS detail, u.username
       FROM step_report r JOIN step s ON s.id = r.step_id JOIN users u ON u.id = r.reported_by WHERE r.booth_id = ?
     UNION ALL
     SELECT h.created_at, 'EDIT', s.name_hi, h.reason, u.username
       FROM step_report_history h JOIN step_report r ON r.id = h.report_id JOIN step s ON s.id = r.step_id
       JOIN users u ON u.id = h.changed_by WHERE r.booth_id = ?
     UNION ALL
     SELECT i.started_at, 'ISSUE_OPEN', i.issue_type, i.note, u.username
       FROM issue i JOIN users u ON u.id = i.started_by WHERE i.booth_id = ?
     UNION ALL
     SELECT i.resolved_at, 'ISSUE_RESOLVE', i.issue_type, i.resolution, u.username
       FROM issue i JOIN users u ON u.id = i.resolved_by WHERE i.booth_id = ? AND i.resolved_at IS NOT NULL
     ORDER BY at DESC`,
    [boothId, boothId, boothId, boothId],
  );
  return rows.map((r) => ({
    at: (r.at as Date).toISOString(),
    kind: r.kind as HistoryEvent['kind'],
    titleHi: String(r.title),
    detail: (r.detail as string | null) ?? null,
    byUsername: String(r.username),
  }));
}
