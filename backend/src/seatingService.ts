import { prisma } from "./prisma.js";
import { formatClassDayIso, parseClassDayDate, todayClassDayDate } from "./classDayService.js";
import { getGroupRanking } from "./groupRanking.js";

export const SEATING_ROWS = 6;
export const SEATING_COLS = 6;
export const SEATING_CAPACITY = SEATING_ROWS * SEATING_COLS;

export type SeatingMode =
  | "random"
  | "alphabetical"
  | "alphabetical_snake"
  | "by_ranking"
  | "shuffle_rows"
  | "column_teams";

export type SeatingTheme = "column_colors" | "random_colors" | "row_colors" | "team_pairs";

export const SEATING_MODE_LABELS: Record<SeatingMode, string> = {
  random: "Al azar total",
  alphabetical: "Orden de lista (A→Z)",
  alphabetical_snake: "Lista en zigzag",
  by_ranking: "Por ranking (frente = más puntos)",
  shuffle_rows: "Mezcla por filas",
  column_teams: "Equipos por columna",
};

/** Seis colores saturados y bien separados (no pasteles que se confunden). Orden = columnas A→F. */
export const COLUMN_PALETTE = [
  { name: "Rojo", hex: "#e11d48" },
  { name: "Azul", hex: "#2563eb" },
  { name: "Amarillo", hex: "#ca8a04" },
  { name: "Verde", hex: "#15803d" },
  { name: "Morado", hex: "#6d28d9" },
  { name: "Naranja", hex: "#ea580c" },
] as const;

export const RANDOM_PALETTE = COLUMN_PALETTE.map((c) => c.hex);

const LEGACY_HEX: Record<string, string> = {
  "#f472b6": "#e11d48",
  "#db2777": "#e11d48",
  "#f87171": "#e11d48",
  "#22d3ee": "#2563eb",
  "#60a5fa": "#2563eb",
  "#38bdf8": "#2563eb",
  "#fbbf24": "#ca8a04",
  "#facc15": "#ca8a04",
  "#eab308": "#ca8a04",
  "#34d399": "#15803d",
  "#4ade80": "#15803d",
  "#22c55e": "#15803d",
  "#a78bfa": "#6d28d9",
  "#c084fc": "#6d28d9",
  "#7c3aed": "#6d28d9",
  "#fb923c": "#ea580c",
  "#f97316": "#ea580c",
};

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

function allSeatsRowMajor() {
  const seats: { row: number; col: number; seatNumber: number }[] = [];
  for (let row = 1; row <= SEATING_ROWS; row++) {
    for (let col = 1; col <= SEATING_COLS; col++) {
      seats.push({ row, col, seatNumber: (row - 1) * SEATING_COLS + col });
    }
  }
  return seats;
}

type SeatCell = { row: number; col: number; seatNumber: number };

/** Altura de cada columna: mismos alumnos por columna; sobrantes repartidos al inicio. */
export function columnHeightsForCount(studentCount: number): number[] {
  const count = Math.min(Math.max(0, studentCount), SEATING_CAPACITY);
  const base = Math.floor(count / SEATING_COLS);
  const remainder = count % SEATING_COLS;
  return Array.from({ length: SEATING_COLS }, (_, i) => {
    const h = i < remainder ? base + 1 : base;
    return Math.min(h, SEATING_ROWS);
  });
}

/** Llena columnas de frente a atrás; vacíos solo en el fondo de cada columna. */
function seatsColumnMajorCompact(heights: number[]): SeatCell[] {
  const seats: SeatCell[] = [];
  for (let col = 1; col <= SEATING_COLS; col++) {
    const h = heights[col - 1] ?? 0;
    for (let row = 1; row <= h; row++) {
      seats.push({ row, col, seatNumber: (row - 1) * SEATING_COLS + col });
    }
  }
  return seats;
}

