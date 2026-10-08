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

export async function ensureCompilerSchema() {
  console.log("[startup] Ensuring compiler schema...");
  if (!(await columnExists("ClassGroup", "compilerReleased"))) {
    await execOptional(
      "ALTER TABLE `ClassGroup` ADD COLUMN `compilerReleased` BOOLEAN NOT NULL DEFAULT false",
    );
  }
  if (!(await columnExists("ClassGroup", "compilerReleasedAt"))) {
    await execOptional("ALTER TABLE `ClassGroup` ADD COLUMN `compilerReleasedAt` DATETIME(3) NULL");
  }
  console.log("[startup] Compiler schema ready.");
}

function asBool(value: unknown) {
  if (value === true || value === 1) return true;
  if (typeof value === "bigint") return value === 1n;
  if (Buffer.isBuffer(value)) return value[0] === 1;
  return Boolean(value);
}

export async function getCompilerReleasedByGroupIds(groupIds: string[]) {
  const map = new Map<string, boolean>();
  for (const id of groupIds) {
    map.set(id, await getCompilerReleasedForGroup(id));
  }
  return map;
}

export async function getCompilerReleasedForGroup(groupId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ compilerReleased: unknown }>>`
      SELECT compilerReleased FROM ClassGroup WHERE id = ${groupId} LIMIT 1
    `;
    return asBool(rows[0]?.compilerReleased);
  } catch {
    return false;
  }
}

export async function setCompilerReleased(groupId: string, released: boolean) {
  if (released) {
    await prisma.$executeRaw`
      UPDATE ClassGroup SET compilerReleased = 1, compilerReleasedAt = NOW(3) WHERE id = ${groupId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE ClassGroup SET compilerReleased = 0, compilerReleasedAt = NULL WHERE id = ${groupId}
    `;
  }
}
