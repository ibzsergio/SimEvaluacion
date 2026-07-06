import * as XLSX from "xlsx";
import type { OfficeExamGradeRow } from "./gradeRows.js";
import { sortGradeRowsAlphabetically } from "./gradeRows.js";

function buildGroupSheet(rows: OfficeExamGradeRow[]) {
  const sorted = sortGradeRowsAlphabetically(rows);
  const header = ["Alumno", "Escala (0-6)", "Calificación examen (0-4)", "Calificación total (0-10)"];
  const dataRows = sorted.map((r) => [
    r.displayName,
    r.firmasScore6,
    r.examScore4,
    r.finalGrade,
  ]);
  return XLSX.utils.aoa_to_sheet([header, ...dataRows]);
}

export function buildOfficeGradesWorkbook(
  groups: Array<{ code: string; id: string }>,
  rows: OfficeExamGradeRow[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const group of groups) {
    const groupRows = rows.filter((r) => r.groupId === group.id);
    XLSX.utils.book_append_sheet(wb, buildGroupSheet(groupRows), group.code);
  }
  return wb;
}

export function sendOfficeGradesXlsx(
  res: { setHeader: (k: string, v: string) => void; send: (b: Buffer) => void },
  wb: XLSX.WorkBook,
  filename: string,
) {
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(out);
}