/** Zigzag dentro de cada columna (frente→atrás o atrás→frente). */
function seatsColumnSnakeCompact(heights: number[]): SeatCell[] {
  const seats: SeatCell[] = [];
  for (let col = 1; col <= SEATING_COLS; col++) {
    const h = heights[col - 1] ?? 0;
    const rows =
      col % 2 === 1
        ? Array.from({ length: h }, (_, i) => i + 1)
        : Array.from({ length: h }, (_, i) => h - i);
    for (const row of rows) {
      seats.push({ row, col, seatNumber: (row - 1) * SEATING_COLS + col });
    }
  }
  return seats;
}

/** Por filas compactas: fila 1 completa, luego fila 2, etc.; vacíos al fondo. */
function seatsRowMajorCompact(heights: number[]): SeatCell[] {
  const seats: SeatCell[] = [];
  for (let row = 1; row <= SEATING_ROWS; row++) {
    for (let col = 1; col <= SEATING_COLS; col++) {
      if (row <= (heights[col - 1] ?? 0)) {
        seats.push({ row, col, seatNumber: (row - 1) * SEATING_COLS + col });
      }
    }
  }
  return seats;
}

function orderStudentsShuffleRows(students: StudentRow[], heights: number[]) {
  const result: StudentRow[] = [];
  let idx = 0;
  for (let row = 1; row <= SEATING_ROWS; row++) {
    const countInRow = heights.filter((h) => h >= row).length;
    if (countInRow === 0) break;
    const chunk = students.slice(idx, idx + countInRow);
    result.push(...shuffle(chunk));
    idx += countInRow;
  }
  return result;
}

function orderStudentsColumnTeams(students: StudentRow[], heights: number[]) {
  const shuffled = shuffle(students);
  const columns: StudentRow[][] = Array.from({ length: SEATING_COLS }, () => []);
  let idx = 0;
  for (let col = 0; col < SEATING_COLS; col++) {
    const take = heights[col] ?? 0;
    columns[col] = shuffle(shuffled.slice(idx, idx + take));
    idx += take;
  }
  return columns.flat();
}

