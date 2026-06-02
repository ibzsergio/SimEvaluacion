import type { Activity, ClassGroup } from "@prisma/client";
import { prisma } from "./prisma.js";
import { normalizePersonName } from "./excel.js";
import type { ParsedGradesSheet } from "./importGradesExcel.js";

export type GradeImportSummary = {
  activitiesCreated: number;
  activitiesMatched: number;
  gradesUpserted: number;
  gradesSkipped: number;
  unknownControls: string[];
  unknownStudents: string[];
  activityDetails: { name: string; date: string; action: "created" | "matched" }[];
};

function normalizeActivityNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function findMatchingActivityByName(activities: Activity[], name: string): Activity | undefined {
  const key = normalizeActivityNameKey(name);
  return activities.find((a) => normalizeActivityNameKey(a.name) === key);
}

async function upsertGradeForStudent(
  activityId: string,
  studentId: string,
  points: number,
  maxPoints: number,
  teacherId: string,
): Promise<void> {
  const clamped = Math.min(Math.max(0, points), maxPoints);

  await prisma.grade.upsert({
    where: { activityId_studentId: { activityId, studentId } },
    update: { points: clamped, signatures: 0, gradedById: teacherId },
    create: {
      activityId,
      studentId,
      points: clamped,
      signatures: 0,
      gradedById: teacherId,
    },
  });

  await prisma.submission.upsert({
    where: { activityId_studentId: { activityId, studentId } },
    update: { submittedAt: new Date() },
    create: { activityId, studentId, submittedAt: new Date() },
  });
}

function resolveStudentId(
  row: { controlNumber?: string; studentName?: string },
  studentByControl: Map<string, string>,
  studentByName: Map<string, string>,
): string | undefined {
  if (row.controlNumber) {
    const byControl = studentByControl.get(row.controlNumber);
    if (byControl) return byControl;
  }
  if (row.studentName) {
    const key = normalizePersonName(row.studentName);
    const byName = studentByName.get(key);
    if (byName) return byName;
  }
  return undefined;
}

export async function importGradesForGroup(
  group: ClassGroup,
  parsed: ParsedGradesSheet,
  teacherId: string,
): Promise<GradeImportSummary> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId: group.id },
    select: { id: true, controlNumber: true, displayName: true },
  });

  const studentByControl = new Map(
    students
      .filter((s) => s.controlNumber)
      .map((s) => [s.controlNumber!, s.id] as const),
  );

  const studentByName = new Map<string, string>();
  for (const s of students) {
    studentByName.set(normalizePersonName(s.displayName), s.id);
  }

  let existingActivities = await prisma.activity.findMany({
    where: { groupId: group.id, createdById: teacherId },
  });

  const summary: GradeImportSummary = {
    activitiesCreated: 0,
    activitiesMatched: 0,
    gradesUpserted: 0,
    gradesSkipped: 0,
    unknownControls: [],
    unknownStudents: [],
    activityDetails: [],
  };

  const activityIdByColumn = new Map<number, string>();

  for (const col of parsed.activities) {
    let activity = findMatchingActivityByName(existingActivities, col.name);

    if (!activity) {
      activity = await prisma.activity.create({
        data: {
          name: col.name.trim(),
          date: new Date(`${col.date}T12:00:00.000Z`),
          maxPoints: col.maxPoints,
          signatureMax: 0,
          groupId: group.id,
          createdById: teacherId,
        },
      });
      existingActivities.push(activity);
      summary.activitiesCreated++;
      summary.activityDetails.push({ name: col.name, date: col.date, action: "created" });
    } else {
      if (col.maxPoints > activity.maxPoints) {
        activity = await prisma.activity.update({
          where: { id: activity.id },
          data: { maxPoints: col.maxPoints },
        });
        const idx = existingActivities.findIndex((a) => a.id === activity!.id);
        if (idx >= 0) existingActivities[idx] = activity;
      }
      summary.activitiesMatched++;
      summary.activityDetails.push({ name: col.name, date: col.date, action: "matched" });
    }

    activityIdByColumn.set(col.columnIndex, activity.id);
  }

  const unknownControlSet = new Set<string>();
  const unknownNameSet = new Set<string>();

  for (const row of parsed.rows) {
    const studentId = resolveStudentId(row, studentByControl, studentByName);
    if (!studentId) {
      if (row.controlNumber) unknownControlSet.add(row.controlNumber);
      if (row.studentName) unknownNameSet.add(row.studentName);
      summary.gradesSkipped += row.grades.length;
      continue;
    }

    for (const g of row.grades) {
      const activityId = activityIdByColumn.get(g.columnIndex);
      if (!activityId) continue;

      const activity = existingActivities.find((a) => a.id === activityId);
      if (!activity) continue;

      await upsertGradeForStudent(activityId, studentId, g.points, activity.maxPoints, teacherId);
      summary.gradesUpserted++;
    }
  }

  summary.unknownControls = [...unknownControlSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  summary.unknownStudents = [...unknownNameSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return summary;
}
