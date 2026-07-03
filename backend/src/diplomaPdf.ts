import PDFDocument from "pdfkit";
import {
  DIPLOMA_SUBJECT_NAME,
  DIPLOMA_TEACHER_NAME,
  getDiplomaEncouragement,
  getExemptionStatus,
  type ExemptionTier,
} from "./exemptionStatus.js";

export type DiplomaInput = {
  studentName: string;
  groupCode: string;
  groupShift: string;
  place: number;
  totalStudents: number;
  score: number;
  partialClosedAt: Date;
};

const C = {
  ink: "#0f172a",
  slate: "#334155",
  muted: "#64748b",
  cyan: "#06b6d4",
  cyanDark: "#0891b2",
  indigo: "#4f46e5",
  indigoDark: "#312e81",
  paper: "#f8fafc",
  paperWarm: "#eef2ff",
  white: "#ffffff",
  line: "#cbd5e1",
};

function sealColors(tier: ExemptionTier) {
  if (tier === "exempt") return { fill: "#059669", ring: "#34d399", text: "#ecfdf5" };
  if (tier === "can_exempt") return { fill: "#0284c7", ring: "#38bdf8", text: "#f0f9ff" };
  return { fill: "#d97706", ring: "#fbbf24", text: "#fffbeb" };
}

function drawDotGrid(doc: InstanceType<typeof PDFDocument>, w: number, h: number) {
  doc.save();
  doc.fillColor("#e2e8f0");
  for (let x = 24; x < w - 24; x += 18) {
    for (let y = 24; y < h - 24; y += 18) {
      doc.circle(x, y, 0.6).fill();
    }
  }
  doc.restore();
}

function drawCornerAccents(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  color: string,
) {
  doc.save();
  doc.lineWidth(2.5).strokeColor(color);
  doc.moveTo(x, y + len).lineTo(x, y).lineTo(x + len, y).stroke();
  doc.moveTo(x + w - len, y).lineTo(x + w, y).lineTo(x + w, y + len).stroke();
  doc.moveTo(x, y + h - len).lineTo(x, y + h).lineTo(x + len, y + h).stroke();
  doc.moveTo(x + w - len, y + h).lineTo(x + w, y + h).lineTo(x + w, y + h - len).stroke();
  doc.restore();
}

function drawTechHeader(doc: InstanceType<typeof PDFDocument>, pageW: number) {
  const bandH = 88;
  doc.save();
  doc.rect(0, 0, pageW, bandH).fill(C.indigoDark);
  doc.rect(0, bandH - 4, pageW, 4).fill(C.cyan);

  doc.fillColor(C.cyan).font("Courier").fontSize(9);
  doc.text("// PARCIAL · DESARROLLO DE SOFTWARE", 36, 18);

  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(24);
  doc.text("DIPLOMA DE RECONOCIMIENTO", 36, 34, { width: pageW - 72, align: "center" });

  doc.fillColor("#a5b4fc").font("Helvetica").fontSize(10);
  doc.text("Sistemas Informáticos · Evaluación por desempeño", 36, 66, {
    width: pageW - 72,
    align: "center",
  });

  doc.fillColor(C.cyan).font("Courier").fontSize(8);
  doc.text("01110100 01110010 01100001 01100001 01101010 01101111", 36, 78, {
    width: pageW - 72,
    align: "center",
  });
  doc.restore();
}

function drawSeal(
  doc: InstanceType<typeof PDFDocument>,
  cx: number,
  cy: number,
  r: number,
  tier: ExemptionTier,
  shortLabel: string,
  place: number,
) {
  const colors = sealColors(tier);
  doc.save();
  doc.circle(cx, cy, r + 6).lineWidth(2).strokeColor(colors.ring).stroke();
  doc.circle(cx, cy, r).fillColor(colors.fill).fill();
  doc.circle(cx, cy, r - 8).lineWidth(1.5).strokeColor(colors.text).stroke();

  doc.fillColor(colors.text).font("Helvetica-Bold").fontSize(11);
  doc.text(shortLabel, cx - r + 6, cy - 16, { width: (r - 6) * 2, align: "center" });
  doc.font("Helvetica").fontSize(9);
  doc.text(`#${place}`, cx - r + 6, cy + 2, { width: (r - 6) * 2, align: "center" });
  doc.restore();
}

