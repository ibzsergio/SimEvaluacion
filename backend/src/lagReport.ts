import PDFDocument from "pdfkit";
import { prisma } from "./prisma.js";
import { formatClassDayIso, todayClassDayDate } from "./classDayService.js";
import { listTeacherGroups } from "./groups.js";

export type LagLevel = "al_dia" | "seguimiento" | "atrasado";

export type LagActivity = {
  id: string;
  name: string;
  date: string;
  dateLabel: string;
  maxPoints: number;
  due: boolean;
  ungradedStudents: number;
};

export type LagPartialInventory = {
  partialNumber: number;
  label: string;
  published: number;
  due: number;
  upcoming: number;
  isCurrent: boolean;
};

export type LagStudent = {
  id: string;
  displayName: string;
  listNumber: number | null;
  controlNumber: string | null;
  graded: number;
  missing: number;
  due: number;
  level: Exclude<LagLevel, "al_dia">;
  levelLabel: string;
  missingActivities: Array<{ id: string; name: string; dateLabel: string }>;
};

export type LagReport = {
  generatedAt: string;
  reportDate: string;
  reportDateLabel: string;
  isFriday: boolean;
  weekFriday: string;
  weekFridayLabel: string;
  group: {
    id: string;
    code: string;
    shift: string;
    currentPartial: number;
    partialNumber: number;
    partialLabel: string;
  };
  partialInventory: LagPartialInventory[];
  activities: LagActivity[];
  counts: {
    published: number;
    due: number;
    upcoming: number;
    students: number;
    onTrack: number;
    watch: number;
    behind: number;
  };
  onTrackNames: string[];
  behind: LagStudent[];
};

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 32;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function partialLabel(n: number) {
  if (n === 1) return "Primer parcial";
  if (n === 2) return "Segundo parcial";
  if (n === 3) return "Tercer parcial";
  if (n === 4) return "Cuarto parcial";
  return `Parcial ${n}`;
}

export function lagLevel(missing: number, due: number): LagLevel {
  if (missing <= 0 || due <= 0) return "al_dia";
  if (missing === 1 && due > 1) return "seguimiento";
  return "atrasado";
}

export function lagLevelLabel(level: LagLevel) {
  if (level === "al_dia") return "Al día";
  if (level === "seguimiento") return "Falta 1";
  return "Atrasado";
}

function formatLongEs(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatShortEs(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

function addDaysIso(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days, 12));
  return formatClassDayIso(date);
}

/** Viernes de la semana escolar (lun–vie). Sábado y domingo usan el viernes anterior. */
export function schoolWeekFriday(todayIso: string) {
  const [y, m, d] = todayIso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay();
  if (weekday === 5) return todayIso;
  if (weekday === 6) return addDaysIso(todayIso, -1);
  if (weekday === 0) return addDaysIso(todayIso, -2);
  return addDaysIso(todayIso, 5 - weekday);
}

