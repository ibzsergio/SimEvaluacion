import { prisma } from "./prisma.js";
import { parseClassDayDate } from "./classDayService.js";
import { dedupeSeatingSessions } from "./seatingService.js";

async function tableExists(name: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(${name})
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
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

async function indexExists(table: string, indexName: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND LOWER(table_name) = LOWER(${table})
      AND LOWER(index_name) = LOWER(${indexName})
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

async function ensureSeatingIndexes() {
  if (!(await tableExists("SeatingSession"))) return;

  if (!(await indexExists("SeatingSession", "SeatingSession_groupId_date_key"))) {
    console.log("[startup] Adding SeatingSession groupId+date unique index...");
    await execOptional(`
      CREATE UNIQUE INDEX \`SeatingSession_groupId_date_key\` ON \`SeatingSession\`(\`groupId\`, \`date\`)
    `);
  }

  if (!(await tableExists("SeatingAssignment"))) return;

  if (!(await indexExists("SeatingAssignment", "SeatingAssignment_sessionId_studentId_key"))) {
    console.log("[startup] Adding SeatingAssignment sessionId+studentId unique index...");
    await execOptional(`
      CREATE UNIQUE INDEX \`SeatingAssignment_sessionId_studentId_key\`
      ON \`SeatingAssignment\`(\`sessionId\`, \`studentId\`)
    `);
  }

  if (!(await indexExists("SeatingAssignment", "SeatingAssignment_sessionId_row_col_key"))) {
    console.log("[startup] Adding SeatingAssignment sessionId+row+col unique index...");
    await execOptional(`
      CREATE UNIQUE INDEX \`SeatingAssignment_sessionId_row_col_key\`
      ON \`SeatingAssignment\`(\`sessionId\`, \`row\`, \`col\`)
    `);
  }
}

async function probeSeatingQueries() {
  const probeDate = parseClassDayDate("2099-01-01")!;
  await prisma.seatingSession.findUnique({
    where: { groupId_date: { groupId: "__probe__", date: probeDate } },
    select: { id: true },
  });
}

export async function getSeatingSchemaStatus() {
  const hasSession = await tableExists("SeatingSession");
  const hasAssignment = await tableExists("SeatingAssignment");
  const hasMode = hasSession ? await columnExists("SeatingSession", "mode") : false;
  const hasGroupDateIndex = hasSession
    ? await indexExists("SeatingSession", "SeatingSession_groupId_date_key")
    : false;
  let prismaOk = false;
  let probeOk = false;
  if (hasSession) {
    try {
      await prisma.seatingSession.count();
      prismaOk = true;
    } catch {
      prismaOk = false;
    }
    try {
      await probeSeatingQueries();
      probeOk = true;
    } catch {
      probeOk = false;
    }
  }
  const ready =
    hasSession && hasAssignment && hasMode && hasGroupDateIndex && prismaOk && probeOk;
  return {
    hasSession,
    hasAssignment,
    hasMode,
    hasGroupDateIndex,
    prismaOk,
    probeOk,
    ready,
  };
}

/** Garantiza tablas de butacas aunque migrate deploy no haya corrido en Railway. */
export async function ensureSeatingSchema() {
  console.log("[startup] Ensuring seating schema...");
  const before = await getSeatingSchemaStatus();
  if (before.ready) {
    console.log("[startup] Seating schema already ready.");
    return;
  }

  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`SeatingSession\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`groupId\` VARCHAR(191) NOT NULL,
      \`date\` DATE NOT NULL,
      \`mode\` VARCHAR(191) NOT NULL DEFAULT 'random',
      \`theme\` VARCHAR(191) NOT NULL DEFAULT 'column_colors',
      \`createdById\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`SeatingSession_groupId_date_key\`(\`groupId\`, \`date\`),
      INDEX \`SeatingSession_groupId_date_idx\`(\`groupId\`, \`date\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  if (!(await columnExists("SeatingSession", "mode"))) {
    console.log("[startup] Adding SeatingSession.mode...");
    await execOptional(`
      ALTER TABLE \`SeatingSession\` ADD COLUMN \`mode\` VARCHAR(191) NOT NULL DEFAULT 'random'
    `);
  }

  if (!(await columnExists("SeatingSession", "theme"))) {
    console.log("[startup] Adding SeatingSession.theme...");
    await execOptional(`
      ALTER TABLE \`SeatingSession\` ADD COLUMN \`theme\` VARCHAR(191) NOT NULL DEFAULT 'column_colors'
    `);
  }

  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`SeatingAssignment\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`sessionId\` VARCHAR(191) NOT NULL,
      \`studentId\` VARCHAR(191) NOT NULL,
      \`row\` INT NOT NULL,
      \`col\` INT NOT NULL,
      \`color\` VARCHAR(191) NOT NULL,
      UNIQUE INDEX \`SeatingAssignment_sessionId_studentId_key\`(\`sessionId\`, \`studentId\`),
      UNIQUE INDEX \`SeatingAssignment_sessionId_row_col_key\`(\`sessionId\`, \`row\`, \`col\`),
      INDEX \`SeatingAssignment_studentId_idx\`(\`studentId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await ensureSeatingIndexes();
  await dedupeSeatingSessions();

  await execOptional(`
    ALTER TABLE \`SeatingSession\`
    ADD CONSTRAINT \`SeatingSession_groupId_fkey\`
    FOREIGN KEY (\`groupId\`) REFERENCES \`ClassGroup\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`SeatingSession\`
    ADD CONSTRAINT \`SeatingSession_createdById_fkey\`
    FOREIGN KEY (\`createdById\`) REFERENCES \`User\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`SeatingAssignment\`
    ADD CONSTRAINT \`SeatingAssignment_sessionId_fkey\`
    FOREIGN KEY (\`sessionId\`) REFERENCES \`SeatingSession\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`SeatingAssignment\`
    ADD CONSTRAINT \`SeatingAssignment_studentId_fkey\`
    FOREIGN KEY (\`studentId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);

  const after = await getSeatingSchemaStatus();
  if (!after.ready) {
    throw new Error(`Seating schema incomplete: ${JSON.stringify(after)}`);
  }
  console.log("[startup] Seating schema ready.");
}
