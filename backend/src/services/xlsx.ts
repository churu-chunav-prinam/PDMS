import ExcelJS from 'exceljs';
import type { CellValue } from 'exceljs';

export type Cell = string | number | null;
export interface SheetRow {
  rowNumber: number;
  cells: Readonly<Record<string, Cell>>;
}

function toCell(value: CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const text = value.normalize('NFC').replace(/\s+/g, ' ').trim();
    return text === '' ? null : text;
  }
  if (typeof value === 'object' && 'richText' in value) {
    return toCell(value.richText.map((p) => p.text).join(''));
  }
  if (typeof value === 'object' && 'result' in value) return toCell(value.result ?? null);
  return null;
}

export type ReadResult =
  | { ok: true; rows: SheetRow[] }
  | { ok: false; error: 'UNREADABLE' | 'MISSING_COLUMNS'; columns?: string[] };

/** First sheet (or the named one); columns matched by header text in row 1, case-insensitive. */
export async function readRows(
  source: Buffer | string,
  columns: readonly string[],
  sheetName?: string,
): Promise<ReadResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    if (typeof source === 'string') await workbook.xlsx.readFile(source);
    // exceljs's typings want its own Buffer type; a Node Buffer is what it reads.
    else await workbook.xlsx.load(source as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: 'UNREADABLE' };
  }
  const sheet = sheetName === undefined ? workbook.worksheets[0] : workbook.getWorksheet(sheetName);
  if (!sheet) return { ok: false, error: 'UNREADABLE' };
  const index = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const text = toCell(cell.value);
    if (typeof text === 'string') index.set(text.toLowerCase(), col);
  });
  const missing = columns.filter((c) => !index.has(c.toLowerCase()));
  if (missing.length > 0) return { ok: false, error: 'MISSING_COLUMNS', columns: missing };
  const rows: SheetRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: Record<string, Cell> = {};
    for (const c of columns) cells[c] = toCell(row.getCell(index.get(c.toLowerCase()) ?? 0).value);
    if (Object.values(cells).some((v) => v !== null)) rows.push({ rowNumber, cells });
  });
  return { ok: true, rows };
}

export interface SheetSpec {
  name: string;
  columns: readonly { header: string; width?: number }[];
  rows: readonly (readonly Cell[])[];
}

/** Text starting with = + - @ would run as a formula in Excel: store it as plain text. */
function safeCell(value: Cell): Cell {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function writeWorkbook(sheets: readonly SheetSpec[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name);
    sheet.columns = spec.columns.map((c) => ({ header: c.header, width: c.width ?? 18 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of spec.rows) sheet.addRow(row.map(safeCell));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