function shiftLabel(shift: string) {
  const text = shift.trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function getLagReport(
  teacherId: string,
  groupId: string,
  requestedPartial?: number,
): Promise<LagReport> {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true, code: true, shift: true, currentPartial: true },
  });
  if (!group) throw new Error("group_not_found");

  const currentPartial = group.currentPartial ?? 1;
  const partialNumber =
    requestedPartial != null && requestedPartial >= 1 && requestedPartial <= 6
      ? requestedPartial
      : currentPartial;

  const today = todayClassDayDate();
  const reportDate = formatClassDayIso(today);
  const weekFriday = schoolWeekFriday(reportDate);

  const [students, activities] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", groupId },
      orderBy: [{ listNumber: "asc" }, { displayName: "asc" }],
      select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    }),
    prisma.activity.findMany({
      where: { groupId },
      orderBy: [{ partialNumber: "asc" }, { sortOrder: "asc" }, { date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        date: true,
        maxPoints: true,
        partialNumber: true,
      },
    }),
  ]);

  const inventoryMap = new Map<number, LagPartialInventory>();
  const ensureInventory = (n: number) => {
    const existing = inventoryMap.get(n);
    if (existing) return existing;
    const row: LagPartialInventory = {
      partialNumber: n,
      label: partialLabel(n),
      published: 0,
      due: 0,
      upcoming: 0,
      isCurrent: n === currentPartial,
    };
    inventoryMap.set(n, row);
    return row;
  };
  ensureInventory(1);
  ensureInventory(2);
  ensureInventory(currentPartial);
  ensureInventory(partialNumber);

  for (const activity of activities) {
    const n = activity.partialNumber ?? 1;
    const row = ensureInventory(n);
    const dateIso = formatClassDayIso(activity.date);
    row.published += 1;
    if (dateIso <= reportDate) row.due += 1;
    else row.upcoming += 1;
  }

  const focus = activities.filter((a) => (a.partialNumber ?? 1) === partialNumber);
  const focusIds = focus.map((a) => a.id);
  const grades =
    focusIds.length === 0
      ? []
      : await prisma.grade.findMany({
          where: { activityId: { in: focusIds } },
          select: { activityId: true, studentId: true },
        });
  const gradedKeys = new Set(grades.map((g) => `${g.studentId}:${g.activityId}`));

  const activityMeta = focus.map((activity) => {
    const date = formatClassDayIso(activity.date);
    const due = date <= reportDate;
    const ungradedStudents = due
      ? students.filter((student) => !gradedKeys.has(`${student.id}:${activity.id}`)).length
      : 0;
    return {
      id: activity.id,
      name: activity.name,
      date,
      dateLabel: formatShortEs(date),
      maxPoints: activity.maxPoints,
      due,
      ungradedStudents,
    } satisfies LagActivity;
  });

  const dueActivities = activityMeta.filter((a) => a.due);
  const behind: LagStudent[] = [];
  const onTrackNames: string[] = [];

  for (const student of students) {
    const missingActivities = dueActivities.filter(
      (activity) => !gradedKeys.has(`${student.id}:${activity.id}`),
    );
    const missing = missingActivities.length;
    const level = lagLevel(missing, dueActivities.length);
    if (level === "al_dia") {
      onTrackNames.push(student.displayName);
      continue;
    }
    behind.push({
      id: student.id,
      displayName: student.displayName,
      listNumber: student.listNumber,
      controlNumber: student.controlNumber,
      graded: dueActivities.length - missing,
      missing,
      due: dueActivities.length,
      level,
      levelLabel: lagLevelLabel(level),
      missingActivities: missingActivities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        dateLabel: activity.dateLabel,
      })),
    });
  }

  behind.sort((a, b) => {
    if (b.missing !== a.missing) return b.missing - a.missing;
    const listA = a.listNumber ?? 9999;
    const listB = b.listNumber ?? 9999;
    if (listA !== listB) return listA - listB;
    return a.displayName.localeCompare(b.displayName, "es");
  });

  const partialInventory = [...inventoryMap.values()].sort(
    (a, b) => a.partialNumber - b.partialNumber,
  );

  return {
    generatedAt: new Date().toISOString(),
    reportDate,
    reportDateLabel: formatLongEs(reportDate),
    isFriday: today.getUTCDay() === 5,
    weekFriday,
    weekFridayLabel: formatLongEs(weekFriday),
    group: {
      id: group.id,
      code: group.code,
      shift: group.shift,
      currentPartial,
      partialNumber,
      partialLabel: partialLabel(partialNumber),
    },
    partialInventory,
    activities: activityMeta,
    counts: {
      published: activityMeta.length,
      due: dueActivities.length,
      upcoming: activityMeta.length - dueActivities.length,
      students: students.length,
      onTrack: onTrackNames.length,
      watch: behind.filter((row) => row.level === "seguimiento").length,
      behind: behind.filter((row) => row.level === "atrasado").length,
    },
    onTrackNames,
    behind,
  };
}

