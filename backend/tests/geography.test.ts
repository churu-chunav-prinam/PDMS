import { describe, expect, it } from 'vitest';
import { GEO_COLUMNS as C, buildBooths } from '../scripts/lib/geography.js';
import type { Fix } from '../scripts/lib/geography.js';
import type { SheetRow } from '../src/services/xlsx.js';

const row = (n: number, booth: number, zp: number, electors: number): SheetRow => ({
  rowNumber: n,
  cells: {
    [C.district]: 'CHURU',
    [C.ps]: 'RAJGARH PANCHAYAT SAMITI',
    [C.boothNo]: booth,
    [C.nameHindi]: 'बूथ',
    [C.nameEnglish]: 'Booth',
    [C.psWard]: 3,
    [C.zpWard]: zp,
    [C.electors]: electors,
  },
});

describe('geography import (pure part)', () => {
  it('sums electors per booth and flags a booth with two ZP wards', () => {
    const r = buildBooths([row(2, 69, 23, 100), row(3, 69, 30, 50)], []);
    expect(r.errors.some((e) => e.includes('booth 69') && e.includes('zp_ward_no'))).toBe(true);
    expect(r.booths).toHaveLength(0);
  });

  it('an approved fix resolves the conflict', () => {
    const fix: Fix = {
      panchayat_samiti: 'RAJGARH PANCHAYAT SAMITI', booth_no: 69, field: 'zp_ward_no', value: 30,
      reason: 'letter', approved_by: 'RO', approved_on: '2026-10-01',
    };
    const r = buildBooths([row(2, 69, 23, 100), row(3, 69, 30, 50)], [fix]);
    expect(r.booths).toEqual([expect.objectContaining({ boothNo: 69, zpWardNo: 30, voters: 150 })]);
    // Small fixture: only the official-count checks fail.
    expect(r.errors.every((e) => /found \d+, expected/.test(e))).toBe(true);
  });
});
