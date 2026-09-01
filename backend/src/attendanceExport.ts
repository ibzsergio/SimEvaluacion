import type { AttendanceStatus } from "@prisma/client";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { prisma } from "./prisma.js";
import { parseClassDayDate, todayClassDayDate } from "./classDayService.js";

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Falta",
  LATE: "Tarde",
  JUSTIFIED: "Justificada",
};

const ALERT_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "",
  ABSENT: "⚠ SIN ASISTIR",
  LATE: "⚠ TARDE",
  JUSTIFIED: "Justificada",
};

type StudentRow = {
  id: string;
  displayName: string;
  listNumber: number | null;
  controlNumber: string | null;
};

type GroupInfo = { code: string; shift: string };

export function getSchoolWeekRange(anchorDate: Date) {
  const d = new Date(anchorDate);
  const utcDay = d.getUTCDay();
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0));
  monday.setUTCDate(monday.getUTCDate() + diffToMonday);

  const dates: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    dates.push(day);
  }

  return {
    weekStart: dates[0]!,
    weekEnd: dates[4]!,
    dates,
    weekStartIso: dates[0]!.toISOString().slice(0, 10),
    weekEndIso: dates[4]!.toISOString().slice(0, 10),
  };
}

function formatDateEs(date: Date) {
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function formatDateLongEs(iso: string) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

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

  return { group, students };
}

