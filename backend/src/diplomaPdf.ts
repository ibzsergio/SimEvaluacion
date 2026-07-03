import PDFDocument from "pdfkit";
import {
  DIPLOMA_SUBJECT_NAME,
  DIPLOMA_TEACHER_NAME,
  getDiplomaEncouragement,
  getExemptionStatus,
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

export function buildDiplomaPdf(input: DiplomaInput): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 50 });
  const exemption = getExemptionStatus(input.place);
  const encouragement = getDiplomaEncouragement(input.place, input.totalStudents);
  const dateLabel = input.partialClosedAt.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const pageW = doc.page.width;
  const contentW = pageW - 100;

  doc.rect(30, 30, pageW - 60, doc.page.height - 60).lineWidth(3).stroke("#1e3a5f");
  doc.rect(38, 38, pageW - 76, doc.page.height - 76).lineWidth(1).stroke("#0891b2");

  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(28);
  doc.text("DIPLOMA DE RECONOCIMIENTO", 50, 70, { width: contentW, align: "center" });

  doc.fillColor("#0891b2").font("Helvetica").fontSize(13);
  doc.text(DIPLOMA_SUBJECT_NAME, 50, 108, { width: contentW, align: "center" });

  doc.fillColor("#334155").font("Helvetica").fontSize(12);
  doc.text("Se otorga el presente reconocimiento a", 50, 145, { width: contentW, align: "center" });

  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(26);
  doc.text(input.studentName, 50, 168, { width: contentW, align: "center" });

  doc.fillColor("#334155").font("Helvetica").fontSize(11);
  doc.text(
    `Grupo ${input.groupCode} · Turno ${input.groupShift} · ${dateLabel}`,
    50,
    205,
    { width: contentW, align: "center" },
  );

  doc.fillColor("#0e7490").font("Helvetica-Bold").fontSize(16);
  doc.text(exemption.label, 50, 235, { width: contentW, align: "center" });

  doc.fillColor("#475569").font("Helvetica").fontSize(11);
  doc.text(
    `Lugar en el ranking del parcial: #${input.place} de ${input.totalStudents} · ${input.score} puntos totales`,
    50,
    265,
    { width: contentW, align: "center" },
  );

  doc.fillColor("#334155").font("Helvetica").fontSize(11);
  doc.text(encouragement, 70, 295, { width: contentW - 40, align: "justify", lineGap: 4 });

  doc.fillColor("#64748b").font("Helvetica").fontSize(10);
  doc.text(DIPLOMA_TEACHER_NAME, 50, doc.page.height - 95, { width: contentW, align: "center" });
  doc.font("Helvetica").fontSize(9).text("Docente", 50, doc.page.height - 78, { width: contentW, align: "center" });

  return doc;
}

export function streamDiplomaPdf(
  res: { setHeader: (k: string, v: string) => void; status?: (n: number) => unknown },
  input: DiplomaInput,
  filename: string,
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = buildDiplomaPdf(input);
  // @ts-expect-error express response has pipe
  doc.pipe(res);
  doc.end();
}
