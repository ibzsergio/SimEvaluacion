import { prisma } from "../prisma.js";

/**
 * Total de firmas del alumno en el grupo.
 * Usa la suma de `signatures` por actividad cuando existe; si no, cada actividad calificada cuenta como 1 firma.
 */
export async function getStudentTotalFirmas(studentId: string, groupId: string): Promise<number> {
  const grades = await prisma.grade.findMany({
    where: { studentId, activity: { groupId } },
    select: { signatures: true },
  });

  const sigSum = grades.reduce((acc, g) => acc + (g.signatures ?? 0), 0);
  if (sigSum > 0) return sigSum;

  return grades.length;
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