export async function loadDayAttendanceExport(
  groupId: string,
  teacherId: string,
  date: Date,
) {
  const loaded = await loadGroupStudents(groupId, teacherId);
  if (!loaded) return null;

  const records = await prisma.classDayRecord.findMany({
    where: { groupId, date },
    select: { studentId: true, attendance: true, stars: true },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  const dateIso = date.toISOString().slice(0, 10);
  const rows = loaded.students.map((s, index) => {
    const rec = byStudent.get(s.id);
    const attendance = rec?.attendance ?? "PRESENT";
    return {
      student: s,
      listPosition: index + 1,
      attendance,
      stars: rec?.stars ?? 0,
      saved: Boolean(rec),
      attendanceLabel: ATTENDANCE_LABELS[attendance],
      alert: ALERT_LABELS[attendance],
      missed: attendance === "ABSENT" || attendance === "LATE",
    };
  });

  const summary = {
    present: rows.filter((r) => r.attendance === "PRESENT").length,
    absent: rows.filter((r) => r.attendance === "ABSENT").length,
    late: rows.filter((r) => r.attendance === "LATE").length,
    justified: rows.filter((r) => r.attendance === "JUSTIFIED").length,
    missed: rows.filter((r) => r.missed).length,
    total: rows.length,
    savedCount: records.length,
  };

  return {
    group: loaded.group,
    date: dateIso,
    dateLabel: formatDateLongEs(dateIso),
    rows,
    summary,
    missedStudents: rows.filter((r) => r.attendance === "ABSENT"),
    lateStudents: rows.filter((r) => r.attendance === "LATE"),
  };
}

export async function loadWeekAttendanceExport(
  groupId: string,
  teacherId: string,
  anchorDate: Date,
) {
  const loaded = await loadGroupStudents(groupId, teacherId);
  if (!loaded) return null;

  const week = getSchoolWeekRange(anchorDate);
  const records = await prisma.classDayRecord.findMany({
    where: {
      groupId,
      date: { gte: week.weekStart, lte: week.weekEnd },
    },
    select: { studentId: true, date: true, attendance: true, stars: true },
  });

  const byStudentDay = new Map<string, Map<string, { attendance: AttendanceStatus; stars: number }>>();
  for (const rec of records) {
    const dayIso = rec.date.toISOString().slice(0, 10);
    let byDay = byStudentDay.get(rec.studentId);
    if (!byDay) {
      byDay = new Map();
      byStudentDay.set(rec.studentId, byDay);
    }
    byDay.set(dayIso, { attendance: rec.attendance, stars: rec.stars });
  }

  const dayStats = week.dates.map((d) => {
    const iso = d.toISOString().slice(0, 10);
    const dayRecords = records.filter((r) => r.date.toISOString().slice(0, 10) === iso);
    return {
      date: iso,
      label: formatDateEs(d),
      present: dayRecords.filter((r) => r.attendance === "PRESENT").length,
      absent: dayRecords.filter((r) => r.attendance === "ABSENT").length,
      late: dayRecords.filter((r) => r.attendance === "LATE").length,
      justified: dayRecords.filter((r) => r.attendance === "JUSTIFIED").length,
      recorded: dayRecords.length,
    };
  });

  const studentRows = loaded.students.map((s, index) => {
    const byDay = byStudentDay.get(s.id) ?? new Map();
    const days = week.dates.map((d) => {
      const iso = d.toISOString().slice(0, 10);
      const rec = byDay.get(iso);
      const attendance: AttendanceStatus | null = rec?.attendance ?? null;
      return {
        date: iso,
        label: formatDateEs(d),
        attendance,
        attendanceLabel: attendance !== null ? ATTENDANCE_LABELS[attendance] : "—",
        stars: rec?.stars ?? 0,
        missed: attendance === "ABSENT" || attendance === "LATE",
      };
    });

    const absentCount = days.filter((d) => d.attendance === "ABSENT").length;
    const lateCount = days.filter((d) => d.attendance === "LATE").length;
    const presentCount = days.filter((d) => d.attendance === "PRESENT").length;
    const justifiedCount = days.filter((d) => d.attendance === "JUSTIFIED").length;
    const recordedDays = days.filter((d) => d.attendance !== null).length;
    const missedDays = absentCount + lateCount;

    return {
      student: s,
      listPosition: index + 1,
      days,
      absentCount,
      lateCount,
      presentCount,
      justifiedCount,
      recordedDays,
      missedDays,
      alert:
        absentCount > 0
          ? `⚠ ${absentCount} falta(s)`
          : lateCount > 0
            ? `⚠ ${lateCount} tarde(s)`
            : "",
    };
  });

  const flaggedStudents = studentRows
    .filter((r) => r.absentCount > 0 || r.lateCount > 0)
    .sort((a, b) => b.absentCount - a.absentCount || b.lateCount - a.lateCount);

  return {
    group: loaded.group,
    weekStart: week.weekStartIso,
    weekEnd: week.weekEndIso,
    weekLabel: `${formatDateLongEs(week.weekStartIso)} — ${formatDateLongEs(week.weekEndIso)}`,
    dayStats,
    studentRows,
    flaggedStudents,
    summary: {
      students: loaded.students.length,
      daysWithRecords: dayStats.filter((d) => d.recorded > 0).length,
      totalAbsences: dayStats.reduce((a, d) => a + d.absent, 0),
      totalLate: dayStats.reduce((a, d) => a + d.late, 0),
      flaggedCount: flaggedStudents.length,
    },
  };
}

export function buildDayAttendanceWorkbook(data: NonNullable<Awaited<ReturnType<typeof loadDayAttendanceExport>>>) {
  const info = [
    ["SimEvaluación — Asistencia del día"],
    ["Grupo", data.group.code],
    ["Turno", data.group.shift],
    ["Fecha", data.dateLabel],
    ["Registros guardados", data.summary.savedCount],
    ["Presentes", data.summary.present],
    ["Faltas", data.summary.absent],
    ["Tardes", data.summary.late],
    ["Justificadas", data.summary.justified],
    [],
  ];

  const detail = data.rows.map((r) => ({
    "No. Lista": r.listPosition,
    "No. Control": r.student.controlNumber ?? "",
    Alumno: r.student.displayName,
    Asistencia: r.attendanceLabel,
    Participación: r.stars,
    Alerta: r.alert,
  }));

  const faltas = data.missedStudents.map((r) => ({
    "No. Lista": r.listPosition,
    Alumno: r.student.displayName,
    Asistencia: r.attendanceLabel,
    Alerta: "⚠ REVISAR",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "INFO");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "LISTA_DIA");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      faltas.length
        ? faltas
        : [{ Mensaje: "Todos los alumnos asistieron o están justificados." }],
    ),
    "SIN_ASISTIR",
  );
  return wb;
}

export function buildWeekAttendanceWorkbook(
  data: NonNullable<Awaited<ReturnType<typeof loadWeekAttendanceExport>>>,
) {
  const info = [
    ["SimEvaluación — Reporte semanal de asistencia"],
    ["Grupo", data.group.code],
    ["Turno", data.group.shift],
    ["Semana", data.weekLabel],
    ["Alumnos con faltas o tardes", data.summary.flaggedCount],
    ["Total faltas (días)", data.summary.totalAbsences],
    ["Total tardes (días)", data.summary.totalLate],
    [],
  ];

  const chartData = data.dayStats.map((d) => ({
    Día: d.label,
    Fecha: d.date,
    Presentes: d.present,
    Faltas: d.absent,
    Tardes: d.late,
    Justificadas: d.justified,
    "Gráfico faltas": barAscii(d.absent, Math.max(...data.dayStats.map((x) => x.absent), 1)),
    "Gráfico tardes": barAscii(d.late, Math.max(...data.dayStats.map((x) => x.late), 1)),
  }));

  const matrixHeader: Record<string, string | number> = {
    "No. Lista": "",
    "No. Control": "",
    Alumno: "",
  };
  for (const d of data.dayStats) {
    matrixHeader[d.label] = "";
  }
  matrixHeader["Faltas"] = "";
  matrixHeader["Tardes"] = "";
  matrixHeader["Alerta"] = "";

  const matrix = data.studentRows.map((r) => {
    const row: Record<string, string | number> = {
      "No. Lista": r.listPosition,
      "No. Control": r.student.controlNumber ?? "",
      Alumno: r.student.displayName,
    };
    for (const d of r.days) {
      row[d.label] = d.attendanceLabel;
    }
    row["Faltas"] = r.absentCount;
    row["Tardes"] = r.lateCount;
    row["Alerta"] = r.alert;
    return row;
  });

  const flagged = data.flaggedStudents.map((r) => ({
    "No. Lista": r.listPosition,
    Alumno: r.student.displayName,
    Faltas: r.absentCount,
    Tardes: r.lateCount,
    Detalle: r.days
      .filter((d) => d.missed)
      .map((d) => `${d.label}: ${d.attendanceLabel}`)
      .join("; "),
    Alerta: "⚠ REVISAR",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "INFO");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chartData), "RESUMEN_GRAFICOS");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrix), "DETALLE_SEMANA");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      flagged.length
        ? flagged
        : [{ Mensaje: "Nadie con faltas o tardes en esta semana." }],
    ),
    "ALERTAS",
  );
  return wb;
}

