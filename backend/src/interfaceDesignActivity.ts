import { prisma } from "./prisma.js";
import { formatClassDayIso, parseClassDayDate } from "./classDayService.js";
import { listTeacherGroups } from "./groups.js";

export const INTERFACE_ACTIVITY_NAME = "Diseño de Interfaces Proyecto";
export const INTERFACE_MAX_POINTS = 3000;
export const INTERFACE_CLOSE_ISO = "2026-10-28";
export const INTERFACE_PARTIAL = 2;
export const INTERFACE_WARNING_POINTS = 50;

export function mexicoTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** El miércoles 28 de octubre la actividad ya está cerrada y se publica el puntaje. */
export function interfaceDesignClosed(now = new Date()) {
  return mexicoTodayIso(now) >= INTERFACE_CLOSE_ISO;
}

/** La deja en los grupos del docente, oculta para los alumnos hasta que la libere. */
export async function ensureInterfaceDesignActivities(teacherId: string) {
  const groups = await listTeacherGroups(teacherId);
  const activityDate = parseClassDayDate(INTERFACE_CLOSE_ISO);
  if (!activityDate || !groups.length) return;

  for (const group of groups) {
    const existing = await prisma.activity.findFirst({
      where: { groupId: group.id, name: INTERFACE_ACTIVITY_NAME },
      select: { id: true, maxPoints: true, releasedToStudents: true, date: true },
    });
    if (existing) {
      const publish = interfaceDesignClosed() && !existing.releasedToStudents;
      const dateChanged = formatClassDayIso(existing.date) !== INTERFACE_CLOSE_ISO;
      if (existing.maxPoints !== INTERFACE_MAX_POINTS || publish || dateChanged) {
        await prisma.activity.update({
          where: { id: existing.id },
          data: {
            ...(existing.maxPoints !== INTERFACE_MAX_POINTS ? { maxPoints: INTERFACE_MAX_POINTS } : {}),
            ...(publish ? { releasedToStudents: true } : {}),
            ...(dateChanged ? { date: activityDate } : {}),
          },
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
        releasedToStudents: interfaceDesignClosed(),
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
