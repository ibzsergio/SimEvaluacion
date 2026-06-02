import * as XLSX from "xlsx";
import {
  matchSheetToGroupCode,
  normalizeControlNumber,
  normalizePersonName,
  type ColumnMap,
} from "./excel.js";

export type ParsedActivityColumn = {
  columnIndex: number;
  name: string;
  date: string;
  maxPoints: number;
};

export type ParsedGradeRow = {
  controlNumber?: string;
  studentName?: string;
  grades: { columnIndex: number; points: number }[];
};

export type ParsedGradesSheet = {
  groupCode?: string;
  sheetName: string;
  activities: ParsedActivityColumn[];
  rows: ParsedGradeRow[];
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isControlHeader(value: string) {
  return (
    value.includes("control") ||
    value.includes("matricula") ||
    value.includes("matrícula") ||
    (value.includes("numero") && value.includes("control"))
  );
}

function isNameHeader(value: string) {
  return value.includes("nombre") || value.includes("alumno");
}

function isRowIndexHeader(value: string) {
  return value === "no" || value === "no." || value === "n°" || value === "#";
}

/** Solo se omiten encabezados vacíos o la columna índice (No.). */
function shouldSkipActivityColumn(header: unknown): boolean {
  const h = normalizeHeader(header);
  if (!h) return true;
  if (isRowIndexHeader(h)) return true;
  return false;
}

type StudentColumnMap = ColumnMap & { control: number; name: number };

function detectStudentColumns(headerRow: unknown[]): StudentColumnMap | null {
  const headers = headerRow.map(normalizeHeader);
  let control = -1;
  let name = -1;

  headers.forEach((h, i) => {
    if (isRowIndexHeader(h)) return;
    if (isControlHeader(h)) control = i;
    else if (isNameHeader(h)) name = i;
  });

  if (name >= 0) return { control, name };
  if (control >= 0) return { control, name: control === 0 ? 1 : 0 };
  return null;
}

function parseIsoDateParts(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const utc = Math.round((serial - 25569) * 86400 * 1000);
  const dt = new Date(utc);
  return parseIsoDateParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function parseDateCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return parseIsoDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 30000 && value < 60000) return excelSerialToIso(value);
    if (value >= 19000101 && value <= 21001231) {
      const s = String(Math.trunc(value));
      return parseIsoDateParts(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return parseIsoDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    return parseIsoDateParts(y, Number(dmy[2]), Number(dmy[1]));
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const dt = new Date(parsed);
    return parseIsoDateParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }

  return null;
}

function parseMaxPoints(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  const fromLabel = raw.match(/(?:max|máx|valor|pts?)\s*[:.]?\s*(\d+)/i);
  const n = Number.parseInt(fromLabel?.[1] ?? String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 10000) return null;
  return n;
}

function parsePointsCell(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === "-" || raw === "—" || raw === "pendiente" || raw === "n/a") return null;
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseActivityNameFromHeader(value: unknown): string {
  let text = String(value ?? "").trim();
  if (!text) return "Actividad";

  text = text.replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, " ");
  text = text.replace(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g, " ");
  text = text.replace(/\(.*?pts?.*?\)/gi, " ");
  text = text.replace(/\(.*?max.*?\)/gi, " ");
  text = text.replace(/\bmax\s*[:.]?\s*\d+\b/gi, " ");
  text = text.trim();

  return text.length >= 2 ? text : "Actividad";
}

function rowLooksLikeDates(row: unknown[], columnIndices: number[]): boolean {
  let hits = 0;
  for (const i of columnIndices) {
    if (parseDateCell(row[i])) hits++;
  }
  return hits >= Math.max(1, Math.ceil(columnIndices.length * 0.5));
}

function rowLooksLikeMaxPoints(row: unknown[], columnIndices: number[]): boolean {
  let hits = 0;
  for (const i of columnIndices) {
    if (parseMaxPoints(row[i]) !== null) hits++;
  }
  return hits >= Math.max(1, Math.ceil(columnIndices.length * 0.5));
}

function inferMaxPointsFromColumn(rows: unknown[][], columnIndex: number, dataStart: number): number {
  let max = 0;
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const pts = parsePointsCell(row[columnIndex]);
    if (pts !== null && pts > max) max = pts;
  }
  if (max >= 100) return max;
  if (max > 0 && max <= 10) return 10;
  return 1500;
}

