import type { ClassGroup } from "@prisma/client";
import { prisma } from "./prisma.js";

const DEFAULT_GROUPS = [
  { code: "201", shift: "matutino" },
  { code: "202", shift: "matutino" },
] as const;

export async function ensureTeacherGroups(teacherId: string): Promise<ClassGroup[]> {
  return Promise.all(
    DEFAULT_GROUPS.map((g) =>
      prisma.classGroup.upsert({
        where: {
          teacherId_code_shift: {
            teacherId,
            code: g.code,
            shift: g.shift,
          },
        },
        update: {},
        create: {
          teacherId,
          code: g.code,
          shift: g.shift,
        },
      }),
    ),
  );
}

export async function placeholderPasswordHash() {
  const bcrypt = await import("bcrypt");
  return bcrypt.hash(`unset-${Date.now()}-${Math.random()}`, 10);
}
