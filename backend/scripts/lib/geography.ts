// Pure part of the geography import: rows -> booths, with approved fixes. Tested without a DB.
import type { SheetRow } from '../../src/services/xlsx.js';

/** Sheet "Sheet1_withvoters" of polling-stations.xlsx: one row per Gram Panchayat ward. */
export const GEO_SHEET = 'Sheet1_withvoters';
export const GEO_COLUMNS = {
  district: 'District',
  ps: 'PanchayatSamiti',
  boothNo: 'PollingStationNumber',
  nameHindi: 'Polling Station in Hindi',
  nameEnglish: 'Polling Station in English',
  psWard: 'PanchayatSamitiConstituenyNumber',
  zpWard: 'ZillaParishadConstituencyNumber',
  electors: 'Total_Elector',
} as const;

/** Official Churu numbers: the import refuses anything else. */
export const EXPECTED = { panchayatSamitis: 13, psWards: 231, zpWards: 39, booths: 1359, voters: 1_248_368 };

export type FixField = 'ps_ward_no' | 'zp_ward_no' | 'name_hindi' | 'name_english';
export interface Fix {
  panchayat_samiti: string;
  booth_no: number;
  field: FixField;
  value: number | string;
  reason: string;
  approved_by: string;
  approved_on: string;
}

export interface GeoBooth {
  psName: string;
  boothNo: number;
  nameHindi: string;
  nameEnglish: string;
  psWardNo: number;
  zpWardNo: number;
  voters: number;
}

export interface GeoResult {
  booths: GeoBooth[];
  errors: string[];
  counts: { panchayatSamitis: number; psWards: number; zpWards: number; booths: number; voters: number };
}

const key = (ps: string, no: number) => `${ps}|${no}`;

export function buildBooths(rows: readonly SheetRow[], fixes: readonly Fix[]): GeoResult {
  const errors: string[] = [];
  const C = GEO_COLUMNS;
  const grouped = new Map<string, { ps: string; no: number; values: Record<FixField, Set<string | number>>; voters: number; rows: number[] }>();
  for (const row of rows) {
    const get = (c: string) => row.cells[c] ?? null;
    const ps = get(C.ps);
    const no = get(C.boothNo);
    const electors = get(C.electors);
    if (String(get(C.district)).toUpperCase() !== 'CHURU') errors.push(`row ${row.rowNumber}: district is not CHURU`);
    if (typeof ps !== 'string' || typeof no !== 'number' || !Number.isInteger(no) || no < 1) {
      errors.push(`row ${row.rowNumber}: missing PS or booth number`);
      continue;
    }
    if (typeof electors !== 'number' || !Number.isInteger(electors) || electors < 0) {
      errors.push(`row ${row.rowNumber}: Total_Elector must be a whole number`);
      continue;
    }
    const g = grouped.get(key(ps, no)) ?? {
      ps,
      no,
      values: { ps_ward_no: new Set(), zp_ward_no: new Set(), name_hindi: new Set(), name_english: new Set() },
      voters: 0,
      rows: [],
    };
    for (const [field, col] of [
      ['ps_ward_no', C.psWard],
      ['zp_ward_no', C.zpWard],
      ['name_hindi', C.nameHindi],
      ['name_english', C.nameEnglish],
    ] as const) {
      const v = get(col);
      if (v !== null) g.values[field].add(v);
    }
    g.voters += electors;
    g.rows.push(row.rowNumber);
    grouped.set(key(ps, no), g);
  }

  for (const fix of fixes) {
    const g = grouped.get(key(fix.panchayat_samiti, fix.booth_no));
    if (!g) {
      errors.push(`fix: booth ${fix.booth_no} of ${fix.panchayat_samiti} is not in the file`);
      continue;
    }
    g.values[fix.field] = new Set([fix.value]);
  }

  const booths: GeoBooth[] = [];
  for (const g of grouped.values()) {
    const one = (field: FixField): string | number | null => {
      const set = g.values[field];
      if (set.size === 1) return [...set][0] ?? null;
      errors.push(
        `booth ${g.no} of ${g.ps}: ${set.size === 0 ? 'no' : 'conflicting'} ${field} (${[...set].join(' / ')}; rows ${g.rows.join(', ')}) - add an approved fix`,
      );
      return null;
    };
    const psWard = one('ps_ward_no');
    const zpWard = one('zp_ward_no');
    const nameHindi = one('name_hindi');
    const nameEnglish = one('name_english');
    if (typeof psWard !== 'number' || typeof zpWard !== 'number' || typeof nameHindi !== 'string') continue;
    booths.push({
      psName: g.ps,
      boothNo: g.no,
      nameHindi,
      nameEnglish: typeof nameEnglish === 'string' ? nameEnglish : '',
      psWardNo: psWard,
      zpWardNo: zpWard,
      voters: g.voters,
    });
  }
  const counts = {
    panchayatSamitis: new Set(booths.map((b) => b.psName)).size,
    psWards: new Set(booths.map((b) => `${b.psName}|${b.psWardNo}`)).size,
    zpWards: new Set(booths.map((b) => b.zpWardNo)).size,
    booths: booths.length,
    voters: booths.reduce((s, b) => s + b.voters, 0),
  };
  for (const [k, expected] of Object.entries(EXPECTED) as [keyof typeof EXPECTED, number][]) {
    if (counts[k] !== expected) errors.push(`${k}: found ${counts[k]}, expected ${expected}`);
  }
  return { booths, errors, counts };
}
