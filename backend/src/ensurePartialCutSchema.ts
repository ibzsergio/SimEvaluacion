import { prisma } from "./prisma.js";

async function execOptional(sql: string, ignore = /Duplicate|already exists|errno: 1060|errno: 1061/i) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (ignore.test(msg)) return;
    throw err;
  }
}

async function columnExists(table: string, column: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND LOWER(table_name) = LOWER(${table})
      AND LOWER(column_name) = LOWER(${column})
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** Corte de parciales: actividades del parcial cerrado se archivan; las nuevas van al siguiente. */
export async function ensurePartialCutSchema() {
  console.log("[startup] Ensuring partial cut schema...");
  if (!(await columnExists("ClassGroup", "currentPartial"))) {
    await execOptional(
      "ALTER TABLE `ClassGroup` ADD COLUMN `currentPartial` INTEGER NOT NULL DEFAULT 1",
    );
  }
  if (!(await columnExists("Activity", "partialNumber"))) {
    await execOptional(
      "ALTER TABLE `Activity` ADD COLUMN `partialNumber` INTEGER NOT NULL DEFAULT 1",
    );
  }
  await execOptional(
    "UPDATE `ClassGroup` SET `currentPartial` = 2 WHERE `partialClosed` = 1 AND `currentPartial` = 1",
  );
  console.log("[startup] Partial cut schema ready.");
}
