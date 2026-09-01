import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import type { AttendanceStatus } from "@prisma/client";
import { findBestNameMatch, namesMatchLoose, normalizePersonName } from "./excel.js";
import { formatClassDayIso } from "./classDayService.js";
import { prisma } from "./prisma.js";

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

type StudentRef = { id: string; displayName: string };

type DayRecord = {
  dateIso: string;
  studentId: string;
  displayName: string;
  attendance: AttendanceStatus;
};

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

async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook | null> {
  const filePath = resolveMasterExcelPath();
  if (!filePath) return null;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
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

/** Solo faltas y tardanzas; presente y justificada quedan vacías. */
function missedHours(attendance: AttendanceStatus, fullDayHours: number): number | null {
  if (attendance === "ABSENT") return fullDayHours > 0 ? fullDayHours : 4;
  if (attendance === "LATE") return 1;
  return null;
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

function clearAttendanceGrid(sheet: ExcelJS.Worksheet, studentEndRow: number) {
  for (let col = DATE_COL_START; col <= DATE_COL_END; col++) {
    sheet.getRow(DATE_ROW).getCell(col).value = null;
    for (let row = STUDENT_START_ROW; row <= studentEndRow; row++) {
      sheet.getRow(row).getCell(col).value = null;
    }
  }
}

function updateMonthLabel(sheet: ExcelJS.Worksheet, dateIso: string) {
  const d = parseDateForExcel(dateIso);
  const monthLabel = MONTH_NAMES_ES[d.getMonth()] ?? "";
  if (monthLabel) sheet.getCell("H7").value = monthLabel;
}

function fillSheetFromRecords(
  sheet: ExcelJS.Worksheet,
  students: StudentRef[],
  records: DayRecord[],
) {
  const excelRows = buildStudentRowMap(sheet);
  const studentEndRow =
    excelRows.length > 0 ? excelRows[excelRows.length - 1]!.row : STUDENT_START_ROW + 30;

  clearAttendanceGrid(sheet, studentEndRow);

  if (!records.length) return;

  const uniqueDates = [...new Set(records.map((r) => r.dateIso))].sort();
  const maxCols = DATE_COL_END - DATE_COL_START + 1;
  const dates = uniqueDates.slice(0, maxCols);
  if (uniqueDates.length > maxCols) {
    console.warn(
      `[attendance-excel] Sheet ${sheet.name}: ${uniqueDates.length} fechas, solo ${maxCols} columnas en plantilla.`,
    );
  }

  const dateToCol = new Map<string, number>();
  dates.forEach((dateIso, index) => {
    const col = DATE_COL_START + index;
    dateToCol.set(dateIso, col);
    const dateCell = sheet.getRow(DATE_ROW).getCell(col);
    dateCell.value = parseDateForExcel(dateIso);
    dateCell.numFmt = "dd/mm/yy";
  });

  const latestDate = dates[dates.length - 1];
  if (latestDate) updateMonthLabel(sheet, latestDate);

  const studentsById = new Map(students.map((s, i) => [s.id, { ...s, listPosition: i + 1 }]));

  for (const rec of records) {
    const col = dateToCol.get(rec.dateIso);
    if (!col) continue;

    const student = studentsById.get(rec.studentId) ?? {
      id: rec.studentId,
      displayName: rec.displayName,
      listPosition: 0,
    };

    const row = matchStudentRow(excelRows, student, student.listPosition);
    if (!row) continue;

    const hours = missedHours(rec.attendance, weekdayHoursForDate(sheet, rec.dateIso));
    sheet.getRow(row).getCell(col).value = hours === null ? null : hours;
  }
}

/**
 * Genera el Excel oficial desde la plantilla + todos los registros en la base de datos.
 * Justificadas y presentes no llevan horas (celda vacía).
 */
export async function generateMasterAttendanceExcel(teacherId: string): Promise<Buffer | null> {
  const workbook = await loadTemplateWorkbook();
  if (!workbook) return null;

  const groups = await prisma.classGroup.findMany({
    where: { teacherId },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  for (const group of groups) {
    const sheet = workbook.getWorksheet(group.code.trim());
    if (!sheet) continue;

    const students = await prisma.user.findMany({
      where: { role: "STUDENT", groupId: group.id },
      orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
      select: { id: true, displayName: true },
    });

    const dbRecords = await prisma.classDayRecord.findMany({
      where: { groupId: group.id },
      include: { student: { select: { id: true, displayName: true } } },
      orderBy: [{ date: "asc" }],
    });

    const records: DayRecord[] = dbRecords.map((r) => ({
      dateIso: formatClassDayIso(r.date),
      studentId: r.studentId,
      displayName: r.student.displayName,
      attendance: r.attendance,
    }));

    fillSheetFromRecords(sheet, students, records);
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
