import { prisma } from "../prisma.js";

/** Total de firmas del alumno en el grupo (suma de signatures; si no hay, entregas calificadas). */
export async function getStudentTotalFirmas(studentId: string, groupId: string): Promise<number> {
  const sigSum = await prisma.grade.aggregate({
    where: { studentId, activity: { groupId } },
    _sum: { signatures: true },
  });
  const signatures = sigSum._sum.signatures ?? 0;
  if (signatures > 0) return signatures;

  return prisma.submission.count({
    where: { studentId, activity: { groupId } },
  });
}

export async function getFirmasByStudentForGroup(
  groupId: string,
): Promise<Map<string, number>> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true },
  });
  const map = new Map<string, number>();
  await Promise.all(
    students.map(async (s) => {
      map.set(s.id, await getStudentTotalFirmas(s.id, groupId));
    }),
  );
  return map;
}
