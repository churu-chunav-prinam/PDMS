// The district picture: everything the dashboard shows, computed from ONE consistent load.
// load* functions read the DB; the rest is pure computation over the loaded data.
import type { RowDataPacket } from 'mysql2/promise';
import { PHASES } from '../../config/constants.js';
import type { IssueType, Phase } from '../../config/constants.js';
import type { Db } from '../../services/db.js';
import { turnoutPercent } from '../../services/report-rules.js';
import { getEnforceStepTimes } from '../../services/settings.js';
import { stepStatus } from '../../services/step-status.js';
import { dbNow, loadSteps } from '../../services/steps.js';
import type { Step } from '../../services/steps.js';

interface BoothRow {
  id: number;
  boothNo: number;
  nameHi: string;
  psId: number;
  psCode: string;
  psNameHi: string;
  voters: number;
  officer: { userId: number; username: string; fullName: string | null; mobile: string | null; active: boolean } | null;
}
interface ReportCell {
  total: number | null;
  late: boolean;
}
export interface OpenIssue {
  id: number;
  boothId: number;
  type: IssueType;
  startedAt: string;
}

export interface Snapshot {
  now: Date;
  /** false (default): no locks, deadlines, late flags or "behind" anywhere. */
  enforceTimes: boolean;
  booths: BoothRow[];
  steps: Step[];
  reports: Map<number, Map<number, ReportCell>>;
  openIssues: Map<number, OpenIssue>;
}

export async function loadSnapshot(db: Db): Promise<Snapshot> {
  const now = await dbNow(db);
  const enforceTimes = await getEnforceStepTimes(db);
  const steps = await loadSteps(db, { activeOnly: true });
  const [boothRows] = await db.query<RowDataPacket[]>(
    `SELECT b.id, b.booth_no, b.name_hindi, ps.id AS ps_id, ps.code, ps.name_hindi AS ps_name, b.registered_voters_total,
            u.id AS user_id, u.username, u.full_name, u.mobile, u.is_active
       FROM booth b JOIN panchayat_samiti ps ON ps.id = b.panchayat_samiti_id
       LEFT JOIN user_booth ub ON ub.booth_id = b.id
         AND ub.user_id IN (SELECT id FROM users WHERE role = 'POLLING_OFFICER')
       LEFT JOIN users u ON u.id = ub.user_id
      ORDER BY ps.name_hindi, b.booth_no`,
  );
  const [reportRows] = await db.query<RowDataPacket[]>('SELECT booth_id, step_id, turnout_total, is_late FROM step_report');
  const [issueRows] = await db.query<RowDataPacket[]>(
    'SELECT id, booth_id, issue_type, started_at FROM issue WHERE resolved_at IS NULL',
  );
  const reports = new Map<number, Map<number, ReportCell>>();
  for (const r of reportRows) {
    const boothId = Number(r.booth_id);
    const cells = reports.get(boothId) ?? new Map<number, ReportCell>();
    cells.set(Number(r.step_id), { total: r.turnout_total === null ? null : Number(r.turnout_total), late: enforceTimes && Number(r.is_late) === 1 });
    reports.set(boothId, cells);
  }
  return {
    now,
    enforceTimes,
    steps,
    reports,
    booths: boothRows.map((r) => ({
      id: Number(r.id),
      boothNo: Number(r.booth_no),
      nameHi: String(r.name_hindi),
      psId: Number(r.ps_id),
      psCode: String(r.code),
      psNameHi: String(r.ps_name),
      voters: Number(r.registered_voters_total),
      officer:
        r.user_id === null
          ? null
          : {
              userId: Number(r.user_id),
              username: String(r.username),
              fullName: (r.full_name as string | null) ?? null,
              mobile: (r.mobile as string | null) ?? null,
              active: Number(r.is_active) === 1,
            },
    })),
    openIssues: new Map(
      issueRows.map((r) => [
        Number(r.booth_id),
        { id: Number(r.id), boothId: Number(r.booth_id), type: r.issue_type as IssueType, startedAt: (r.started_at as Date).toISOString() },
      ]),
    ),
  };
}

export interface BoothSummary extends Omit<BoothRow, 'officer'> {
  officer: { fullName: string | null; mobile: string | null; username: string; active: boolean } | null;
  phases: Record<Phase, { done: number; total: number }>;
  overdue: number;
  pending: number;
  nothingReported: boolean;
  latestTurnout: { stepNameHi: string; total: number; percent: number | null } | null;
  openIssue: OpenIssue | null;
}

export function boothSummary(snap: Snapshot, b: BoothRow): BoothSummary {
  const cells = snap.reports.get(b.id);
  const phases = Object.fromEntries(PHASES.map((p) => [p, { done: 0, total: 0 }])) as BoothSummary['phases'];
  let overdue = 0;
  let pending = 0;
  let latestTurnout: BoothSummary['latestTurnout'] = null;
  for (const s of snap.steps) {
    const cell = cells?.get(s.id);
    const status = stepStatus(s, cell !== undefined, snap.now, snap.enforceTimes);
    phases[s.phase].total++;
    if (status === 'done') phases[s.phase].done++;
    if (status === 'overdue') overdue++;
    if (status === 'overdue' || status === 'pending') pending++;
    // Steps are in poll order, so the last reported turnout step is the latest.
    if (s.type === 'TURNOUT' && cell?.total != null) {
      latestTurnout = { stepNameHi: s.nameHi, total: cell.total, percent: turnoutPercent(cell.total, b.voters) };
    }
  }
  const { officer, ...rest } = b;
  return {
    ...rest,
    officer: officer && { fullName: officer.fullName, mobile: officer.mobile, username: officer.username, active: officer.active },
    phases,
    overdue,
    pending,
    nothingReported: (cells?.size ?? 0) === 0,
    latestTurnout,
    openIssue: snap.openIssues.get(b.id) ?? null,
  };
}