export async function getTeacherLagReports(teacherId: string) {
  const groups = await listTeacherGroups(teacherId);
  const reports: LagReport[] = [];
  for (const group of groups) {
    reports.push(await getLagReport(teacherId, group.id));
  }
  return reports;
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function fillRect(doc: PdfDoc, x: number, y: number, w: number, h: number, color: string) {
  doc.save();
  doc.rect(x, y, w, h).fill(color);
  doc.restore();
}

function textAt(
  doc: PdfDoc,
  value: string,
  x: number,
  y: number,
  width: number,
  options: {
    font?: string;
    size?: number;
    color?: string;
    align?: "left" | "center" | "right";
    height?: number;
    ellipsis?: boolean;
  } = {},
) {
  doc
    .font(options.font ?? "Helvetica")
    .fontSize(options.size ?? 9)
    .fillColor(options.color ?? "#0f172a")
    .text(value, x, y, {
      width,
      height: options.height,
      ellipsis: options.ellipsis,
      align: options.align ?? "left",
      lineGap: 1,
    });
}

function drawFooter(doc: PdfDoc, pageIndex: number, pageCount: number) {
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  textAt(
    doc,
    `CECYTEM  ·  Programación  ·  SimEvaluación  ·  Página ${pageIndex} de ${pageCount}  ·  Seguimiento semanal, no sustituye la calificación oficial`,
    MARGIN,
    PAGE_H - 20,
    CONTENT_W,
    { size: 7.5, color: "#64748b", align: "center", height: 12, ellipsis: true },
  );
  doc.page.margins.bottom = bottom;
}

function drawBanner(doc: PdfDoc, report: LagReport, continued: boolean) {
  fillRect(doc, 0, 0, PAGE_W, 78, "#0b1f3a");
  fillRect(doc, 0, 78, PAGE_W, 4, "#0f766e");
  textAt(doc, "CECYTEM  ·  PROGRAMACIÓN", MARGIN, 14, CONTENT_W, {
    font: "Helvetica-Bold",
    size: 9,
    color: "#99f6e4",
  });
  textAt(
    doc,
    continued ? "REPORTE SEMANAL DE AVANCE  ·  continuación" : "REPORTE SEMANAL DE AVANCE",
    MARGIN,
    28,
    CONTENT_W,
    { font: "Helvetica-Bold", size: 16, color: "#ffffff" },
  );
  const shift = shiftLabel(report.group.shift);
  textAt(
    doc,
    `Grupo ${report.group.code}${shift ? ` · Turno ${shift}` : ""} · ${report.group.partialLabel}`,
    MARGIN,
    50,
    CONTENT_W - 220,
    { size: 10, color: "#e2e8f0" },
  );
  textAt(doc, report.reportDateLabel, MARGIN + CONTENT_W - 220, 50, 220, {
    size: 10,
    color: "#e2e8f0",
    align: "right",
  });
  doc.y = 96;
}

function howToRead(report: LagReport) {
  const fridayNote = report.isFriday
    ? "Este corte corresponde al viernes de entrega."
    : `La semana escolar cierra el ${report.weekFridayLabel}.`;
  return `Cómo leerlo. Una actividad del ${report.group.partialLabel.toLowerCase()} es exigible cuando su fecha es hoy o anterior. El alumno está al día solo si esa actividad ya tiene calificación. Ámbar (Falta 1): le falta una y ya tiene otras calificadas. Rojo (Atrasado): no tiene calificación en la actividad exigible, o le faltan 2 o más. Las actividades con fecha futura no cuentan. ${fridayNote}`;
}

function drawHowTo(doc: PdfDoc, report: LagReport) {
  const y = doc.y;
  const text = howToRead(report);
  doc.font("Helvetica").fontSize(8.5);
  const height = doc.heightOfString(text, { width: CONTENT_W - 20, lineGap: 1 }) + 14;
  fillRect(doc, MARGIN, y, CONTENT_W, height, "#f8fafc");
  doc.save();
  doc.rect(MARGIN, y, 3, height).fill("#0f766e");
  doc.restore();
  textAt(doc, text, MARGIN + 12, y + 7, CONTENT_W - 22, { size: 8.5, color: "#334155" });
  doc.y = y + height + 12;
}

function drawKpis(doc: PdfDoc, report: LagReport) {
  const items = [
    {
      value: String(report.counts.published),
      label: "Actividades del parcial",
      hint: `${report.counts.due} exigibles · ${report.counts.upcoming} próximas`,
      color: "#0f172a",
    },
    {
      value: String(report.counts.onTrack),
      label: "Alumnos al día",
      hint: `de ${report.counts.students} en el grupo`,
      color: "#047857",
    },
    {
      value: String(report.counts.watch),
      label: "Seguimiento",
      hint: "falta 1 actividad",
      color: "#b45309",
    },
    {
      value: String(report.counts.behind),
      label: "Atrasados",
      hint: "sin calificación, o 2 o más",
      color: "#b91c1c",
    },
  ];
  const y = doc.y;
  const gap = 8;
  const width = (CONTENT_W - gap * (items.length - 1)) / items.length;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const x = MARGIN + i * (width + gap);
    doc.save();
    doc.roundedRect(x, y, width, 52, 6).fillAndStroke("#ffffff", "#e2e8f0");
    doc.restore();
    textAt(doc, item.value, x + 10, y + 6, width - 20, {
      font: "Helvetica-Bold",
      size: 16,
      color: item.color,
    });
    textAt(doc, item.label, x + 10, y + 26, width - 20, {
      font: "Helvetica-Bold",
      size: 8,
      color: "#0f172a",
    });
    textAt(doc, item.hint, x + 10, y + 37, width - 20, { size: 7.5, color: "#64748b" });
  }
  doc.y = y + 64;
}

