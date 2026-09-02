import type { AttendanceStatus } from "@prisma/client";
import { prisma } from "./prisma.js";

const MAX_STARS = 3;

export function parseClassDayDate(input: string): Date | null {
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(`${trimmed}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Día de clase “hoy” en zona México (coincide con la fecha local del docente). */
export function todayClassDayDate(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/** Fecha de calendario YYYY-MM-DD desde un Date de Prisma (@db.Date). */
export function formatClassDayIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ExistingClassDayRow = {
  id: string;
  studentId: string;
  attendance: AttendanceStatus;
  stars: number;
};

export async function dedupeClassDayRecordsForDay(groupId: string, dateIso: string) {
  try {
    await prisma.$executeRaw`
      DELETE r1 FROM \`ClassDayRecord\` r1
      INNER JOIN \`ClassDayRecord\` r2
      ON r1.\`groupId\` = r2.\`groupId\`
        AND r1.\`studentId\` = r2.\`studentId\`
        AND DATE(r1.\`date\`) = DATE(r2.\`date\`)
        AND r1.\`id\` > r2.\`id\`
      WHERE r1.\`groupId\` = ${groupId} AND DATE(r1.\`date\`) = DATE(${dateIso})
    `;
  } catch (err) {
    console.warn("[class-day] dedupe for day skipped:", err);
  }
}

/** Busca por fecha de calendario (evita desfases de zona horaria con Prisma Date). */
async function loadExistingByStudent(groupId: string, dateIso: string) {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; studentId: string; attendance: string; stars: number | bigint }>
    >`
      SELECT \`id\`, \`studentId\`, \`attendance\`, \`stars\`
      FROM \`ClassDayRecord\`
      WHERE \`groupId\` = ${groupId} AND DATE(\`date\`) = DATE(${dateIso})
    `;
    return new Map(
      rows.map((r) => [
        r.studentId,
        {
          id: r.id,
          studentId: r.studentId,
          attendance: r.attendance as AttendanceStatus,
          stars: Number(r.stars),
        },
      ]),
    );
  } catch (err) {
    console.warn("[class-day] raw load failed, fallback to prisma:", err);
    const date = parseClassDayDate(dateIso);
    if (!date) return new Map();
    const rows = await prisma.classDayRecord.findMany({
      where: { groupId, date },
      select: { id: true, studentId: true, attendance: true, stars: true },
    });
    return new Map(rows.map((r) => [r.studentId, { ...r, stars: Number(r.stars) }]));
  }
}