export type BoothFilter = 'all' | 'pending' | 'issue' | 'behind' | 'nothing';

export function filterBooths(
  snap: Snapshot,
  opts: { psId: number | null; filter: BoothFilter; q: string },
): BoothSummary[] {
  const q = opts.q.trim().toLowerCase();
  return snap.booths
    .filter((b) => opts.psId === null || b.psId === opts.psId)
    .map((b) => boothSummary(snap, b))
    .filter((s) => {
      if (opts.filter === 'pending' && s.pending === 0) return false;
      if (opts.filter === 'issue' && !s.openIssue) return false;
      if (opts.filter === 'behind' && s.overdue === 0) return false;
      if (opts.filter === 'nothing' && !s.nothingReported) return false;
      if (q === '') return true;
      return [String(s.boothNo), s.nameHi, s.psCode, s.officer?.fullName ?? '', s.officer?.mobile ?? '', s.officer?.username ?? '']
        .some((t) => t.toLowerCase().includes(q));
    });
}

interface TurnoutCell {
  stepId: number;
  reported: number;
  turnout: number;
  voters: number;
  percent: number | null;
}

/** Turnout of one slot over the booths that reported it (with how many of how many reported). */
function turnoutCell(snap: Snapshot, booths: readonly BoothRow[], step: Step): TurnoutCell {
  let reported = 0;
  let turnout = 0;
  let voters = 0;
  for (const b of booths) {
    const total = snap.reports.get(b.id)?.get(step.id)?.total;
    if (total == null) continue;
    reported++;
    turnout += total;
    voters += b.voters;
  }
  return { stepId: step.id, reported, turnout, voters, percent: turnoutPercent(turnout, voters) };
}

export function dashboard(snap: Snapshot) {
  const summaries = snap.booths.map((b) => boothSummary(snap, b));
  const pollStart = snap.steps.find((s) => s.marker === 'POLL_START');
  const turnoutSteps = snap.steps.filter((s) => s.type === 'TURNOUT');
  const latest = summaries.filter((s) => s.latestTurnout !== null);
  const latestTotal = latest.reduce((n, s) => n + (s.latestTurnout?.total ?? 0), 0);
  const latestVoters = latest.reduce((n, s) => n + s.voters, 0);
  const byId = new Map(snap.booths.map((b) => [b.id, b]));
  const psGroups = new Map<number, BoothRow[]>();
  for (const b of snap.booths) psGroups.set(b.psId, [...(psGroups.get(b.psId) ?? []), b]);

  return {
    serverTime: snap.now.toISOString(),
    enforceStepTimes: snap.enforceTimes,
    cards: {
      totalBooths: snap.booths.length,
      pollStarted: pollStart ? snap.booths.filter((b) => snap.reports.get(b.id)?.has(pollStart.id)).length : null,
      turnout: { percent: turnoutPercent(latestTotal, latestVoters), booths: latest.length, total: latestTotal },
      boothsBehind: summaries.filter((s) => s.overdue > 0).length,
    },
    openIssues: [...snap.openIssues.values()]
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((i) => {
        const b = byId.get(i.boothId);
        return { ...i, boothNo: b?.boothNo ?? 0, boothNameHi: b?.nameHi ?? '', psCode: b?.psCode ?? '', officerMobile: b?.officer?.mobile ?? null };
      }),
    perStep: snap.steps.map((s) => {
      let reported = 0;
      let late = 0;
      for (const b of snap.booths) {
        const cell = snap.reports.get(b.id)?.get(s.id);
        if (cell) reported++;
        if (cell?.late) late++;
      }
      return {
        id: s.id, phase: s.phase, nameHi: s.nameHi, reported, late, total: snap.booths.length,
        open: !snap.enforceTimes || s.opensAt === null || s.opensAt <= snap.now,
        overdue: snap.enforceTimes && s.dueBy !== null && s.dueBy < snap.now,
      };
    }),
    turnoutSlots: turnoutSteps.map((s) => ({ id: s.id, nameHi: s.nameHi })),
    turnoutByPs: [...psGroups.values()].map((booths) => ({
      psId: booths[0]?.psId ?? 0,
      psCode: booths[0]?.psCode ?? '',
      psNameHi: booths[0]?.psNameHi ?? '',
      booths: booths.length,
      slots: turnoutSteps.map((s) => turnoutCell(snap, booths, s)),
    })),
    turnoutDistrict: turnoutSteps.map((s) => turnoutCell(snap, snap.booths, s)),
  };
}

/** Booths that have not reported one step (with officer contact), for the "tap to see pending" list. */
export function pendingForStep(snap: Snapshot, stepId: number) {
  return snap.booths
    .filter((b) => !snap.reports.get(b.id)?.has(stepId))
    .map((b) => ({
      boothId: b.id, boothNo: b.boothNo, nameHi: b.nameHi, psCode: b.psCode,
      officerName: b.officer?.fullName ?? null, officerMobile: b.officer?.mobile ?? null,
    }));
}
