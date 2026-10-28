// Pure validation of one step report. No DB, no clock: the caller passes everything in.
// The ONLY place that decides whether report values are acceptable.
import type { StepType } from '../config/constants.js';

export interface Turnout {
  male: number;
  female: number;
  third: number;
}

export interface ReportValues {
  value?: number | undefined;
  turnout?: Turnout | undefined;
}

export interface StepRef {
  id: number;
  nameHi: string;
}

export interface RuleContext {
  type: StepType;
  registeredVoters: number;
  /** Nearest EARLIER turnout step of this booth that has a report (cumulative floor). */
  previous: (StepRef & Turnout) | null;
  /** Nearest LATER turnout step that has a report (ceiling when an earlier step is edited). */
  next: (StepRef & Turnout) | null;
}

export type RuleError =
  | { code: 'VALUES_NOT_ALLOWED' }
  | { code: 'VALUE_REQUIRED' }
  | { code: 'TURNOUT_REQUIRED' }
  | { code: 'EXCEEDS_REGISTERED'; registeredVoters: number; total: number }
  | { code: 'BELOW_PREVIOUS'; step: StepRef; field: keyof Turnout; previous: number }
  | { code: 'ABOVE_NEXT'; step: StepRef; field: keyof Turnout; next: number };

const FIELDS: readonly (keyof Turnout)[] = ['male', 'female', 'third'];

export const turnoutTotal = (t: Turnout): number => t.male + t.female + t.third;

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

export function validateReport(values: ReportValues, ctx: RuleContext): RuleError[] {
  switch (ctx.type) {
    case 'DONE':
      return values.value !== undefined || values.turnout !== undefined ? [{ code: 'VALUES_NOT_ALLOWED' }] : [];
    case 'NUMBER':
      if (values.turnout !== undefined) return [{ code: 'VALUES_NOT_ALLOWED' }];
      if (!isCount(values.value)) return [{ code: 'VALUE_REQUIRED' }];
      return values.value > ctx.registeredVoters
        ? [{ code: 'EXCEEDS_REGISTERED', registeredVoters: ctx.registeredVoters, total: values.value }]
        : [];
    case 'TURNOUT': {
      const t = values.turnout;
      if (values.value !== undefined) return [{ code: 'VALUES_NOT_ALLOWED' }];
      if (!t || !FIELDS.every((f) => isCount(t[f]))) return [{ code: 'TURNOUT_REQUIRED' }];
      const errors: RuleError[] = [];
      const total = turnoutTotal(t);
      if (total > ctx.registeredVoters) {
        errors.push({ code: 'EXCEEDS_REGISTERED', registeredVoters: ctx.registeredVoters, total });
      }
      // Cumulative: no category may drop below the earlier slot or rise above a later reported slot.
      for (const f of FIELDS) {
        const { previous, next } = ctx;
        if (previous && t[f] < previous[f]) {
          errors.push({ code: 'BELOW_PREVIOUS', step: { id: previous.id, nameHi: previous.nameHi }, field: f, previous: previous[f] });
        }
        if (next && t[f] > next[f]) {
          errors.push({ code: 'ABOVE_NEXT', step: { id: next.id, nameHi: next.nameHi }, field: f, next: next[f] });
        }
      }
      return errors;
    }
  }
}

/** Late = reported after due_by (both server times). */
export function isLate(reportedAt: Date, dueBy: Date | null): boolean {
  return dueBy !== null && reportedAt.getTime() > dueBy.getTime();
}

/** Turnout % with one decimal, or null when there are no registered voters. */
export function turnoutPercent(total: number, registered: number): number | null {
  return registered > 0 ? Math.round((total / registered) * 1000) / 10 : null;
}
