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

export async function ensureImproSchema() {
  console.log("[startup] Ensuring impro schema...");
  if (!(await columnExists("ClassGroup", "improReleased"))) {
    await execOptional(
      "ALTER TABLE `ClassGroup` ADD COLUMN `improReleased` BOOLEAN NOT NULL DEFAULT false",
    );
  }
  if (!(await columnExists("ClassGroup", "improReleasedAt"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `improReleasedAt` DATETIME(3) NULL");
  }
  if (!(await columnExists("ClassGroup", "improPayload"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `improPayload` JSON NULL");
  }
  console.log("[startup] Impro schema ready.");
}
