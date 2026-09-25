import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { findBestNameMatch, matchSheetToGroupCode, normalizeControlNumber } from "./excel.js";
import { prisma } from "./prisma.js";
import {
  ACTIVITY_WEIGHT,
  attendanceRatePercent,
  computeScale6,
  PARTICIPATION_WEIGHT,
  rankingScoreForScale,
  SCALE_RULE,
} from "./scaleGrade.js";

const TEMPLATE_FILE_NAME = "LISTAS F1_2026-2027.xlsx";
export const LISTAS_F1_EXPECTED_GROUPS = ["301", "302"] as const;

const STUDENT_START_ROW = 12;
const COL = {
  list: 2,
  control: 3,
  name: 4,
  attendance: 5,
  scale: 6,
  exam: 7,
  final: 8,
} as const;

export type ListasF1StudentRow = {
  studentId: string;
  displayName: string;
  controlNumber: string | null;
  listNumber: number | null;
  activityPoints: number;
  activityMax: number;
  activityScore: number;
  participationStars: number;
  participationMax: number;
  participationScore: number;
  rankingScore: number;
  scale6: number;
  attendancePercent: number;
};

export type ListasF1GroupPreview = {
  group: {
    id: string;
    code: string;
    shift: string;
    partialClosed: boolean;
    partialClosedAt: string | null;
  };
  rule: typeof SCALE_RULE;
  activityCount: number;
  activityMax: number;
  classDays: number;
  useParticipation: boolean;
  firstPlaceScore: number;
  rows: ListasF1StudentRow[];
};

type ExcelStudentRow = { row: number; name: string; control: string; listNo: number | null };

function resolveListasF1Path(): string | null {
  const envPath = process.env.LISTAS_F1_EXCEL?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    path.join(process.cwd(), "data", TEMPLATE_FILE_NAME),
    path.join(process.cwd(), "..", TEMPLATE_FILE_NAME),
    path.join(process.cwd(), TEMPLATE_FILE_NAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook | null> {
  const filePath = resolveListasF1Path();
  if (!filePath) return null;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result != null) return String(value.result).trim();
  }
  return String(value).trim();
}

function isFooterName(name: string) {
  const n = name.toLowerCase();
  return n.includes("promedio") || n.includes("reprobaci") || n.startsWith("_");
}

function buildExcelStudentRows(sheet: ExcelJS.Worksheet): ExcelStudentRow[] {
  const rows: ExcelStudentRow[] = [];
  for (let row = STUDENT_START_ROW; row <= sheet.rowCount; row++) {
    const name = cellText(sheet.getRow(row).getCell(COL.name).value);
    if (!name) break;
    if (isFooterName(name)) break;
    const control = normalizeControlNumber(sheet.getRow(row).getCell(COL.control).value);
    const listRaw = sheet.getRow(row).getCell(COL.list).value;
    const listNo =
      typeof listRaw === "number"
        ? listRaw
        : Number.isFinite(Number(listRaw))
          ? Number(listRaw)
          : null;
    rows.push({ row, name, control, listNo });
  }
  return rows;
}

function matchExcelRow(excelRows: ExcelStudentRow[], student: ListasF1StudentRow): number | null {
  const control = normalizeControlNumber(student.controlNumber ?? "");
  if (control) {
    const byControl = excelRows.find((r) => r.control && r.control === control);
    if (byControl) return byControl.row;
  }

  const byName = findBestNameMatch(
    excelRows.map((r) => ({ displayName: r.name, row: r.row })),
    student.displayName,
  );
  if (byName) return byName.row;

  if (student.listNumber != null) {
    const byList = excelRows.find((r) => r.listNo === student.listNumber);
    if (byList) return byList.row;
  }
  return null;
}

function findSheetForGroup(workbook: ExcelJS.Workbook, groupCode: string) {
  const exact = workbook.getWorksheet(groupCode.trim());
  if (exact) return exact;
  return workbook.worksheets.find((s) => matchSheetToGroupCode(s.name, [groupCode]) === groupCode);
}