function colorForSeat(theme: SeatingTheme, row: number, col: number, studentIndex: number): string {
  if (theme === "random_colors") {
    return RANDOM_PALETTE[studentIndex % RANDOM_PALETTE.length] ?? RANDOM_PALETTE[0]!;
  }
  return paletteSwatchForSeat(theme, row, col).hex;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return null;
  const n = Number.parseInt(raw, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function nearestPaletteHex(hex: string) {
  const rgb = parseHexRgb(hex);
  if (!rgb) return COLUMN_PALETTE[0].hex as string;
  let best: string = COLUMN_PALETTE[0].hex;
  let bestDist = Infinity;
  for (const swatch of COLUMN_PALETTE) {
    const other = parseHexRgb(swatch.hex);
    if (!other) continue;
    const dist =
      (rgb[0] - other[0]) ** 2 + (rgb[1] - other[1]) ** 2 + (rgb[2] - other[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = swatch.hex;
    }
  }
  return best;
}

export function normalizeSeatHex(hex: string | null | undefined) {
  const raw = (hex ?? "").trim().toLowerCase();
  if (!raw) return COLUMN_PALETTE[0].hex;
  if (LEGACY_HEX[raw]) return LEGACY_HEX[raw];
  if (COLUMN_PALETTE.some((c) => c.hex.toLowerCase() === raw)) return raw;
  return nearestPaletteHex(raw);
}

export function colorNameForHex(hex: string) {
  const canonical = normalizeSeatHex(hex);
  return COLUMN_PALETTE.find((c) => c.hex.toLowerCase() === canonical)?.name ?? "Equipo";
}

export function paletteSwatchForSeat(theme: SeatingTheme, row: number, col: number) {
  if (theme === "row_colors") return COLUMN_PALETTE[Math.max(0, row - 1)] ?? COLUMN_PALETTE[0];
  if (theme === "team_pairs") {
    const teamIndex = Math.floor(Math.max(0, col - 1) / 2);
    return COLUMN_PALETTE[teamIndex] ?? COLUMN_PALETTE[0];
  }
  return COLUMN_PALETTE[Math.max(0, col - 1)] ?? COLUMN_PALETTE[0];
}

/** Color visible: por columna/fila/pareja usa la paleta nueva; en sorpresa acerca el hex guardado. */
export function resolveSeatSwatch(
  theme: SeatingTheme,
  row: number,
  col: number,
  storedHex?: string | null,
) {
  if (theme === "random_colors") {
    const hex = normalizeSeatHex(storedHex);
    return { name: colorNameForHex(hex), hex };
  }
  const swatch = paletteSwatchForSeat(theme, row, col);
  return { name: swatch.name, hex: swatch.hex };
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

async function orderStudentsByMode(students: StudentRow[], mode: SeatingMode, groupId: string) {
  switch (mode) {
    case "alphabetical":
      return students;
    case "alphabetical_snake":
      return students;
    case "by_ranking": {
      const { ranking } = await getGroupRanking(groupId);
      const scoreById = new Map(ranking.map((r) => [r.studentId, r.score]));
      const placeById = new Map(ranking.map((r) => [r.studentId, r.place]));
      return [...students].sort(
        (a, b) =>
          (placeById.get(a.id) ?? 999) - (placeById.get(b.id) ?? 999) ||
          (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0) ||
          a.displayName.localeCompare(b.displayName, "es"),
      );
    }
    case "shuffle_rows":
      return students;
    case "column_teams":
      return students;
    case "random":
    default:
      return shuffle(students);
  }
}

function orderSeatsByMode(mode: SeatingMode, heights: number[]) {
  switch (mode) {
    case "alphabetical":
    case "column_teams":
    case "random":
      return seatsColumnMajorCompact(heights);
    case "alphabetical_snake":
      return seatsColumnSnakeCompact(heights);
    case "by_ranking":
    case "shuffle_rows":
      return seatsRowMajorCompact(heights);
    default:
      return shuffle(seatsColumnMajorCompact(heights));
  }
}

async function buildAssignments(
  students: StudentRow[],
  mode: SeatingMode,
  theme: SeatingTheme,
  groupId: string,
) {
  const count = Math.min(students.length, SEATING_CAPACITY);
  const heights = columnHeightsForCount(count);
  let orderedStudents = (await orderStudentsByMode(students, mode, groupId)).slice(0, count);

  if (mode === "shuffle_rows") {
    orderedStudents = orderStudentsShuffleRows(orderedStudents, heights);
  } else if (mode === "column_teams") {
    orderedStudents = orderStudentsColumnTeams(orderedStudents, heights);
  } else if (mode === "random") {
    orderedStudents = shuffle(orderedStudents);
  }

  let seatOrder = orderSeatsByMode(mode, heights);
  if (mode === "random") {
    seatOrder = shuffle(seatOrder);
  }

  return orderedStudents.map((student, index) => {
    const seat = seatOrder[index]!;
    return {
      studentId: student.id,
      student,
      row: seat.row,
      col: seat.col,
      color: colorForSeat(theme, seat.row, seat.col, index),
    };
  });
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
  return allSeatsRowMajor().map((seat) => {
    const assigned = byKey.get(`${seat.row}:${seat.col}`);
    const swatch = assigned
      ? resolveSeatSwatch(theme, seat.row, seat.col, assigned.color)
      : null;
    return {
      ...seat,
      empty: !assigned,
      color: swatch?.hex ?? null,
      colorName: swatch?.name ?? null,
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
}

const sessionInclude = {
  assignments: {
    include: {
      student: {
        select: { id: true, displayName: true, listNumber: true, controlNumber: true },
      },
    },
  },
} as const;

async function findSeatingSession(groupId: string, dateIso: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT \`id\`
    FROM \`SeatingSession\`
    WHERE \`groupId\` = ${groupId} AND DATE(\`date\`) = DATE(${dateIso})
    ORDER BY \`createdAt\` DESC
    LIMIT 1
  `;
  const id = rows[0]?.id;
  if (!id) return null;
  return prisma.seatingSession.findUnique({
    where: { id },
    include: sessionInclude,
  });
}

/** Última sesión de butacas del grupo (cualquiera fecha), para vista del alumno. */
async function findLatestSeatingSession(groupId: string) {
  return prisma.seatingSession.findFirst({
    where: { groupId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: sessionInclude,
  });
}

type SeatingTx = Pick<typeof prisma, "seatingSession" | "seatingAssignment" | "$executeRaw">;

function isSeatingUniqueConstraint(err: unknown) {
  return (
    err &&
    typeof err === "object" &&
    "code" in err &&
    String((err as { code: unknown }).code) === "P2002"
  );
}

async function deleteSeatingSessionsForDay(tx: SeatingTx, groupId: string, dateIso: string) {
  const date = parseClassDayDate(dateIso);
  if (!date) return;

  await tx.$executeRaw`
    DELETE sa FROM \`SeatingAssignment\` sa
    INNER JOIN \`SeatingSession\` ss ON sa.\`sessionId\` = ss.\`id\`
    WHERE ss.\`groupId\` = ${groupId} AND DATE(ss.\`date\`) = DATE(${dateIso})
  `;
  await tx.$executeRaw`
    DELETE FROM \`SeatingSession\`
    WHERE \`groupId\` = ${groupId} AND DATE(\`date\`) = DATE(${dateIso})
  `;
  await tx.seatingAssignment.deleteMany({
    where: { session: { groupId, date } },
  });
  await tx.seatingSession.deleteMany({ where: { groupId, date } });
}

async function replaceSeatingSession(
  tx: SeatingTx,
  data: {
    groupId: string;
    dateIso: string;
    mode: SeatingMode;
    theme: SeatingTheme;
    createdById: string;
  },
) {
  const date = parseClassDayDate(data.dateIso);
  if (!date) throw new Error("invalid_date");

  await deleteSeatingSessionsForDay(tx, data.groupId, data.dateIso);

  const createData = {
    groupId: data.groupId,
    date,
    mode: data.mode,
    theme: data.theme,
    createdById: data.createdById,
  };

  try {
    return await tx.seatingSession.create({ data: createData });
  } catch (err) {
    if (!isSeatingUniqueConstraint(err)) throw err;
    await deleteSeatingSessionsForDay(tx, data.groupId, data.dateIso);
    return await tx.seatingSession.create({ data: createData });
  }
}

export async function dedupeSeatingSessions() {
  const sessions = await prisma.seatingSession.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, groupId: true, date: true },
  });

  const byKey = new Map<string, string[]>();
  for (const session of sessions) {
    const key = `${session.groupId}:${formatClassDayIso(session.date)}`;
    const ids = byKey.get(key) ?? [];
    ids.push(session.id);
    byKey.set(key, ids);
  }

  for (const ids of byKey.values()) {
    // Conservar la sesión más reciente (última del arreglo ordenado por createdAt ASC).
    const removeIds = ids.slice(0, -1);
    if (!removeIds.length) continue;
    await prisma.seatingAssignment.deleteMany({ where: { sessionId: { in: removeIds } } });
    await prisma.seatingSession.deleteMany({ where: { id: { in: removeIds } } });
    console.log(`[startup] Removed ${removeIds.length} duplicate seating session(s).`);
  }
}

/** Fechas con acomodo guardado, más reciente primero. */
async function listSeatingDates(groupId: string) {
  const rows = await prisma.seatingSession.findMany({
    where: { groupId },
    select: { date: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const dates: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const iso = formatClassDayIso(row.date);
    if (seen.has(iso)) continue;
    seen.add(iso);
    dates.push(iso);
  }
  return dates;
}

export async function getSeatingPlan(teacherId: string, groupId: string, date: Date) {
  const loaded = await loadGroupStudents(groupId, teacherId);
  if (!loaded) return null;

  const dateIso = formatClassDayIso(date);
  let session = await findSeatingSession(groupId, dateIso);
  if (!session) {
    session = await findLatestSeatingSession(groupId);
  }

  const studentIndex = new Map(loaded.students.map((s, i) => [s.id, i]));
  const assignedDate = session ? formatClassDayIso(session.date) : null;
  const isCarriedOver = Boolean(session && assignedDate && assignedDate !== dateIso);
  const mode = (session?.mode as SeatingMode) ?? "random";
  const theme = (session?.theme as SeatingTheme) ?? "column_colors";
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
  const seatedIds = new Set(assignments.map((a) => a.student.id));
  const unseatedStudents = loaded.students
    .map((s, i) => ({ id: s.id, displayName: s.displayName, listPosition: i + 1 }))
    .filter((s) => !seatedIds.has(s.id));

  return {
    group: loaded.group,
    date: dateIso,
    assignedDate,
    isCarriedOver,
    history: await listSeatingDates(groupId),
    rows: SEATING_ROWS,
    cols: SEATING_COLS,
    capacity: SEATING_CAPACITY,
    mode,
    modeLabel: SEATING_MODE_LABELS[mode] ?? mode,
    theme,
    assignedCount: assignments.length,
    studentCount: loaded.students.length,
    unseatedCount: unseatedStudents.length,
    unseatedStudents,
    overflow: loaded.students.length > SEATING_CAPACITY,
    grid: buildGrid(theme, assignments),
    updatedAt: session?.createdAt?.toISOString() ?? null,
  };
}

export async function shuffleSeatingPlan(
  teacherId: string,
  groupId: string,
  date: Date,
  options: { theme?: SeatingTheme; mode?: SeatingMode } = {},
) {
  const loaded = await loadGroupStudents(groupId, teacherId);
  if (!loaded) throw new Error("group_not_found");

  const theme = options.theme ?? "column_colors";
  const mode = options.mode ?? "random";
  const pairs = await buildAssignments(loaded.students, mode, theme, groupId);
  const dateIso = formatClassDayIso(date);

  await prisma.$transaction(async (tx) => {
    const session = await replaceSeatingSession(tx, {
      groupId,
      dateIso,
      mode,
      theme,
      createdById: teacherId,
    });

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
  const dateIso = formatClassDayIso(date);
  let session = await findSeatingSession(groupId, dateIso);

  // Si hoy no hay (p. ej. desfase UTC vs México), usar la última asignación del grupo.
  if (!session) {
    session = await findLatestSeatingSession(groupId);
  }

  if (!session) return null;

  const assignment = session.assignments.find((a) => a.studentId === studentId);
  if (!assignment) return null;

  const seat = formatSeatLabel(assignment.row, assignment.col);
  const theme = session.theme as SeatingTheme;
  const swatch = resolveSeatSwatch(theme, assignment.row, assignment.col, assignment.color);
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
    select: { id: true },
  });
  const listPosition = students.findIndex((s) => s.id === studentId) + 1;

  return {
    date: formatClassDayIso(session.date),
    theme,
    seatNumber: seat.seatNumber,
    row: seat.row,
    col: seat.col,
    label: seat.label,
    color: swatch.hex,
    colorName: swatch.name,
    columnColorName: COLUMN_PALETTE[assignment.col - 1]?.name ?? swatch.name,
    listPosition: listPosition > 0 ? listPosition : null,
    listNumber: assignment.student.listNumber,
    displayName: assignment.student.displayName,
  };
}

export function resolveSeatingDate(input?: string | null) {
  if (!input?.trim()) return todayClassDayDate();
  return parseClassDayDate(input.trim());
}
