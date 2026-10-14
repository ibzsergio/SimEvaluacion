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

export async function ensureExtraSchema() {
  console.log("[startup] Ensuring extra schema...");
  if (!(await columnExists("ClassGroup", "extraReleased"))) {
    await execOptional(
      "ALTER TABLE `ClassGroup` ADD COLUMN `extraReleased` BOOLEAN NOT NULL DEFAULT false",
    );
  }
  if (!(await columnExists("ClassGroup", "extraReleasedAt"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `extraReleasedAt` DATETIME(3) NULL");
  }
  if (!(await columnExists("ClassGroup", "extraPayload"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `extraPayload` JSON NULL");
  }
  console.log("[startup] Extra schema ready.");
}
