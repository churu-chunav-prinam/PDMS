import type { IssueType, Phase } from './api/types';

export const PHASE_LABELS: Record<Phase, { hi: string; en: string }> = {
  PRE_POLL: { hi: 'मतदान पूर्व', en: 'Pre-poll' },
  POLL_DAY: { hi: 'मतदान दिवस', en: 'Poll day' },
  POST_POLL: { hi: 'मतदान पश्चात', en: 'Post-poll' },
};
export const PHASE_ORDER: readonly Phase[] = ['PRE_POLL', 'POLL_DAY', 'POST_POLL'];

export const ISSUE_LABELS: Record<IssueType, { hi: string; en: string }> = {
  LAW_ORDER: { hi: 'कानून व्यवस्था', en: 'Law & order' },
  EVM_FAULT: { hi: 'EVM खराबी', en: 'EVM fault' },
  POWER_WATER: { hi: 'बिजली/पानी', en: 'Power / water' },
  VOTER_LIST: { hi: 'मतदाता सूची', en: 'Voter list' },
  OTHER: { hi: 'अन्य', en: 'Other' },
};
export const ISSUE_ORDER: readonly IssueType[] = ['LAW_ORDER', 'EVM_FAULT', 'POWER_WATER', 'VOTER_LIST', 'OTHER'];

export const TURNOUT_FIELDS = [
  ['male', 'पुरुष', 'Male'],
  ['female', 'महिला', 'Female'],
  ['third', 'तृतीय लिंग', 'Third gender'],
] as const;

const TIME = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const DAY_TIME = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export const timeOf = (iso: string) => TIME.format(new Date(iso));
export const dayTimeOf = (iso: string) => DAY_TIME.format(new Date(iso));

/** "12 मिनट" / "1 घंटा 5 मिनट". */
export function durationHi(seconds: number): string {
  const m = Math.max(0, Math.floor(seconds / 60));
  if (m < 60) return `${m} मिनट`;
  return `${Math.floor(m / 60)} घंटा ${m % 60} मिनट`;
}

export const formatNumber = (n: number) => n.toLocaleString('en-IN');

const LOCAL_INPUT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
/** ISO instant -> "YYYY-MM-DDTHH:MM" in IST, for <input type="datetime-local">. */
export const toLocalInput = (iso: string | null) => (iso === null ? '' : LOCAL_INPUT.format(new Date(iso)).replace(' ', 'T'));

/** Values stored in a report, as one short line ("पु 50 · म 40 · तृ 1" or "3"). */
export function valuesLine(v: unknown): string {
  if (typeof v !== 'object' || v === null) return '—';
  const r = v as { value?: number; turnout?: { male: number; female: number; third: number } };
  if (r.turnout) return `पु ${r.turnout.male} · म ${r.turnout.female} · तृ ${r.turnout.third} = ${r.turnout.male + r.turnout.female + r.turnout.third}`;
  if (r.value !== undefined) return String(r.value);
  return '✓';
}
