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

export async function ensureLecturaSchema() {
  console.log("[startup] Ensuring lectura schema...");
  if (!(await columnExists("ClassGroup", "lecturaReleased"))) {
    await execOptional(
      "ALTER TABLE `ClassGroup` ADD COLUMN `lecturaReleased` BOOLEAN NOT NULL DEFAULT false",
    );
  }
  if (!(await columnExists("ClassGroup", "lecturaReleasedAt"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `lecturaReleasedAt` DATETIME(3) NULL");
  }
  console.log("[startup] Lectura schema ready.");
}
