import { prisma } from "./prisma.js";
import { parseClassDayDate } from "./classDayService.js";
import { listTeacherGroups } from "./groups.js";

export const INTERFACE_ACTIVITY_NAME = "Diseño de Interfaces Proyecto";
export const INTERFACE_MAX_POINTS = 5000;
export const INTERFACE_CLOSE_ISO = "2026-10-22";
export const INTERFACE_PARTIAL = 2;
export const INTERFACE_WARNING_POINTS = 50;

/** La deja en los grupos del docente, oculta para los alumnos hasta que la libere. */
export async function ensureInterfaceDesignActivities(teacherId: string) {
  const groups = await listTeacherGroups(teacherId);
  const activityDate = parseClassDayDate(INTERFACE_CLOSE_ISO);
  if (!activityDate || !groups.length) return;

  for (const group of groups) {
    const existing = await prisma.activity.findFirst({
      where: { groupId: group.id, name: INTERFACE_ACTIVITY_NAME },
      select: { id: true, maxPoints: true },
    });
    if (existing) {
      if (existing.maxPoints !== INTERFACE_MAX_POINTS) {
        await prisma.activity.update({
          where: { id: existing.id },
          data: { maxPoints: INTERFACE_MAX_POINTS },
        });
      }
      continue;
    }

    const lastOrder = await prisma.activity.aggregate({
      where: { groupId: group.id },
      _max: { sortOrder: true },
    });
    await prisma.activity.create({
      data: {
        date: activityDate,
        name: INTERFACE_ACTIVITY_NAME,
        maxPoints: INTERFACE_MAX_POINTS,
        signatureMax: 0,
        sortOrder: (lastOrder._max.sortOrder ?? -1) + 1,
        partialNumber: INTERFACE_PARTIAL,
        releasedToStudents: false,
        groupId: group.id,
        createdById: teacherId,
      },
    });
  }
}

/** Libera u oculta la misma actividad en todos los grupos del docente. */
export async function setInterfaceDesignReleased(teacherId: string, released: boolean) {
  const groups = await listTeacherGroups(teacherId);
  await ensureInterfaceDesignActivities(teacherId);
  const result = await prisma.activity.updateMany({
    where: {
      createdById: teacherId,
      name: INTERFACE_ACTIVITY_NAME,
      groupId: { in: groups.map((group) => group.id) },
    },
    data: { releasedToStudents: released },
  });
  return result.count;
}
