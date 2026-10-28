export type Role = 'DISTRICT_ADMIN' | 'SECTOR_OFFICER' | 'POLLING_OFFICER';

export interface User {
  id: number;
  username: string;
  fullName: string | null;
  role: Role;
}

export interface PsSummary {
  id: number;
  code: string;
  nameHi: string;
  nameEn: string;
  booths: number;
  activeOfficers: number;
}

export interface Officer {
  id: number;
  username: string;
  fullName: string | null;
  mobile: string | null;
  active: boolean;
  locked: boolean;
  lastLoginAt: string | null;
}

export interface BoothOfficer {
  boothId: number;
  boothNo: number;
  boothName: string;
  psWardNo: number;
  zpWardNo: number;
  voters: number;
  officer: Officer | null;
}

/** An account just created by the admin (no password: the admin typed it and nobody stores it). */
export interface CreatedOfficer {
  userId: number;
  boothId: number;
  username: string;
  fullName: string;
}

export interface BulkRow {
  rowNumber: number;
  booth: string | null;
  boothName: string | null;
  officerName: string | null;
  username: string | null;
  problems: string[];
}

export type Phase = 'PRE_POLL' | 'POLL_DAY' | 'POST_POLL';
export type StepType = 'DONE' | 'NUMBER' | 'TURNOUT';
export type IssueType = 'LAW_ORDER' | 'EVM_FAULT' | 'POWER_WATER' | 'VOTER_LIST' | 'OTHER';
export type StepStatus = 'done' | 'pending' | 'locked' | 'overdue';

export interface Turnout {
  male: number;
  female: number;
  third: number;
}

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

export interface Issue {
  id: number;
  type: IssueType;
  note: string | null;
  startedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  durationSeconds: number | null;
}

export interface OfficerHomeData {
  serverTime: string;
  enforceStepTimes: boolean;
  booth: BoothCard;
  progress: { done: number; total: number };
  phases: { phase: Phase; done: number; total: number; overdue: number }[];
  openIssue: Issue | null;
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
  previousTurnout: (Turnout & { total: number; stepNameHi: string }) | null;
}

export interface StepsData {
  serverTime: string;
  enforceStepTimes: boolean;
  registeredVoters: number;
  steps: BoothStep[];
}

export interface HistoryEvent {
  at: string;
  kind: 'REPORT' | 'EDIT' | 'ISSUE_OPEN' | 'ISSUE_RESOLVE';
  titleHi: string;
  detail: string | null;
  byUsername: string;
}

export interface OpenIssueRow {
  id: number;
  boothId: number;
  type: IssueType;
  startedAt: string;
  boothNo: number;
  boothNameHi: string;
  psCode: string;
  officerMobile: string | null;
}

export interface TurnoutCell {
  stepId: number;
  reported: number;
  turnout: number;
  voters: number;
  percent: number | null;
}

export interface Dashboard {
  serverTime: string;
  /** false (default): no locks, deadlines, late flags or "behind" anywhere. */
  enforceStepTimes: boolean;
  cards: {
    totalBooths: number;
    pollStarted: number | null;
    turnout: { percent: number | null; booths: number; total: number };
    boothsBehind: number;
  };
  openIssues: OpenIssueRow[];
  perStep: { id: number; phase: Phase; nameHi: string; reported: number; late: number; total: number; open: boolean; overdue: boolean }[];
  turnoutSlots: { id: number; nameHi: string }[];
  turnoutByPs: { psId: number; psCode: string; psNameHi: string; booths: number; slots: TurnoutCell[] }[];
  turnoutDistrict: TurnoutCell[];
}

export interface BoothSummary {
  id: number;
  boothNo: number;
  nameHi: string;
  psId: number;
  psCode: string;
  psNameHi: string;
  voters: number;
  officer: { fullName: string | null; mobile: string | null; username: string; active: boolean } | null;
  phases: Record<Phase, { done: number; total: number }>;
  overdue: number;
  pending: number;
  nothingReported: boolean;
  latestTurnout: { stepNameHi: string; total: number; percent: number | null } | null;
  openIssue: { id: number; type: IssueType; startedAt: string } | null;
}

export interface BoothDetail {
  booth: BoothCard;
  officer: { username: string; fullName: string | null; mobile: string | null; active: boolean; lastLoginAt: string | null } | null;
  steps: BoothStep[];
  issues: Issue[];
  edits: { at: string; stepNameHi: string; oldValue: unknown; newValue: unknown; reason: string; byUsername: string }[];
  history: HistoryEvent[];
}

export interface StepMaster {
  id: number;
  phase: Phase;
  sortOrder: number;
  nameHi: string;
  nameEn: string;
  type: StepType;
  numberLabelHi: string | null;
  numberLabelEn: string | null;
  opensAt: string | null;
  dueBy: string | null;
  active: boolean;
  marker: string | null;
  reports: number;
}

export interface AuditEntry {
  id: number;
  at: string;
  action: string;
  entity: string;
  entityId: number | null;
  username: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
}

export interface PublicInfo {
  election: { hi: string; en: string };
  pollDate: string;
}
/** Booth picker (admin "add officer"). */
export interface PickerWard {
  id: number;
  wardNo: number;
}
export interface PickerBooth {
  id: number;
  boothNo: number;
  nameHi: string;
}
