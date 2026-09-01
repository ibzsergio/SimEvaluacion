import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import type { AttendanceStatus } from "@prisma/client";
import { findBestNameMatch, namesMatchLoose, normalizePersonName } from "./excel.js";
import { formatClassDayIso } from "./classDayService.js";

const MASTER_FILE_NAME = "LISTAS DE ASISTENCIA 26-27.xlsx";

/** Fila de fechas (gris). */
const DATE_ROW = 10;
/** Primera fila de alumnos. */
const STUDENT_START_ROW = 11;
/** Columna C = primera fecha. */
const DATE_COL_START = 3;
/** Columna AN = última fecha. */
const DATE_COL_END = 40;
/** Columna AO = total horas. */
const TOTAL_COL = 41;
/** Horas impartidas por día (columna AO, filas 4–8 = lun–vie). */
const WEEKDAY_HOURS_ROW_START = 4;

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export type AttendanceExcelSyncResult =
  | { ok: true; column: number; date: string; updated: number }
  | { ok: false; reason: string };

type StudentRef = { id: string; displayName: string };

function resolveMasterExcelPath(): string | null {
  const envPath = process.env.ATTENDANCE_MASTER_EXCEL?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    path.join(process.cwd(), "data", MASTER_FILE_NAME),
    path.join(process.cwd(), "..", MASTER_FILE_NAME),
    path.join(process.cwd(), MASTER_FILE_NAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function excelSerialToIso(serial: number): string | null {
  const utc = new Date(Date.UTC(1899, 11, 30 + serial, 12, 0, 0, 0));
  if (Number.isNaN(utc.getTime())) return null;
  return formatClassDayIso(utc);
}

function cellValueToIso(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return formatClassDayIso(value);
  if (typeof value === "number" && value > 30000 && value < 60000) {
    return excelSerialToIso(value);
  }
  if (typeof value === "object" && "result" in value && value.result instanceof Date) {
    return formatClassDayIso(value.result);
  }
  const text = String(value).trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) return formatClassDayIso(d);
  return null;
}

function parseDateForExcel(dateIso: string): Date {
  const parts = dateIso.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function weekdayHoursForDate(sheet: ExcelJS.Worksheet, dateIso: string): number {
  const d = parseDateForExcel(dateIso);
  const day = d.getDay();
  if (day === 0 || day === 6) return 0;
  const row = WEEKDAY_HOURS_ROW_START + (day - 1);
  const raw = sheet.getCell(row, TOTAL_COL).value;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function missedHours(
  attendance: AttendanceStatus,
  fullDayHours: number,
): number | null {
  if (attendance === "ABSENT") return fullDayHours > 0 ? fullDayHours : 4;
  if (attendance === "LATE") return 1;
  return null;
}

function findDateColumn(sheet: ExcelJS.Worksheet, dateIso: string): number | null {
  let firstEmpty: number | null = null;
  for (let col = DATE_COL_START; col <= DATE_COL_END; col++) {
    const iso = cellValueToIso(sheet.getRow(DATE_ROW).getCell(col).value);
    if (iso === dateIso) return col;
    if (!iso && firstEmpty === null) firstEmpty = col;
  }
  return firstEmpty;
}

function buildStudentRowMap(sheet: ExcelJS.Worksheet) {
  const rows: Array<{ row: number; name: string; listNo: number | null }> = [];
  for (let row = STUDENT_START_ROW; row <= sheet.rowCount; row++) {
    const nameCell = sheet.getRow(row).getCell(2);
    const name = String(nameCell.value ?? "").trim();
    if (!name) break;
    const listRaw = sheet.getRow(row).getCell(1).value;
    const listNo =
      typeof listRaw === "number"
        ? listRaw
        : Number.isFinite(Number(listRaw))
          ? Number(listRaw)
          : null;
    rows.push({ row, name, listNo });
  }
  return rows;
}

function matchStudentRow(
  excelRows: Array<{ row: number; name: string; listNo: number | null }>,
  student: StudentRef,
  listPosition: number,
) {
  const byName = findBestNameMatch(
    excelRows.map((r) => ({ displayName: r.name, row: r.row })),
    student.displayName,
  );
  if (byName) return byName.row;

  const byList = excelRows.find((r) => r.listNo === listPosition);
  if (byList && namesMatchLoose(byList.name, student.displayName)) return byList.row;

  const norm = normalizePersonName(student.displayName);
  const loose = excelRows.find((r) => normalizePersonName(r.name) === norm);
  return loose?.row ?? null;
}

function updateMonthLabel(sheet: ExcelJS.Worksheet, dateIso: string) {
  const d = parseDateForExcel(dateIso);
  const monthLabel = MONTH_NAMES_ES[d.getMonth()] ?? "";
  if (!monthLabel) return;
  const cell = sheet.getCell("H7");
  const current = String(cell.value ?? "").trim();
  if (current.toLowerCase() !== monthLabel.toLowerCase()) {
    cell.value = monthLabel;
  }
}

/**
 * Sincroniza un día de asistencia en la plantilla oficial (fechas en gris, horas en blanco).
 */
export async function syncAttendanceToMasterExcel(
  groupCode: string,
  dateIso: string,
  students: StudentRef[],
  records: Array<{ studentId: string; attendance: AttendanceStatus }>,
): Promise<AttendanceExcelSyncResult> {
  const filePath = resolveMasterExcelPath();
  if (!filePath) {
    return { ok: false, reason: "master_excel_not_found" };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheetName = groupCode.trim();
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    return { ok: false, reason: `sheet_not_found:${sheetName}` };
  }

  const dateCol = findDateColumn(sheet, dateIso);
  if (!dateCol) {
    return { ok: false, reason: "no_column_available" };
  }

  updateMonthLabel(sheet, dateIso);

  const dateCell = sheet.getRow(DATE_ROW).getCell(dateCol);
  dateCell.value = parseDateForExcel(dateIso);
  dateCell.numFmt = "dd/mm/yy";

  const excelRows = buildStudentRowMap(sheet);
  const fullDayHours = weekdayHoursForDate(sheet, dateIso);
  const studentsById = new Map(students.map((s, i) => [s.id, { ...s, listPosition: i + 1 }]));

  let updated = 0;
  for (const rec of records) {
    const student = studentsById.get(rec.studentId);
    if (!student) continue;

    const row = matchStudentRow(excelRows, student, student.listPosition);
    if (!row) continue;

    const hours = missedHours(rec.attendance, fullDayHours);
    const cell = sheet.getRow(row).getCell(dateCol);
    if (hours === null) {
      cell.value = null;
    } else {
      cell.value = hours;
      updated++;
    }
  }

  await workbook.xlsx.writeFile(filePath);
  return { ok: true, column: dateCol, date: dateIso, updated };
}

export function getMasterExcelPath(): string | null {
  return resolveMasterExcelPath();
}

export async function readMasterExcelBuffer(): Promise<Buffer | null> {
  const filePath = resolveMasterExcelPath();
  if (!filePath) return null;
  return fs.readFileSync(filePath);
}