function formatDateMx(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function writeAttendanceCell(cell: ExcelJS.Cell, percent: number) {
  const ratio = Math.max(0, Math.min(100, percent)) / 100;
  const fmt = String(cell.numFmt ?? "");
  if (fmt.includes("%")) {
    cell.value = ratio;
    return;
  }
  cell.value = ratio;
  cell.numFmt = "0%";
}

function writeScaleCell(cell: ExcelJS.Cell, scale6: number) {
  cell.value = scale6;
  if (!cell.numFmt) cell.numFmt = "0.0";
}

function writeFinalFormula(cell: ExcelJS.Cell, row: number) {
  const scaleAddr = `F${row}`;
  const examAddr = `G${row}`;
  cell.value = { formula: `IF(COUNT(${scaleAddr},${examAddr})=2,ROUND(${scaleAddr}+${examAddr},1),"")` };
}

async function getGroupScaleData(groupId: string): Promise<ListasF1GroupPreview | null> {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      code: true,
      shift: true,
      partialClosed: true,
      partialClosedAt: true,
    },
  });
  if (!group) return null;

  const cutoff = group.partialClosed && group.partialClosedAt ? group.partialClosedAt : new Date();

  const [activities, students, dayRecords] = await Promise.all([
    prisma.activity.findMany({
      where: { groupId, createdAt: { lte: cutoff } },
      select: { id: true, maxPoints: true },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT", groupId },
      select: { id: true, displayName: true, listNumber: true, controlNumber: true },
      orderBy: [{ listNumber: "asc" }, { displayName: "asc" }],
    }),
    prisma.classDayRecord.findMany({
      where: { groupId },
      select: { studentId: true, attendance: true, stars: true, date: true },
    }),
  ]);

  const activityIds = activities.map((a) => a.id);
  const activityMax = activities.reduce((acc, a) => acc + (a.maxPoints ?? 0), 0);

  const grades =
    activityIds.length > 0
      ? await prisma.grade.groupBy({
          by: ["studentId"],
          where: { studentId: { in: students.map((s) => s.id) }, activityId: { in: activityIds } },
          _sum: { points: true },
        })
      : [];
  const pointsByStudent = new Map(grades.map((g) => [g.studentId, g._sum.points ?? 0]));

  const uniqueDays = new Set(dayRecords.map((r) => r.date.toISOString().slice(0, 10)));
  const classDays = uniqueDays.size;
  const useParticipation = dayRecords.some((r) => (r.stars ?? 0) > 0);

  const attendanceByStudent = new Map<
    string,
    { present: number; late: number; absent: number; justified: number; totalDays: number; stars: number }
  >();
  for (const rec of dayRecords) {
    const cur = attendanceByStudent.get(rec.studentId) ?? {
      present: 0,
      late: 0,
      absent: 0,
      justified: 0,
      totalDays: 0,
      stars: 0,
    };
    cur.totalDays += 1;
    cur.stars += rec.stars ?? 0;
    if (rec.attendance === "PRESENT") cur.present += 1;
    else if (rec.attendance === "LATE") cur.late += 1;
    else if (rec.attendance === "ABSENT") cur.absent += 1;
    else if (rec.attendance === "JUSTIFIED") cur.justified += 1;
    attendanceByStudent.set(rec.studentId, cur);
  }

  const drafted = students.map((s) => {
    const att = attendanceByStudent.get(s.id);
    const activityPoints = pointsByStudent.get(s.id) ?? 0;
    const participationStars = att?.stars ?? 0;
    return {
      studentId: s.id,
      displayName: s.displayName,
      controlNumber: s.controlNumber,
      listNumber: s.listNumber,
      activityPoints,
      activityMax,
      participationStars,
      rankingScore: rankingScoreForScale(activityPoints, participationStars),
      attendancePercent: attendanceRatePercent({
        classDays,
        absent: att?.absent ?? 0,
      }),
    };
  });

  const firstPlaceScore = drafted.reduce((max, row) => Math.max(max, row.rankingScore), 0);
  const maxStars = drafted.reduce((max, row) => Math.max(max, row.participationStars), 0);

  const rows: ListasF1StudentRow[] = drafted.map((row) => {
    const scale = computeScale6({
      rankingScore: row.rankingScore,
      firstPlaceScore,
    });
    const activityScore = firstPlaceScore > 0 ? (row.activityPoints / firstPlaceScore) * 6 : 0;
    const participationScore = firstPlaceScore > 0 ? (row.participationStars / firstPlaceScore) * 6 : 0;
    return {
      ...row,
      activityScore: Math.round(activityScore * 10) / 10,
      participationMax: useParticipation ? maxStars : 0,
      participationScore: Math.round(participationScore * 10) / 10,
      scale6: scale.scale6,
    };
  });

  return {
    group: {
      id: group.id,
      code: group.code,
      shift: group.shift,
      partialClosed: group.partialClosed,
      partialClosedAt: group.partialClosedAt?.toISOString() ?? null,
    },
    rule: SCALE_RULE,
    activityCount: activities.length,
    activityMax,
    classDays,
    useParticipation,
    firstPlaceScore,
    rows,
  };
}

