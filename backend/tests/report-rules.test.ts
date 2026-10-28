import { describe, expect, it } from 'vitest';
import { isLate, turnoutPercent, validateReport } from '../src/services/report-rules.js';
import type { RuleContext } from '../src/services/report-rules.js';

const ctx = (over: Partial<RuleContext> = {}): RuleContext => ({
  type: 'TURNOUT',
  registeredVoters: 1000,
  previous: null,
  next: null,
  ...over,
});
const t = (male: number, female: number, third = 0) => ({ turnout: { male, female, third } });
const nine = { id: 1, nameHi: 'मतदान 9 बजे तक', male: 50, female: 40, third: 1 };
const one = { id: 3, nameHi: 'मतदान 1 बजे तक', male: 300, female: 250, third: 2 };

describe('turnout rules', () => {
  it('accepts a first cumulative turnout within registered voters', () => {
    expect(validateReport(t(400, 380, 2), ctx())).toEqual([]);
  });

  it('accepts exactly the registered voters, refuses one more', () => {
    expect(validateReport(t(500, 500), ctx())).toEqual([]);
    expect(validateReport(t(500, 500, 1), ctx())).toEqual([
      { code: 'EXCEEDS_REGISTERED', registeredVoters: 1000, total: 1001 },
    ]);
  });

  it('refuses any category below the previous turnout step (cumulative)', () => {
    const errors = validateReport(t(60, 39, 1), ctx({ previous: nine }));
    expect(errors).toEqual([{ code: 'BELOW_PREVIOUS', step: { id: 1, nameHi: nine.nameHi }, field: 'female', previous: 40 }]);
  });

  it('equal to the previous step is allowed (nobody voted in between)', () => {
    expect(validateReport(t(50, 40, 1), ctx({ previous: nine }))).toEqual([]);
  });

  it('editing an earlier step cannot rise above a later reported step', () => {
    const errors = validateReport(t(301, 100, 1), ctx({ previous: nine, next: one }));
    expect(errors.map((e) => e.code)).toEqual(['ABOVE_NEXT']);
  });

  it('requires all three whole, non-negative numbers', () => {
    expect(validateReport({}, ctx())).toEqual([{ code: 'TURNOUT_REQUIRED' }]);
    expect(validateReport(t(-1, 0), ctx())).toEqual([{ code: 'TURNOUT_REQUIRED' }]);
    expect(validateReport(t(1.5, 0), ctx())).toEqual([{ code: 'TURNOUT_REQUIRED' }]);
  });

  it('DONE takes no values; NUMBER needs one count', () => {
    expect(validateReport({}, ctx({ type: 'DONE' }))).toEqual([]);
    expect(validateReport({ value: 3 }, ctx({ type: 'DONE' }))).toEqual([{ code: 'VALUES_NOT_ALLOWED' }]);
    expect(validateReport({ value: 3 }, ctx({ type: 'NUMBER' }))).toEqual([]);
    expect(validateReport({}, ctx({ type: 'NUMBER' }))).toEqual([{ code: 'VALUE_REQUIRED' }]);
  });

  it('late flag and percent', () => {
    const due = new Date('2026-11-12T09:30:00+05:30');
    expect(isLate(new Date('2026-11-12T09:30:00+05:30'), due)).toBe(false);
    expect(isLate(new Date('2026-11-12T09:31:00+05:30'), due)).toBe(true);
    expect(isLate(new Date(), null)).toBe(false);
    expect(turnoutPercent(333, 1000)).toBe(33.3);
    expect(turnoutPercent(5, 0)).toBeNull();
  });
});
