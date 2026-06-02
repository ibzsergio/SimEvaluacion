import type { ClassGroup } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { ParsedStudentRow } from "./excel.js";

export type ImportSummary = {
  total: number;
  created: number;
  updated: number;
};

export async function importStudentRows(
  group: ClassGroup,
  rows: ParsedStudentRow[],
  unsetHash: string,
): Promise<ImportSummary> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await prisma.user.findUnique({
      where: { controlNumber: row.controlNumber },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: row.fullName,
          listNumber: row.listNumber ?? existing.listNumber,
          groupId: group.id,
          role: "STUDENT",
        },
      });
      updated++;
    } else {
      await prisma.user.create({
        data: {
          controlNumber: row.controlNumber,
          passwordHash: unsetHash,
          passwordSet: false,
          recoverablePassword: null,
          role: "STUDENT",
          displayName: row.fullName,
          listNumber: row.listNumber,
          groupId: group.id,
        },
      });
      created++;
    }
  }

  return { total: rows.length, created, updated };
}