function barAscii(value: number, max: number, width = 12) {
  if (value <= 0) return "";
  const filled = Math.max(1, Math.round((value / max) * width));
  return "█".repeat(filled);
}

export function writeAttendanceXlsx(wb: XLSX.WorkBook) {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function drawHorizontalBars(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  items: { label: string; value: number; color: string }[],
) {
  doc.fontSize(11).font("Helvetica-Bold").text(title);
  doc.moveDown(0.3);
  const max = Math.max(...items.map((i) => i.value), 1);
  const barMaxWidth = 280;
  const barHeight = 14;
  const startX = 140;

  for (const item of items) {
    const y = doc.y;
    doc.fontSize(9).font("Helvetica").fillColor("#333333").text(item.label, 40, y, { width: 95 });
    const w = Math.round((item.value / max) * barMaxWidth);
    if (w > 0) {
      doc.rect(startX, y, w, barHeight).fill(item.color);
    }
    doc.fillColor("#111111").text(String(item.value), startX + barMaxWidth + 8, y + 2);
    doc.y = y + barHeight + 6;
  }
  doc.moveDown(0.5);
}

export function streamDayAttendancePdf(
  res: { setHeader: (k: string, v: string) => void },
  data: NonNullable<Awaited<ReturnType<typeof loadDayAttendanceExport>>>,
  filename: string,
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  // @ts-expect-error express pipe
  doc.pipe(res);

  doc.fontSize(16).font("Helvetica-Bold").text("Asistencia del día");
  doc.fontSize(10).font("Helvetica").text(
    `Grupo ${data.group.code} · ${data.group.shift} · ${data.dateLabel}`,
  );
  doc.moveDown(0.5);
  doc.text(
    `Presentes: ${data.summary.present} · Faltas: ${data.summary.absent} · Tardes: ${data.summary.late} · Justificadas: ${data.summary.justified}`,
  );
  doc.moveDown(1);

  if (data.missedStudents.length > 0) {
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#b91c1c").text("⚠ Alumnos sin asistir");
    doc.fillColor("#111111");
    doc.moveDown(0.3);
    for (const r of data.missedStudents) {
      doc.fontSize(10).font("Helvetica-Bold").text(`• ${r.student.displayName}`, { continued: true });
      doc.font("Helvetica").text(` — ${r.attendanceLabel}`);
    }
    doc.moveDown(0.8);
  }

  if (data.lateStudents.length > 0) {
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#b45309").text("⚠ Alumnos con tardanza");
    doc.fillColor("#111111");
    doc.moveDown(0.3);
    for (const r of data.lateStudents) {
      doc.fontSize(10).text(`• ${r.student.displayName}`);
    }
    doc.moveDown(0.8);
  }

  doc.fontSize(12).font("Helvetica-Bold").text("Lista completa");
  doc.moveDown(0.4);
  const colX = [40, 70, 200, 340, 420];
  doc.fontSize(8).font("Helvetica-Bold");
  ["Lista", "Control", "Alumno", "Asistencia", "Part."].forEach((h, i) => doc.text(h, colX[i], doc.y));
  doc.moveDown(0.35);

  for (const r of data.rows) {
    if (doc.y > 720) {
      doc.addPage();
      doc.fontSize(8).font("Helvetica-Bold");
      ["Lista", "Control", "Alumno", "Asistencia", "Part."].forEach((h, i) => doc.text(h, colX[i], doc.y));
      doc.moveDown(0.35);
    }
    const y = doc.y;
    const isMissed = r.attendance === "ABSENT" || r.attendance === "LATE";
    if (isMissed) doc.fillColor("#b91c1c");
    doc.fontSize(8).font(isMissed ? "Helvetica-Bold" : "Helvetica");
    doc.text(String(r.listPosition), colX[0], y);
    doc.text(r.student.controlNumber ?? "—", colX[1], y);
    doc.text(r.student.displayName, colX[2], y, { width: 130 });
    doc.text(r.attendanceLabel, colX[3], y);
    doc.text(String(r.stars), colX[4], y);
    doc.fillColor("#111111");
    doc.y = y + 12;
  }

  doc.end();
}

export function streamWeekAttendancePdf(
  res: { setHeader: (k: string, v: string) => void },
  data: NonNullable<Awaited<ReturnType<typeof loadWeekAttendanceExport>>>,
  filename: string,
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  // @ts-expect-error express pipe
  doc.pipe(res);

  doc.fontSize(16).font("Helvetica-Bold").text("Reporte semanal de asistencia");
  doc.fontSize(10).font("Helvetica").text(
    `Grupo ${data.group.code} · ${data.group.shift}`,
  );
  doc.text(data.weekLabel);
  doc.moveDown(0.8);

  drawHorizontalBars(
    doc,
    "Faltas por día",
    data.dayStats.map((d) => ({ label: d.label, value: d.absent, color: "#ef4444" })),
  );
  drawHorizontalBars(
    doc,
    "Tardanzas por día",
    data.dayStats.map((d) => ({ label: d.label, value: d.late, color: "#f59e0b" })),
  );

  if (data.flaggedStudents.length > 0) {
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#b91c1c").text("⚠ Alumnos a revisar");
    doc.fillColor("#111111");
    doc.moveDown(0.3);
    for (const r of data.flaggedStudents) {
      const detail = r.days
        .filter((d) => d.missed)
        .map((d) => `${d.label}: ${d.attendanceLabel}`)
        .join(", ");
      doc.fontSize(9).font("Helvetica-Bold").text(r.student.displayName, { continued: true });
      doc.font("Helvetica").text(` — ${r.absentCount} falta(s), ${r.lateCount} tarde(s). ${detail}`);
    }
    doc.moveDown(0.8);
  } else {
    doc.fontSize(10).text("Sin faltas ni tardes registradas en esta semana.");
    doc.moveDown(0.8);
  }

  doc.fontSize(12).font("Helvetica-Bold").text("Detalle por alumno");
  doc.moveDown(0.4);

  const dayLabels = data.dayStats.map((d) => d.label);
  const colX = [40, 55, 170, 230, 290, 350, 410, 470];
  doc.fontSize(7).font("Helvetica-Bold");
  doc.text("Lista", colX[0], doc.y);
  doc.text("Alumno", colX[1], doc.y, { width: 110 });
  dayLabels.forEach((label, i) => doc.text(label, colX[2 + i], doc.y));
  doc.text("F", colX[7], doc.y);
  doc.moveDown(0.35);

  for (const r of data.studentRows) {
    if (doc.y > 700) {
      doc.addPage();
    }
    const y = doc.y;
    const flagged = r.absentCount > 0 || r.lateCount > 0;
    if (flagged) doc.fillColor("#b91c1c");
    doc.fontSize(7).font(flagged ? "Helvetica-Bold" : "Helvetica");
    doc.text(String(r.listPosition), colX[0], y);
    doc.text(r.student.displayName, colX[1], y, { width: 110 });
    r.days.forEach((d, i) => {
      const short =
        d.attendance === "PRESENT"
          ? "P"
          : d.attendance === "ABSENT"
            ? "A"
            : d.attendance === "LATE"
              ? "T"
              : d.attendance === "JUSTIFIED"
                ? "J"
                : "—";
      doc.text(short, colX[2 + i], y);
    });
    doc.text(String(r.absentCount), colX[7], y);
    doc.fillColor("#111111");
    doc.y = y + 11;
  }

  doc.end();
}

export async function resolveAttendanceExportDate(
  groupId: string,
  teacherId: string,
  dateRaw: string,
) {
  const date = dateRaw ? parseClassDayDate(dateRaw) : todayClassDayDate();
  if (!date) return { error: "invalid_date" as const };
  const data = await loadDayAttendanceExport(groupId, teacherId, date);
  if (!data) return { error: "group_not_found" as const };
  return { data, date };
}

export async function resolveWeekAttendanceExport(
  groupId: string,
  teacherId: string,
  dateRaw: string,
) {
  const anchor = dateRaw ? parseClassDayDate(dateRaw) : todayClassDayDate();
  if (!anchor) return { error: "invalid_date" as const };
  const data = await loadWeekAttendanceExport(groupId, teacherId, anchor);
  if (!data) return { error: "group_not_found" as const };
  return { data, week: getSchoolWeekRange(anchor) };
}