function parseGradesSheetInternal(sheet: XLSX.WorkSheet, sheetName: string): ParsedGradesSheet | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  if (!rows.length || !Array.isArray(rows[0])) return null;

  const studentCols = detectStudentColumns(rows[0]);
  if (!studentCols) return null;

  const headerRow = rows[0] as unknown[];
  const activityColIndices: number[] = [];

  for (let c = 0; c < headerRow.length; c++) {
    if (c === studentCols.name) continue;
    if (studentCols.control >= 0 && c === studentCols.control) continue;
    const header = String(headerRow[c] ?? "").trim();
    if (shouldSkipActivityColumn(header)) continue;
    activityColIndices.push(c);
  }

  if (!activityColIndices.length) return null;

  let metaDateRow: unknown[] | null = null;
  let metaMaxRow: unknown[] | null = null;
  let dataStart = 1;

  if (rows[1] && Array.isArray(rows[1])) {
    if (rowLooksLikeDates(rows[1], activityColIndices)) {
      metaDateRow = rows[1];
      dataStart = 2;
      if (rows[2] && Array.isArray(rows[2]) && rowLooksLikeMaxPoints(rows[2], activityColIndices)) {
        metaMaxRow = rows[2];
        dataStart = 3;
      }
    } else if (rowLooksLikeMaxPoints(rows[1], activityColIndices)) {
      metaMaxRow = rows[1];
      dataStart = 2;
    }
  }

  const defaultDate = new Date().toISOString().slice(0, 10);
  const activities: ParsedActivityColumn[] = activityColIndices.map((columnIndex) => {
    const headerCell = headerRow[columnIndex];
    const name = parseActivityNameFromHeader(headerCell);
    const date =
      parseDateCell(metaDateRow?.[columnIndex]) ??
      parseDateCell(headerCell) ??
      defaultDate;
    const maxPoints =
      parseMaxPoints(metaMaxRow?.[columnIndex]) ??
      parseMaxPoints(headerCell) ??
      inferMaxPointsFromColumn(rows, columnIndex, dataStart);

    return { columnIndex, name, date, maxPoints };
  });

  const gradeRows: ParsedGradeRow[] = [];
  const seenKeys = new Set<string>();

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    let controlNumber =
      studentCols.control >= 0 ? normalizeControlNumber(row[studentCols.control]) : "";
    const studentName = String(row[studentCols.name] ?? "").trim();

    if (!studentName || studentName.length < 3) continue;

    if (controlNumber && controlNumber.length <= 3) {
      controlNumber = "";
    }

    const rowKey = controlNumber || normalizePersonName(studentName);
    if (seenKeys.has(rowKey)) continue;
    seenKeys.add(rowKey);

    const grades: ParsedGradeRow["grades"] = [];
    for (const act of activities) {
      const points = parsePointsCell(row[act.columnIndex]);
      if (points === null) continue;
      grades.push({ columnIndex: act.columnIndex, points });
    }

    if (!grades.length) continue;

    gradeRows.push({
      controlNumber: controlNumber || undefined,
      studentName,
      grades,
    });
  }

  if (!activities.length) return null;
  return { sheetName, activities, rows: gradeRows };
}

export function parseGradesExcel(buffer: Buffer): ParsedGradesSheet | null {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return null;
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  return parseGradesSheetInternal(sheet, sheetName);
}

export function parseGradesWorkbook(
  buffer: Buffer,
  groupCodes: string[],
): { sheets: (ParsedGradesSheet & { groupCode: string })[]; skippedSheets: string[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: (ParsedGradesSheet & { groupCode: string })[] = [];
  const skippedSheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const groupCode = matchSheetToGroupCode(sheetName, groupCodes);
    if (!groupCode) {
      skippedSheets.push(sheetName);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      skippedSheets.push(sheetName);
      continue;
    }

    const parsed = parseGradesSheetInternal(sheet, sheetName);
    if (!parsed || !parsed.activities.length) {
      skippedSheets.push(sheetName);
      continue;
    }

    sheets.push({ ...parsed, groupCode });
  }

  return { sheets, skippedSheets };
}
