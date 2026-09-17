import { prisma } from "./prisma.js";
import { formatClassDayIso } from "./classDayService.js";

export type DeliveryCellStatus = "graded" | "pending" | "overdue";

export async function getGroupDeliveryStatus(teacherId: string, groupId: string) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) throw new Error("group_not_found");

  const [students, activities] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", groupId },
      orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
      select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    }),
    prisma.activity.findMany({
      where: { groupId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        date: true,
        maxPoints: true,
        sortOrder: true,
        createdAt: true,
      },
    }),
  ]);

  const activityIds = activities.map((a) => a.id);
  const grades =
    activityIds.length === 0
      ? []
      : await prisma.grade.findMany({
          where: { activityId: { in: activityIds } },
          select: {
            activityId: true,
            studentId: true,
            points: true,
            gradedAt: true,
          },
        });

  const gradeMap = new Map(
    grades.map((g) => [`${g.studentId}:${g.activityId}`, g] as const),
  );

  const now = Date.now();
  const activityMeta = activities.map((a, index) => {
    const dateIso = formatClassDayIso(a.date);
    const dueEnd = new Date(`${dateIso}T23:59:59.999Z`).getTime();
    return {
      id: a.id,
      name: a.name,
      date: dateIso,
      maxPoints: a.maxPoints,
      sortOrder: a.sortOrder,
      index,
      isPastDue: now > dueEnd,
    };
  });

  const rows = students.map((student, listPosition) => {
    let graded = 0;
    let pending = 0;
    let overdue = 0;

    const cells = activityMeta.map((activity) => {
      const grade = gradeMap.get(`${student.id}:${activity.id}`);
      if (grade) {
        graded += 1;
        return {
          activityId: activity.id,
          status: "graded" as const,
          points: grade.points,
          maxPoints: activity.maxPoints,
          gradedAt: grade.gradedAt.toISOString(),
        };
      }
      if (activity.isPastDue) {
        overdue += 1;
        return {
          activityId: activity.id,
          status: "overdue" as const,
          points: null,
          maxPoints: activity.maxPoints,
          gradedAt: null,
        };
      }
      pending += 1;
      return {
        activityId: activity.id,
        status: "pending" as const,
        points: null,
        maxPoints: activity.maxPoints,
        gradedAt: null,
      };
    });

    const total = activityMeta.length;
    const deliveryPercent = total > 0 ? Math.round((graded / total) * 100) : 100;

    return {
      student: {
        ...student,
        listPosition: listPosition + 1,
      },
      summary: {
        graded,
        pending,
        overdue,
        total,
        deliveryPercent,
      },
      cells,
    };
  });

  const totals = {
    students: students.length,
    activities: activityMeta.length,
    fullyComplete: rows.filter((r) => r.summary.pending === 0 && r.summary.overdue === 0).length,
    withOverdue: rows.filter((r) => r.summary.overdue > 0).length,
    withPending: rows.filter((r) => r.summary.pending > 0).length,
  };

  return {
    group,
    activities: activityMeta,
    rows,
    totals,
  };
}
