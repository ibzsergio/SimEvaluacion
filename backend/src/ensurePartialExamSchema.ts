import { prisma } from "./prisma.js";

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

async function execOptional(
  sql: string,
  ignore = /Duplicate|already exists|Unknown key|Can't DROP|check that it exists|check that column\/key exists|errno: 1060|errno: 1061|errno: 1091|errno: 1826|P2010/i,
) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (ignore.test(msg)) return;
    throw err;
  }
}

/** Garantiza la tabla de calificación de examen del parcial (0–4), una por parcial. */
export async function ensurePartialExamSchema() {
  console.log("[startup] Ensuring partial exam schema...");
  if (!(await tableExists("PartialExamScore"))) {
    await execOptional(`
      CREATE TABLE IF NOT EXISTS \`PartialExamScore\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`groupId\` VARCHAR(191) NOT NULL,
        \`studentId\` VARCHAR(191) NOT NULL,
        \`partialNumber\` INTEGER NOT NULL DEFAULT 1,
        \`examScore4\` DOUBLE NOT NULL,
        \`capturedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`PartialExamScore_groupId_studentId_partialNumber_key\`(\`groupId\`, \`studentId\`, \`partialNumber\`),
        INDEX \`PartialExamScore_groupId_idx\`(\`groupId\`),
        INDEX \`PartialExamScore_studentId_idx\`(\`studentId\`),
        INDEX \`PartialExamScore_groupId_partialNumber_idx\`(\`groupId\`, \`partialNumber\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await execOptional(`
      ALTER TABLE \`PartialExamScore\`
      ADD CONSTRAINT \`PartialExamScore_groupId_fkey\`
      FOREIGN KEY (\`groupId\`) REFERENCES \`ClassGroup\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await execOptional(`
      ALTER TABLE \`PartialExamScore\`
      ADD CONSTRAINT \`PartialExamScore_studentId_fkey\`
      FOREIGN KEY (\`studentId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  if (!(await columnExists("PartialExamScore", "partialNumber"))) {
    await execOptional(
      "ALTER TABLE `PartialExamScore` ADD COLUMN `partialNumber` INTEGER NOT NULL DEFAULT 1",
    );
  }
  await execOptional(
    "ALTER TABLE `PartialExamScore` DROP INDEX `PartialExamScore_groupId_studentId_key`",
  );
  await execOptional(
    "CREATE UNIQUE INDEX `PartialExamScore_groupId_studentId_partialNumber_key` ON `PartialExamScore` (`groupId`, `studentId`, `partialNumber`)",
  );
  await execOptional(
    "CREATE INDEX `PartialExamScore_groupId_partialNumber_idx` ON `PartialExamScore` (`groupId`, `partialNumber`)",
  );

  console.log("[startup] Partial exam schema ready.");
}
