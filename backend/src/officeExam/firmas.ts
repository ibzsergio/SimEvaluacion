import { prisma } from "../prisma.js";
import { getParticipationStarsByStudent, getStudentParticipationStars } from "../classDayService.js";

/**
 * Puntos totales del alumno: actividades + estrellas de participación (1 estrella = 1 punto).
 * Si hay `signatures` en calificaciones (legado), usa signatures + estrellas; si no, points + estrellas.
 */
export async function getStudentTotalFirmas(studentId: string, groupId: string): Promise<number> {
  const [participationStars, grades] = await Promise.all([
    getStudentParticipationStars(studentId, groupId),
    prisma.grade.findMany({
      where: { studentId, activity: { groupId } },
      select: { points: true, signatures: true },
    }),
  ]);

  const activityPoints = grades.reduce((acc, g) => acc + g.points, 0);
  const signatures = grades.reduce((acc, g) => acc + (g.signatures ?? 0), 0);
  const base = signatures > 0 ? signatures : activityPoints;
  return base + participationStars;
}

export async function getFirmasByStudentForGroup(
  groupId: string,
): Promise<Map<string, number>> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true },
  });

  const [participationByStudent, gradeRows] = await Promise.all([
    getParticipationStarsByStudent(groupId),
    prisma.grade.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, activity: { groupId } },
      select: { studentId: true, points: true, signatures: true },
    }),
  ]);

  const pointsByStudent = new Map<string, number>();
  const sigByStudent = new Map<string, number>();
  for (const g of gradeRows) {
    pointsByStudent.set(g.studentId, (pointsByStudent.get(g.studentId) ?? 0) + g.points);
    sigByStudent.set(g.studentId, (sigByStudent.get(g.studentId) ?? 0) + (g.signatures ?? 0));
  }

  const map = new Map<string, number>();
  for (const s of students) {
    const stars = participationByStudent.get(s.id) ?? 0;
    const signatures = sigByStudent.get(s.id) ?? 0;
    const base = signatures > 0 ? signatures : (pointsByStudent.get(s.id) ?? 0);
    map.set(s.id, base + stars);
  }
  return map;
}
