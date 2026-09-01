import { prisma } from "./prisma.js";

async function tableExists(name: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(${name})
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function execOptional(sql: string, ignore = /Duplicate|already exists|errno: 1061|errno: 1826/i) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (ignore.test(msg)) return;
    throw err;
  }
}

export async function getClassDaySchemaStatus() {
  const hasTable = await tableExists("ClassDayRecord");
  let prismaOk = false;
  if (hasTable) {
    try {
      await prisma.classDayRecord.count();
      prismaOk = true;
    } catch {
      prismaOk = false;
    }
  }
  return { hasTable, prismaOk, ready: hasTable && prismaOk };
}

/** Garantiza tabla de asistencia diaria aunque migrate deploy no haya corrido en Railway. */
export async function ensureClassDaySchema() {
  console.log("[startup] Ensuring class day schema...");
  const before = await getClassDaySchemaStatus();
  if (before.ready) {
    console.log("[startup] Class day schema already ready.");
    return;
  }

  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`ClassDayRecord\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`groupId\` VARCHAR(191) NOT NULL,
      \`studentId\` VARCHAR(191) NOT NULL,
      \`date\` DATE NOT NULL,
      \`attendance\` ENUM('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED') NOT NULL DEFAULT 'PRESENT',
      \`stars\` INTEGER NOT NULL DEFAULT 0,
      \`markedById\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`ClassDayRecord_groupId_studentId_date_key\`(\`groupId\`, \`studentId\`, \`date\`),
      INDEX \`ClassDayRecord_groupId_date_idx\`(\`groupId\`, \`date\`),
      INDEX \`ClassDayRecord_studentId_idx\`(\`studentId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await execOptional(`
    ALTER TABLE \`ClassDayRecord\`
    ADD CONSTRAINT \`ClassDayRecord_groupId_fkey\`
    FOREIGN KEY (\`groupId\`) REFERENCES \`ClassGroup\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`ClassDayRecord\`
    ADD CONSTRAINT \`ClassDayRecord_studentId_fkey\`
    FOREIGN KEY (\`studentId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`ClassDayRecord\`
    ADD CONSTRAINT \`ClassDayRecord_markedById_fkey\`
    FOREIGN KEY (\`markedById\`) REFERENCES \`User\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
  `);

  const after = await getClassDaySchemaStatus();
  if (!after.ready) {
    throw new Error(`Class day schema incomplete: ${JSON.stringify(after)}`);
  }
  console.log("[startup] Class day schema ready.");
}

export function isClassDaySchemaError(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: unknown }).code);
    if (code === "P2021" || code === "P2022") return true;
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("classdayrecord") &&
    (msg.includes("doesn't exist") || msg.includes("does not exist"))
  );
}