export function buildDiplomaPdf(input: DiplomaInput): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 0 });
  const exemption = getExemptionStatus(input.place);
  const encouragement = getDiplomaEncouragement(input.place, input.totalStudents);
  const dateLabel = input.partialClosedAt.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 28;
  const innerX = margin + 10;
  const innerY = 96;
  const innerW = pageW - (margin + 10) * 2;
  const innerH = pageH - innerY - margin;

  doc.rect(0, 0, pageW, pageH).fill(C.paper);
  drawDotGrid(doc, pageW, pageH);

  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2).lineWidth(3).stroke(C.indigo);
  doc.rect(margin + 6, margin + 6, pageW - (margin + 6) * 2, pageH - (margin + 6) * 2)
    .lineWidth(1)
    .stroke(C.cyanDark);
  drawCornerAccents(doc, margin + 12, margin + 12, pageW - (margin + 12) * 2, pageH - (margin + 12) * 2, 22, C.cyan);

  drawTechHeader(doc, pageW);

  doc.roundedRect(innerX, innerY, innerW, innerH, 8).fill(C.white);
  doc.roundedRect(innerX, innerY, innerW, innerH, 8).lineWidth(1).stroke(C.line);

  const contentW = innerW - 180;
  const leftX = innerX + 28;
  const topY = innerY + 22;

  doc.fillColor(C.cyanDark).font("Courier-Bold").fontSize(11);
  doc.text("{", leftX, topY);
  doc.fillColor(C.indigo).font("Courier-Bold").fontSize(12);
  doc.text(DIPLOMA_SUBJECT_NAME, leftX + 14, topY, { width: contentW - 28 });
  doc.fillColor(C.cyanDark).font("Courier-Bold").fontSize(11);
  doc.text("}", leftX + contentW - 10, topY);

  doc.fillColor(C.muted).font("Helvetica").fontSize(11);
  doc.text("Se otorga el presente reconocimiento académico a", leftX, topY + 28, {
    width: contentW,
  });

  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(28);
  doc.text(input.studentName, leftX, topY + 48, { width: contentW });

  doc.moveTo(leftX, topY + 88).lineTo(leftX + contentW - 20, topY + 88).lineWidth(2).stroke(C.cyan);

  doc.fillColor(C.slate).font("Helvetica").fontSize(10);
  doc.text(
    `Grupo ${input.groupCode}  ·  Turno ${input.groupShift}  ·  ${dateLabel}`,
    leftX,
    topY + 98,
    { width: contentW },
  );

  const statY = topY + 118;
  doc.roundedRect(leftX, statY, contentW, 34, 6).fill(C.paperWarm);
  doc.roundedRect(leftX, statY, contentW, 34, 6).lineWidth(0.8).stroke("#c7d2fe");

  doc.fillColor(C.indigo).font("Helvetica-Bold").fontSize(10);
  doc.text("RANKING DEL PARCIAL", leftX + 12, statY + 8);
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(12);
  doc.text(`#${input.place} de ${input.totalStudents}`, leftX + 12, statY + 20);

  doc.fillColor(C.indigo).font("Helvetica-Bold").fontSize(10);
  doc.text("PUNTOS TOTALES", leftX + contentW / 2, statY + 8);
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(12);
  doc.text(String(input.score), leftX + contentW / 2, statY + 20);

  doc.fillColor(sealColors(exemption.tier).fill).font("Helvetica-Bold").fontSize(15);
  doc.text(exemption.label, leftX, statY + 48, { width: contentW });

  const msgY = statY + 72;
  const msgH = innerH - (msgY - innerY) - 58;
  doc.roundedRect(leftX, msgY, contentW, msgH, 6).fill("#f1f5f9");
  doc.roundedRect(leftX, msgY, contentW, msgH, 6).lineWidth(0.8).stroke(C.line);
  doc.fillColor(C.slate).font("Helvetica").fontSize(10.5);
  doc.text(encouragement, leftX + 14, msgY + 12, {
    width: contentW - 28,
    align: "justify",
    lineGap: 3,
  });

  const sealCx = innerX + innerW - 78;
  const sealCy = innerY + innerH / 2 - 10;
  drawSeal(doc, sealCx, sealCy, 52, exemption.tier, exemption.shortLabel, input.place);

  const footY = innerY + innerH - 42;
  doc.moveTo(leftX, footY).lineTo(leftX + 220, footY).lineWidth(1).stroke(C.muted);
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(11);
  doc.text(DIPLOMA_TEACHER_NAME, leftX, footY + 6);
  doc.fillColor(C.muted).font("Helvetica").fontSize(9);
  doc.text("Docente responsable de la materia", leftX, footY + 20);

  doc.fillColor(C.cyanDark).font("Courier").fontSize(8);
  doc.text("< / > commit: parcial_aprobado", innerX + innerW - 200, footY + 14, {
    width: 180,
    align: "right",
  });

  return doc;
}

export function streamDiplomaPdf(
  res: { setHeader: (k: string, v: string) => void; status?: (n: number) => unknown },
  input: DiplomaInput,
  filename: string,
  inline = false,
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${filename}"`,
  );
  const doc = buildDiplomaPdf(input);
  // @ts-expect-error express response has pipe
  doc.pipe(res);
  doc.end();
}