function drawSectionTitle(doc: PdfDoc, title: string) {
  textAt(doc, title, MARGIN, doc.y, CONTENT_W, {
    font: "Helvetica-Bold",
    size: 11,
    color: "#0b1f3a",
  });
  doc.y += 16;
}

const ACTIVITY_COLS = [
  { title: "#", width: 28 },
  { title: "Actividad", width: 279 },
  { title: "Fecha", width: 90 },
  { title: "¿Exigible?", width: 80 },
  { title: "Alumnos sin calificación", width: 300 },
] as const;

function drawActivityTable(doc: PdfDoc, report: LagReport, onPageBreak: () => void) {
  drawSectionTitle(doc, `Actividades de ${report.group.partialLabel.toLowerCase()}`);
  if (!report.activities.length) {
    textAt(
      doc,
      `No hay actividades publicadas en ${report.group.partialLabel.toLowerCase()}. Por eso ningún alumno puede marcarse como atrasado en este parcial.`,
      MARGIN,
      doc.y,
      CONTENT_W,
      { size: 9, color: "#334155" },
    );
    doc.y += 28;
    return;
  }

  const drawHeader = () => {
    const y = doc.y;
    fillRect(doc, MARGIN, y, CONTENT_W, 18, "#0b1f3a");
    let x = MARGIN;
    for (const col of ACTIVITY_COLS) {
      textAt(doc, col.title, x + 4, y + 4, col.width - 8, {
        font: "Helvetica-Bold",
        size: 7.5,
        color: "#ffffff",
      });
      x += col.width;
    }
    doc.y = y + 18;
  };

  const ensure = (needed: number) => {
    if (doc.y + needed <= PAGE_H - 36) return;
    doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
    onPageBreak();
    drawHeader();
  };

  drawHeader();
  report.activities.forEach((activity, index) => {
    ensure(20);
    const y = doc.y;
    fillRect(doc, MARGIN, y, CONTENT_W, 18, index % 2 === 0 ? "#f8fafc" : "#ffffff");
    const cells = [
      String(index + 1),
      activity.name,
      activity.dateLabel,
      activity.due ? "Sí" : "No, aún no",
      activity.due ? `${activity.ungradedStudents} de ${report.counts.students}` : "No se exige todavía",
    ];
    let x = MARGIN;
    cells.forEach((cell, cellIndex) => {
      const col = ACTIVITY_COLS[cellIndex]!;
      const color =
        cellIndex === 3 ? (activity.due ? "#047857" : "#64748b") : "#0f172a";
      textAt(doc, cell, x + 4, y + 4, col.width - 8, {
        size: 8,
        color,
        height: 11,
        ellipsis: true,
        font: cellIndex === 3 && activity.due ? "Helvetica-Bold" : "Helvetica",
      });
      x += col.width;
    });
    doc.y = y + 18;
  });
  doc.y += 12;
}

const STUDENT_COLS = [
  { title: "No.", width: 36 },
  { title: "Alumno", width: 168 },
  { title: "Control", width: 78 },
  { title: "Situación", width: 88 },
  { title: "Avance", width: 62 },
  { title: "Faltan", width: 48 },
  { title: "Actividades sin calificación", width: 297 },
] as const;

