import { prisma } from "./prisma.js";

async function tableExists(name: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = ${name}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function columnExists(table: string, column: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** Garantiza tablas de butacas aunque migrate deploy no haya corrido en Railway. */
export async function ensureSeatingSchema() {
  const hasSession = await tableExists("SeatingSession");
  const hasAssignment = await tableExists("SeatingAssignment");

  if (!hasSession) {
    console.log("[startup] Creating SeatingSession...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE \`SeatingSession\` (
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
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`SeatingSession\`
      ADD CONSTRAINT \`SeatingSession_groupId_fkey\`
      FOREIGN KEY (\`groupId\`) REFERENCES \`ClassGroup\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`SeatingSession\`
      ADD CONSTRAINT \`SeatingSession_createdById_fkey\`
      FOREIGN KEY (\`createdById\`) REFERENCES \`User\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  } else if (!(await columnExists("SeatingSession", "mode"))) {
    console.log("[startup] Adding SeatingSession.mode...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`SeatingSession\` ADD COLUMN \`mode\` VARCHAR(191) NOT NULL DEFAULT 'random'
    `);
  }

  if (!hasAssignment) {
    console.log("[startup] Creating SeatingAssignment...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE \`SeatingAssignment\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`sessionId\` VARCHAR(191) NOT NULL,
        \`studentId\` VARCHAR(191) NOT NULL,
        \`row\` INTEGER NOT NULL,
        \`col\` INTEGER NOT NULL,
        \`color\` VARCHAR(191) NOT NULL,
        UNIQUE INDEX \`SeatingAssignment_sessionId_studentId_key\`(\`sessionId\`, \`studentId\`),
        UNIQUE INDEX \`SeatingAssignment_sessionId_row_col_key\`(\`sessionId\`, \`row\`, \`col\`),
        INDEX \`SeatingAssignment_studentId_idx\`(\`studentId\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`SeatingAssignment\`
      ADD CONSTRAINT \`SeatingAssignment_sessionId_fkey\`
      FOREIGN KEY (\`sessionId\`) REFERENCES \`SeatingSession\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`SeatingAssignment\`
      ADD CONSTRAINT \`SeatingAssignment_studentId_fkey\`
      FOREIGN KEY (\`studentId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  if (!hasSession || !hasAssignment) {
    console.log("[startup] Seating schema ready.");
  }
}
