import { prisma } from "./prisma.js";
import { deleteStudentAndRelated } from "./dedupeStudents.js";

export const SEMESTER_RESET_PHRASE = "NUEVO SEMESTRE";

export async function resetSemesterForTeacher(
  teacherId: string,
  clearComms: boolean,
): Promise<{
  groupsReset: number;
  studentsRemoved: number;
  examAttemptsRemoved: number;
}> {
  const groups = await prisma.classGroup.findMany({
    where: { teacherId },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId: { in: groupIds } },
    select: { id: true },
  });

  for (const student of students) {
    await deleteStudentAndRelated(student.id);
  }

  if (groupIds.length > 0) {
    await prisma.classDayRecord.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.groupWeek.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.activity.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.classGroup.updateMany({
      where: { id: { in: groupIds } },
      data: {
        partialClosed: false,
        partialClosedAt: null,
        progressClosed: false,
        progressClosedAt: null,
        plannedActivities: null,
      },
    });
  }

  const exam = await prisma.officeExam.findUnique({ where: { teacherId } });
  let examAttemptsRemoved = 0;
  if (exam) {
    const deleted = await prisma.officeExamAttempt.deleteMany({ where: { examId: exam.id } });
    examAttemptsRemoved = deleted.count;
    await prisma.officeExam.update({
      where: { id: exam.id },
      data: { enabledForStudents: false, enabledAt: null },
    });
  }

  if (clearComms) {
    await prisma.announcement.deleteMany({ where: { teacherId } });
    await prisma.task.deleteMany({ where: { teacherId } });
    await prisma.schoolCalendar.deleteMany({ where: { teacherId } });
  }

  return {
    groupsReset: groups.length,
    studentsRemoved: students.length,
    examAttemptsRemoved,
  };
}

export async function createTeacherGroup(teacherId: string, code: string, shift: string) {
  const normalizedCode = code.trim();
  const normalizedShift = shift.trim() || "matutino";
  if (!normalizedCode) throw new Error("invalid_group_code");

  return prisma.classGroup.create({
    data: {
      teacherId,
      code: normalizedCode,
      shift: normalizedShift,
    },
  });
}

export async function deleteTeacherGroup(teacherId: string, groupId: string) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true },
  });
  if (!group) throw new Error("group_not_found");

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true },
  });
  for (const student of students) {
    await deleteStudentAndRelated(student.id);
  }

  await prisma.classGroup.delete({ where: { id: groupId } });
  return { studentsRemoved: students.length };
}