function drawStudentTable(doc: PdfDoc, report: LagReport, onPageBreak: () => void) {
  const title =
    report.behind.length === 1
      ? "1 alumno por atender"
      : `${report.behind.length} alumnos por atender`;
  drawSectionTitle(doc, title);

  if (!report.behind.length) {
    const y = doc.y;
    fillRect(doc, MARGIN, y, CONTENT_W, 36, "#ecfdf5");
    textAt(
      doc,
      report.counts.due === 0
        ? "Todavía no hay actividades exigibles. Nadie se marca como atrasado."
        : "Ningún alumno está atrasado. Todos tienen calificación en las actividades exigibles.",
      MARGIN + 12,
      y + 12,
      CONTENT_W - 24,
      { font: "Helvetica-Bold", size: 10, color: "#047857" },
    );
    doc.y = y + 48;
    return;
  }

  const drawHeader = () => {
    const y = doc.y;
    fillRect(doc, MARGIN, y, CONTENT_W, 18, "#0b1f3a");
    let x = MARGIN;
    for (const col of STUDENT_COLS) {
      textAt(doc, col.title, x + 4, y + 4, col.width - 8, {
        font: "Helvetica-Bold",
        size: 7.5,
        color: "#ffffff",
      });
      x += col.width;
    }
    doc.y = y + 18;
  };

  drawHeader();
  for (const student of report.behind) {
    const missingText = student.missingActivities
      .map((activity) => activity.name)
      .join("  ·  ");
    doc.font("Helvetica").fontSize(8);
    const textHeight = doc.heightOfString(missingText || "—", {
      width: STUDENT_COLS[6]!.width - 8,
      lineGap: 1,
    });
    const rowH = Math.max(20, textHeight + 8);
    if (doc.y + rowH > PAGE_H - 36) {
      doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
      onPageBreak();
      drawHeader();
    }
    const y = doc.y;
    const bg = student.level === "atrasado" ? "#fef2f2" : "#fffbeb";
    fillRect(doc, MARGIN, y, CONTENT_W, rowH, bg);
    const situationColor = student.level === "atrasado" ? "#b91c1c" : "#b45309";
    const cells = [
      student.listNumber != null ? String(student.listNumber) : "—",
      student.displayName,
      student.controlNumber ?? "—",
      student.levelLabel,
      `${student.graded} de ${student.due}`,
      String(student.missing),
      missingText,
    ];
    let x = MARGIN;
    cells.forEach((cell, cellIndex) => {
      const col = STUDENT_COLS[cellIndex]!;
      textAt(doc, cell, x + 4, y + 4, col.width - 8, {
        size: 8,
        color: cellIndex === 3 || cellIndex === 5 ? situationColor : "#0f172a",
        font: cellIndex === 1 || cellIndex === 3 || cellIndex === 5 ? "Helvetica-Bold" : "Helvetica",
        height: cellIndex === 6 ? undefined : rowH - 6,
        ellipsis: cellIndex !== 6,
      });
      x += col.width;
    });
    doc.y = y + rowH;
  }
  doc.y += 12;
}

function drawOnTrack(doc: PdfDoc, report: LagReport) {
  if (!report.counts.students) return;
  const names =
    report.onTrackNames.length > 0
      ? report.onTrackNames.join(", ")
      : "Ninguno con el corte de hoy.";
  doc.font("Helvetica").fontSize(8);
  const body = `Al día (${report.counts.onTrack}): ${names}`;
  const height = doc.heightOfString(body, { width: CONTENT_W, lineGap: 1 });
  if (doc.y + height > PAGE_H - 36) {
    doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
    drawBanner(doc, report, true);
  }
  textAt(doc, body, MARGIN, doc.y, CONTENT_W, { size: 8, color: "#334155" });
  doc.y += height + 8;
}

function renderGroup(doc: PdfDoc, report: LagReport) {
  const continueHeader = () => drawBanner(doc, report, true);
  drawBanner(doc, report, false);
  drawHowTo(doc, report);
  drawKpis(doc, report);
  const inventory = report.partialInventory
    .map(
      (row) =>
        `${row.label}${row.isCurrent ? " (vigente)" : ""}: ${row.published} actividad${row.published === 1 ? "" : "es"}`,
    )
    .join("   ·   ");
  textAt(doc, `Inventario por parcial. ${inventory}.`, MARGIN, doc.y, CONTENT_W, {
    size: 8,
    color: "#475569",
  });
  doc.y += 18;
  drawActivityTable(doc, report, continueHeader);
  drawStudentTable(doc, report, continueHeader);
  drawOnTrack(doc, report);
}

export function renderFridayLagPdf(doc: PdfDoc, reports: LagReport[]) {
  doc.info.Title = "Reporte semanal de avance";
  doc.info.Author = "SimEvaluación";
  if (!reports.length) {
    textAt(doc, "No hay grupos para generar el reporte.", MARGIN, MARGIN, CONTENT_W, {
      size: 12,
    });
    return;
  }
  reports.forEach((report, index) => {
    if (index > 0) doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
    renderGroup(doc, report);
  });
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i - range.start + 1, range.count);
  }
}

export function createFridayLagPdf(reports: LagReport[]) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: MARGIN,
    bufferPages: true,
  });
  renderFridayLagPdf(doc, reports);
  return doc;
}
