import * as XLSX from "xlsx";

export type ParsedStudentRow = {
  controlNumber: string;
  fullName: string;
  listNumber?: number;
};

export type SheetImportResult = {
  groupCode: string;
  sheetName: string;
  students: ParsedStudentRow[];
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
    (value.includes("numero") && value.includes("control")) ||
    value === "no control"
  );
}

function isNameHeader(value: string) {
  return value.includes("nombre") || value.includes("alumno");
}

function isRowIndexHeader(value: string) {
  return value === "no" || value === "no." || value === "n°" || value === "#";
}

/** No usar 1, 2, 3… de la columna "No." como número de control. */
export function isLikelyRowIndexControl(controlNumber: string): boolean {
  if (!controlNumber) return true;
  if (controlNumber.length > 6) return false;
  return /^[0-9]{1,4}$/.test(controlNumber);
}

function isListHeader(value: string) {
  return value.includes("lista") && !value.includes("control");
}

export type ColumnMap = { control: number; name: number; list?: number };

function detectColumns(headerRow: unknown[]): ColumnMap | null {
  const headers = headerRow.map(normalizeHeader);
  let control = -1;
  let name = -1;
  let list = -1;

  headers.forEach((h, i) => {
    if (isRowIndexHeader(h)) return;
    if (isControlHeader(h)) control = i;
    else if (isNameHeader(h)) name = i;
    else if (isListHeader(h)) list = i;
  });

  if (name >= 0) {
    return { control, name, list: list >= 0 ? list : undefined };
  }
  return null;
}

export function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function normalizeControlNumber(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  let raw = String(value).trim();
  if (!raw) return "";

  if (/e[+-]?\d+/i.test(raw)) {
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) raw = String(Math.trunc(asNum));
  }

  raw = raw.replace(/\s/g, "");
  if (raw.endsWith(".0")) raw = raw.slice(0, -2);
  return raw;
}

/** Detecta si el nombre de la hoja corresponde a un grupo (ej. "201", "Grupo 202"). */
export function matchSheetToGroupCode(sheetName: string, groupCodes: string[]): string | null {
  const norm = normalizeHeader(sheetName);

  for (const code of groupCodes) {
    if (norm === code) return code;
    if (norm === `grupo ${code}` || norm === `grupo${code}`) return code;
    if (norm.includes(`grupo ${code}`) || norm.includes(`grupo${code}`)) return code;
    if (norm.startsWith(`${code} `) || norm.endsWith(` ${code}`) || norm.includes(` ${code} `)) {
      return code;
    }
  }

  for (const code of groupCodes) {
    if (norm.includes(code)) return code;
  }

  return null;
}

function parseSheetRows(sheet: XLSX.WorkSheet): ParsedStudentRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const students: ParsedStudentRow[] = [];
  const seen = new Set<string>();

  let columns: ColumnMap | null = null;
  let startIndex = 0;

  if (rows[0] && Array.isArray(rows[0])) {
    columns = detectColumns(rows[0]);
    if (columns) startIndex = 1;
  }

  if (!columns) {
    columns = { control: -1, name: 0, list: undefined };
  }

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    let controlNumber =
      columns.control >= 0 ? normalizeControlNumber(row[columns.control]) : "";
    const fullName = String(row[columns.name] ?? "").trim();
    let listNumber: number | undefined;

    if (columns.list !== undefined) {
      const parsed = Number.parseInt(String(row[columns.list]).trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) listNumber = parsed;
    }

    if (fullName.length < 2) continue;

    if (isLikelyRowIndexControl(controlNumber)) {
      controlNumber = "";
    }

    const dedupeKey = controlNumber || normalizePersonName(fullName);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    students.push({ controlNumber, fullName, listNumber });
  }

  students.sort((a, b) =>
    (a.controlNumber || a.fullName).localeCompare(b.controlNumber || b.fullName, undefined, {
      numeric: true,
    }),
  );
  return students;
}

/** Un solo grupo: primera hoja del archivo. */
export function parseStudentsExcel(buffer: Buffer): ParsedStudentRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return parseSheetRows(sheet);
}

/** Varias hojas: cada hoja con nombre 201, 202, Grupo 201, etc. */
export function parseStudentsWorkbook(
  buffer: Buffer,
  groupCodes: string[],
): { sheets: SheetImportResult[]; skippedSheets: string[] } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: SheetImportResult[] = [];
  const skippedSheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const groupCode = matchSheetToGroupCode(sheetName, groupCodes);
    if (!groupCode) {
      skippedSheets.push(sheetName);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const students = parseSheetRows(sheet);
    if (!students.length) {
      skippedSheets.push(sheetName);
      continue;
    }

    sheets.push({ groupCode, sheetName, students });
  }

  return { sheets, skippedSheets };
}
