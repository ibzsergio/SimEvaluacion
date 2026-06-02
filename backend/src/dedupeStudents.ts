import { prisma } from "./prisma.js";
import { isJunkStudentRecord, isLikelyRowIndexControl, normalizePersonName } from "./excel.js";

function scoreStudent(s: {
  passwordSet: boolean;
  controlNumber: string | null;
  _count: { grades: number };
  createdAt: Date;
}): number {
  let score = 0;
  if (s.passwordSet) score += 1000;
  if (s.controlNumber && !isLikelyRowIndexControl(s.controlNumber)) {
    score += 100 + s.controlNumber.length;
  }
  score += s._count.grades * 5;
  score -= s.createdAt.getTime() / 1_000_000_000_000;
  return score;
}

async function mergeStudentData(keeperId: string, removeId: string) {
  const grades = await prisma.grade.findMany({ where: { studentId: removeId } });
  for (const g of grades) {
    await prisma.grade.upsert({
      where: { activityId_studentId: { activityId: g.activityId, studentId: keeperId } },
      update: { points: g.points, signatures: g.signatures, gradedById: g.gradedById },
      create: {
        activityId: g.activityId,
        studentId: keeperId,
        points: g.points,
        signatures: g.signatures,
        gradedById: g.gradedById,
        gradedAt: g.gradedAt,
      },
    });
  }

  const submissions = await prisma.submission.findMany({ where: { studentId: removeId } });
  for (const sub of submissions) {
    await prisma.submission.upsert({
      where: { activityId_studentId: { activityId: sub.activityId, studentId: keeperId } },
      update: { submittedAt: sub.submittedAt },
      create: {
        activityId: sub.activityId,
        studentId: keeperId,
        submittedAt: sub.submittedAt,
      },
    });
  }

  const wins = await prisma.weeklyWinner.findMany({ where: { studentId: removeId } });
  for (const w of wins) {
    const existing = await prisma.weeklyWinner.findUnique({ where: { weekId: w.weekId } });
    if (existing && existing.studentId !== keeperId) {
      await prisma.weeklyWinner.delete({ where: { id: w.id } });
    } else {
      await prisma.weeklyWinner.update({
        where: { id: w.id },
        data: { studentId: keeperId },
      });
    }
  }

  await prisma.grade.deleteMany({ where: { studentId: removeId } });
  await prisma.submission.deleteMany({ where: { studentId: removeId } });
}

async function deleteStudentAndRelated(studentId: string) {
  await prisma.grade.deleteMany({ where: { studentId } });
  await prisma.submission.deleteMany({ where: { studentId } });
  await prisma.weeklyWinner.deleteMany({ where: { studentId } });
  await prisma.user.delete({ where: { id: studentId } });
}

export async function removeJunkStudentsForGroup(groupId: string): Promise<number> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
  });

  let removed = 0;
  for (const s of students) {
    if (!isJunkStudentRecord(s.controlNumber, s.displayName)) continue;
    await deleteStudentAndRelated(s.id);
    removed++;
  }
  return removed;
}

export async function removeJunkStudentsForTeacher(teacherId: string): Promise<{
  removed: number;
  details: string[];
}> {
  const groups = await prisma.classGroup.findMany({ where: { teacherId } });
  let removed = 0;
  const details: string[] = [];

  for (const group of groups) {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", groupId: group.id },
    });

    for (const s of students) {
      if (!isJunkStudentRecord(s.controlNumber, s.displayName)) continue;
      await deleteStudentAndRelated(s.id);
      removed++;
      const reason = /^\d{1,4}$/.test(s.displayName.trim())
        ? "calificación importada por error"
        : "fila de encabezado";
      details.push(`Grupo ${group.code}: eliminado "${s.displayName}" (${reason})`);
    }
  }

  return { removed, details };
}

export async function dedupeStudentsForTeacher(teacherId: string): Promise<{
  removed: number;
  details: string[];
}> {
  const junk = await removeJunkStudentsForTeacher(teacherId);
  const groups = await prisma.classGroup.findMany({ where: { teacherId } });
  let removed = junk.removed;
  const details: string[] = [...junk.details];

  for (const group of groups) {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", groupId: group.id },
      include: { _count: { select: { grades: true } } },
    });

    const byName = new Map<string, typeof students>();
    for (const s of students) {
      const key = normalizePersonName(s.displayName);
      const list = byName.get(key) ?? [];
      list.push(s);
      byName.set(key, list);
    }

    for (const [nameKey, dupes] of byName) {
      if (dupes.length < 2) continue;

      const sorted = [...dupes].sort((a, b) => scoreStudent(b) - scoreStudent(a));
      const keeper = sorted[0]!;
      const toRemove = sorted.slice(1);

      details.push(
        `Grupo ${group.code}: ${nameKey} — se conservó 1, se quitaron ${toRemove.length}`,
      );

      for (const dupe of toRemove) {
        await mergeStudentData(keeper.id, dupe.id);
        await deleteStudentAndRelated(dupe.id);
        removed++;
      }
    }
  }

  return { removed, details };
}