async function findExistingRecord(groupId: string, studentId: string, dateIso: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT \`id\`
      FROM \`ClassDayRecord\`
      WHERE \`groupId\` = ${groupId} AND \`studentId\` = ${studentId} AND DATE(\`date\`) = DATE(${dateIso})
      ORDER BY \`id\` ASC
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  } catch {
    const date = parseClassDayDate(dateIso);
    if (!date) return null;
    const row = await prisma.classDayRecord.findFirst({
      where: { groupId, studentId, date },
      select: { id: true },
    });
    return row?.id ?? null;
  }
}

function isPrismaUniqueViolation(err: unknown) {
  return (
    err &&
    typeof err === "object" &&
    "code" in err &&
    String((err as { code: unknown }).code) === "P2002"
  );
}

async function writeClassDayRecord(
  data: {
    groupId: string;
    studentId: string;
    dateIso: string;
    attendance: AttendanceStatus;
    stars: number;
    markedById: string;
  },
  existingId?: string,
) {
  const date = parseClassDayDate(data.dateIso);
  if (!date) throw new Error("invalid_date");

  const payload = {
    attendance: data.attendance,
    stars: data.stars,
    markedById: data.markedById,
  };

  const id = existingId ?? (await findExistingRecord(data.groupId, data.studentId, data.dateIso));
  if (id) {
    await prisma.classDayRecord.update({ where: { id }, data: payload });
    return;
  }

  try {
    await prisma.classDayRecord.create({
      data: {
        groupId: data.groupId,
        studentId: data.studentId,
        date,
        ...payload,
      },
    });
  } catch (err) {
    if (!isPrismaUniqueViolation(err)) throw err;
    const retryId = await findExistingRecord(data.groupId, data.studentId, data.dateIso);
    if (!retryId) throw err;
    await prisma.classDayRecord.update({ where: { id: retryId }, data: payload });
  }
}

export async function getParticipationStarsByStudent(groupId: string): Promise<Map<string, number>> {
  const rows = await prisma.classDayRecord.groupBy({
    by: ["studentId"],
    where: { groupId },
    _sum: { stars: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.studentId, row._sum.stars ?? 0);
  }
  return map;
}

export async function getStudentParticipationStars(studentId: string, groupId: string): Promise<number> {
  const agg = await prisma.classDayRecord.aggregate({
    where: { studentId, groupId },
    _sum: { stars: true },
  });
  return agg._sum.stars ?? 0;
}

export async function getStudentAttendanceSummary(studentId: string, groupId: string) {
  const rows = await prisma.classDayRecord.findMany({
    where: { studentId, groupId },
    select: { attendance: true },
  });
  const summary = { present: 0, absent: 0, late: 0, justified: 0, totalDays: rows.length };
  for (const row of rows) {
    if (row.attendance === "PRESENT") summary.present++;
    else if (row.attendance === "ABSENT") summary.absent++;
    else if (row.attendance === "LATE") summary.late++;
    else if (row.attendance === "JUSTIFIED") summary.justified++;
  }
  const ratePercent =
    summary.totalDays > 0
      ? Math.round(((summary.present + summary.late) / summary.totalDays) * 100)
      : 100;
  return { ...summary, ratePercent };
}

export async function getClassDaySheet(
  teacherId: string,
  groupId: string,
  date: Date,
) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) throw new Error("group_not_found");

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
  });

  const dateIso = formatClassDayIso(date);
  const existingByStudent = await loadExistingByStudent(groupId, dateIso);
  const byStudent = new Map(
    [...existingByStudent.entries()].map(([studentId, r]) => [
      studentId,
      { attendance: r.attendance, stars: r.stars },
    ]),
  );

  return {
    group,
    date: formatClassDayIso(date),
    maxStars: MAX_STARS,
    rows: students.map((s) => {
      const rec = byStudent.get(s.id);
      return {
        student: s,
        attendance: rec?.attendance ?? "PRESENT",
        stars: rec?.stars ?? 0,
        saved: existingByStudent.has(s.id),
      };
    }),
  };
}

export async function saveClassDayRecords(
  teacherId: string,
  groupId: string,
  date: Date,
  records: Array<{ studentId: string; attendance: AttendanceStatus; stars: number }>,
) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true },
  });
  if (!group) throw new Error("group_not_found");

  const studentIds = new Set(
    (
      await prisma.user.findMany({
        where: { role: "STUDENT", groupId },
        select: { id: true },
      })
    ).map((s) => s.id),
  );

  const dateIso = formatClassDayIso(date);
  await dedupeClassDayRecordsForDay(groupId, dateIso);
  const existingByStudent = await loadExistingByStudent(groupId, dateIso);

  let saved = 0;
  for (const rec of records) {
    if (!studentIds.has(rec.studentId)) continue;
    const stars = Math.max(0, Math.min(MAX_STARS, Math.round(Number(rec.stars) || 0)));
    const prev = existingByStudent.get(rec.studentId);
    if (prev && prev.attendance === rec.attendance && prev.stars === stars) continue;

    await writeClassDayRecord(
      {
        groupId,
        studentId: rec.studentId,
        dateIso,
        attendance: rec.attendance,
        stars,
        markedById: teacherId,
      },
      prev?.id,
    );
    saved++;
  }

  if (saved === 0 && existingByStudent.size > 0) {
    return {
      saved: 0,
      unchanged: true,
      message: "Inasistencias registradas. No hay cambios nuevos.",
    };
  }

  return { saved, unchanged: false };
}
