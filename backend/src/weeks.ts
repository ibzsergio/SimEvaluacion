import { prisma } from "./prisma.js";
import { getGroupRanking } from "./groupRanking.js";

function toDateOnly(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Lunes = 0 ... Domingo = 6
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

export function getWeekRange(date: Date) {
  const base = toDateOnly(date);
  const idx = mondayIndex(base.getDay());
  const start = toDateOnly(new Date(base.getTime() - idx * 24 * 60 * 60 * 1000));
  const end = toDateOnly(new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000)); // viernes
  return { start, end };
}

export async function ensureCurrentGroupWeek(groupId: string, now = new Date()) {
  const { start, end } = getWeekRange(now);
  const existing = await prisma.groupWeek.findFirst({
    where: { groupId, weekStart: start },
    include: { winner: { include: { student: { select: { displayName: true, listNumber: true, controlNumber: true } } } } },
  });
  if (existing) return existing;

  return await prisma.groupWeek.create({
    data: { groupId, weekStart: start, weekEnd: end },
    include: { winner: { include: { student: { select: { displayName: true, listNumber: true, controlNumber: true } } } } },
  });
}

export async function closeWeekForGroup(groupId: string, now = new Date()) {
  const week = await ensureCurrentGroupWeek(groupId, now);
  if (week.closedAt) return week;

  const { ranking } = await getGroupRanking(groupId);
  const winner = ranking[0] ?? null;

  const closed = await prisma.groupWeek.update({
    where: { id: week.id },
    data: { closedAt: new Date() },
    include: { winner: true },
  });

  if (winner) {
    await prisma.weeklyWinner.upsert({
      where: { weekId: closed.id },
      update: { studentId: winner.studentId, score: winner.score },
      create: { weekId: closed.id, studentId: winner.studentId, score: winner.score },
    });
  }

  return await prisma.groupWeek.findFirstOrThrow({
    where: { id: closed.id },
    include: { winner: { include: { student: { select: { displayName: true, listNumber: true, controlNumber: true } } } } },
  });
}

