import type { ClassGroup, User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { isLikelyRowIndexControl, normalizePersonName } from "./excel.js";
import type { ParsedStudentRow } from "./excel.js";

export type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

async function findStudentInGroupByName(groupId: string, fullName: string): Promise<User | null> {
  const key = normalizePersonName(fullName);
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: {
      id: true,
      email: true,
      controlNumber: true,
      passwordHash: true,
      passwordSet: true,
      recoverablePassword: true,
      role: true,
      displayName: true,
      listNumber: true,
      groupId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return students.find((s) => normalizePersonName(s.displayName) === key) ?? null;
}

async function resolveExistingStudent(
  group: ClassGroup,
  row: ParsedStudentRow,
): Promise<User | null> {
  const hasRealControl = row.controlNumber && !isLikelyRowIndexControl(row.controlNumber);

  if (hasRealControl) {
    const byControl = await prisma.user.findUnique({ where: { controlNumber: row.controlNumber } });
    if (byControl) return byControl;
  }

  return findStudentInGroupByName(group.id, row.fullName);
}

export async function importStudentRows(
  group: ClassGroup,
  rows: ParsedStudentRow[],
  unsetHash: string,
): Promise<ImportSummary> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await resolveExistingStudent(group, row);

    if (existing) {
      const hasRealControl = row.controlNumber && !isLikelyRowIndexControl(row.controlNumber);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: row.fullName,
          listNumber: row.listNumber ?? existing.listNumber,
          groupId: group.id,
          role: "STUDENT",
          ...(hasRealControl && !existing.controlNumber ? { controlNumber: row.controlNumber } : {}),
          ...(hasRealControl &&
          existing.controlNumber &&
          isLikelyRowIndexControl(existing.controlNumber)
            ? { controlNumber: row.controlNumber }
            : {}),
        },
      });
      updated++;
      continue;
    }

    const hasRealControl = row.controlNumber && !isLikelyRowIndexControl(row.controlNumber);
    if (!hasRealControl) {
      skipped++;
      continue;
    }

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

  return { total: rows.length, created, updated, skipped };
}
