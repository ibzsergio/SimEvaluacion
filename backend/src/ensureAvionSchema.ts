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

export async function ensureAvionSchema() {
  console.log("[startup] Ensuring avion schema...");
  if (!(await columnExists("ClassGroup", "avionReleased"))) {
    await execOptional(
      "ALTER TABLE `ClassGroup` ADD COLUMN `avionReleased` BOOLEAN NOT NULL DEFAULT false",
    );
  }
  if (!(await columnExists("ClassGroup", "avionReleasedAt"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `avionReleasedAt` DATETIME(3) NULL");
  }
  if (!(await columnExists("ClassGroup", "avionPayload"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `avionPayload` JSON NULL");
  }
  console.log("[startup] Avion schema ready.");
}