export async function getListasF1Preview(teacherId: string, groupId: string) {
  const owned = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true },
  });
  if (!owned) return null;

  const preview = await getGroupScaleData(groupId);
  if (!preview) return null;

  const workbook = await loadTemplateWorkbook();
  const expected = [...LISTAS_F1_EXPECTED_GROUPS];
  const teacherGroups = await prisma.classGroup.findMany({
    where: { teacherId },
    select: { code: true },
    orderBy: { code: "asc" },
  });
  const teacherCodes = teacherGroups.map((g) => g.code.trim());

  const sheets = expected.map((code) => {
    const sheet = workbook ? findSheetForGroup(workbook, code) : undefined;
    return { code, found: Boolean(sheet), excelStudents: sheet ? buildExcelStudentRows(sheet).length : 0 };
  });

  let matchedInExcel = 0;
  if (workbook) {
    const sameSheet = findSheetForGroup(workbook, preview.group.code);
    const sheetsToScan = sameSheet
      ? [sameSheet]
      : expected
          .map((code) => findSheetForGroup(workbook, code))
          .filter((sheet): sheet is ExcelJS.Worksheet => Boolean(sheet));
    const excelRows = sheetsToScan.flatMap((sheet) => buildExcelStudentRows(sheet));
    matchedInExcel = preview.rows.filter((row) => matchExcelRow(excelRows, row) != null).length;
  }

  return {
    ...preview,
    activityWeight: ACTIVITY_WEIGHT,
    participationWeight: PARTICIPATION_WEIGHT,
    excel: {
      templateFound: Boolean(workbook),
      expectedGroups: expected,
      teacherGroups: teacherCodes,
      sheets,
      matchedInExcel,
    },
  };
}

function matchStudentFromPool(
  rows: ListasF1StudentRow[],
  excel: ExcelStudentRow,
): ListasF1StudentRow | undefined {
  if (excel.control) {
    const byControl = rows.find(
      (row) => normalizeControlNumber(row.controlNumber ?? "") === excel.control,
    );
    if (byControl) return byControl;
  }
  const byName = findBestNameMatch(rows, excel.name);
  if (byName) return byName;
  if (excel.listNo != null) {
    return rows.find((row) => row.listNumber === excel.listNo);
  }
  return undefined;
}

function fillSheetFromPool(sheet: ExcelJS.Worksheet, rows: ListasF1StudentRow[]) {
  const excelRows = buildExcelStudentRows(sheet);
  const dateCell = sheet.getCell("F9");
  const current = cellText(dateCell.value);
  if (!current || /fecha/i.test(current)) {
    dateCell.value = `Fecha: ${formatDateMx()}`;
  }

  for (const excel of excelRows) {
    const student = matchStudentFromPool(rows, excel);
    if (!student) continue;
    const row = sheet.getRow(excel.row);
    writeAttendanceCell(row.getCell(COL.attendance), student.attendancePercent);
    writeScaleCell(row.getCell(COL.scale), student.scale6);
    writeFinalFormula(row.getCell(COL.final), excel.row);
  }
}

export async function generateListasF1Excel(teacherId: string): Promise<Buffer | null> {
  const workbook = await loadTemplateWorkbook();
  if (!workbook) return null;

  const groups = await prisma.classGroup.findMany({
    where: { teacherId },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  const allRows: ListasF1StudentRow[] = [];
  for (const group of groups) {
    const preview = await getGroupScaleData(group.id);
    if (preview) allRows.push(...preview.rows);
  }

  const sheetCodes = new Set<string>([
    ...LISTAS_F1_EXPECTED_GROUPS,
    ...groups.map((group) => group.code.trim()),
  ]);
  for (const code of sheetCodes) {
    const sheet = findSheetForGroup(workbook, code);
    if (!sheet) continue;
    fillSheetFromPool(sheet, allRows);
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function listasF1FileName() {
  return TEMPLATE_FILE_NAME;
}
