import { prisma } from "./prisma.js";
import { parseClassDayDate, todayClassDayDate } from "./classDayService.js";

export const SEATING_ROWS = 6;
export const SEATING_COLS = 6;
export const SEATING_CAPACITY = SEATING_ROWS * SEATING_COLS;

export type SeatingTheme = "column_colors" | "random_colors";

export const COLUMN_PALETTE = [
  { name: "Rosa", hex: "#f472b6" },
  { name: "Cian", hex: "#22d3ee" },
  { name: "Ámbar", hex: "#fbbf24" },
  { name: "Verde", hex: "#34d399" },
  { name: "Violeta", hex: "#a78bfa" },
  { name: "Naranja", hex: "#fb923c" },
] as const;

export const RANDOM_PALETTE = [
  "#f472b6",
  "#22d3ee",
  "#fbbf24",
  "#34d399",
  "#a78bfa",
  "#fb923c",
  "#f87171",
  "#60a5fa",
  "#c084fc",
  "#4ade80",
] as const;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function allSeats() {
  const seats: { row: number; col: number; seatNumber: number }[] = [];
  for (let row = 1; row <= SEATING_ROWS; row++) {
    for (let col = 1; col <= SEATING_COLS; col++) {
      seats.push({ row, col, seatNumber: (row - 1) * SEATING_COLS + col });
    }
  }
  return seats;
}

function colorForSeat(theme: SeatingTheme, row: number, col: number, studentIndex: number): string {
  if (theme === "random_colors") {
    return RANDOM_PALETTE[studentIndex % RANDOM_PALETTE.length] ?? RANDOM_PALETTE[0];
  }
  return COLUMN_PALETTE[col - 1]?.hex ?? COLUMN_PALETTE[0].hex;
}

function colorNameForHex(hex: string) {
  return COLUMN_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? "Color del día";
}

export function formatSeatLabel(row: number, col: number) {
  const seatNumber = (row - 1) * SEATING_COLS + col;
  return {
    seatNumber,
    row,
    col,
    label: `Fila ${row} · Columna ${col}`,
    shortLabel: `#${seatNumber}`,
  };
}

type StudentRow = {
  id: string;
  displayName: string;
  listNumber: number | null;
  controlNumber: string | null;
  listPosition: number;
};

async function loadGroupStudents(groupId: string, teacherId: string) {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) return null;

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
  });

  return {
    group,
    students: students.map((s, index) => ({
      ...s,
      listPosition: index + 1,
    })),
  };
}

function buildGrid(
  theme: SeatingTheme,
  assignments: Array<{
    row: number;
    col: number;
    color: string;
    student: StudentRow;
  }>,
) {
  const byKey = new Map(assignments.map((a) => [`${a.row}:${a.col}`, a]));
  const cells = allSeats().map((seat) => {
    const assigned = byKey.get(`${seat.row}:${seat.col}`);
    return {
      ...seat,
      empty: !assigned,
      color: assigned?.color ?? null,
      colorName: assigned ? colorNameForHex(assigned.color) : null,
      student: assigned
        ? {
            id: assigned.student.id,
            displayName: assigned.student.displayName,
            listNumber: assigned.student.listNumber,
            listPosition: assigned.student.listPosition,
            controlNumber: assigned.student.controlNumber,
          }
        : null,
    };
  });
  return cells;
}

export async function getSeatingPlan(teacherId: string, groupId: string, date: Date) {
  const loaded = await loadGroupStudents(groupId, teacherId);
  if (!loaded) return null;

  const session = await prisma.seatingSession.findUnique({
    where: { groupId_date: { groupId, date } },
    include: {
      assignments: {
        include: {
          student: {
            select: { id: true, displayName: true, listNumber: true, controlNumber: true },
          },
        },
      },
    },
  });

  const studentIndex = new Map(loaded.students.map((s, i) => [s.id, i]));
  const assignments = session
    ? session.assignments.map((a) => ({
        row: a.row,
        col: a.col,
        color: a.color,
        student: {
          ...a.student,
          listPosition: studentIndex.get(a.student.id) ?? 0,
        },
      }))
    : [];

  return {
    group: loaded.group,
    date: date.toISOString().slice(0, 10),
    rows: SEATING_ROWS,
    cols: SEATING_COLS,
    capacity: SEATING_CAPACITY,
    theme: (session?.theme as SeatingTheme) ?? "column_colors",
    assignedCount: assignments.length,
    studentCount: loaded.students.length,
    unseatedCount: Math.max(0, loaded.students.length - assignments.length),
    overflow: loaded.students.length > SEATING_CAPACITY,
    grid: buildGrid((session?.theme as SeatingTheme) ?? "column_colors", assignments),
    updatedAt: session?.createdAt?.toISOString() ?? null,
  };
}

export async function shuffleSeatingPlan(
  teacherId: string,
  groupId: string,
  date: Date,
  theme: SeatingTheme = "column_colors",
) {
  const loaded = await loadGroupStudents(groupId, teacherId);
  if (!loaded) throw new Error("group_not_found");

  const shuffledStudents = shuffle(loaded.students);
  const shuffledSeats = shuffle(allSeats());
  const count = Math.min(shuffledStudents.length, SEATING_CAPACITY);

  const pairs = shuffledStudents.slice(0, count).map((student, index) => {
    const seat = shuffledSeats[index]!;
    return {
      studentId: student.id,
      row: seat.row,
      col: seat.col,
      color: colorForSeat(theme, seat.row, seat.col, index),
    };
  });

  await prisma.$transaction(async (tx) => {
    const session = await tx.seatingSession.upsert({
      where: { groupId_date: { groupId, date } },
      create: {
        groupId,
        date,
        theme,
        createdById: teacherId,
      },
      update: {
        theme,
        createdById: teacherId,
        createdAt: new Date(),
      },
    });

    await tx.seatingAssignment.deleteMany({ where: { sessionId: session.id } });
    if (pairs.length) {
      await tx.seatingAssignment.createMany({
        data: pairs.map((p) => ({
          sessionId: session.id,
          studentId: p.studentId,
          row: p.row,
          col: p.col,
          color: p.color,
        })),
      });
    }
  });

  return getSeatingPlan(teacherId, groupId, date);
}

export async function getStudentSeating(studentId: string, groupId: string, date: Date) {
  const session = await prisma.seatingSession.findUnique({
    where: { groupId_date: { groupId, date } },
    include: {
      assignments: {
        where: { studentId },
        include: {
          student: { select: { displayName: true, listNumber: true, controlNumber: true } },
        },
      },
    },
  });

  if (!session?.assignments.length) return null;

  const assignment = session.assignments[0]!;
  const seat = formatSeatLabel(assignment.row, assignment.col);
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
    select: { id: true },
  });
  const listPosition = students.findIndex((s) => s.id === studentId) + 1;

  return {
    date: session.date.toISOString().slice(0, 10),
    theme: session.theme as SeatingTheme,
    seatNumber: seat.seatNumber,
    row: seat.row,
    col: seat.col,
    label: seat.label,
    color: assignment.color,
    colorName: colorNameForHex(assignment.color),
    columnColorName: COLUMN_PALETTE[assignment.col - 1]?.name ?? colorNameForHex(assignment.color),
    listPosition: listPosition > 0 ? listPosition : null,
    listNumber: assignment.student.listNumber,
    displayName: assignment.student.displayName,
  };
}

export function resolveSeatingDate(input?: string | null) {
  if (!input?.trim()) return todayClassDayDate();
  return parseClassDayDate(input.trim());
}
