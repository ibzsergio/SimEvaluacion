import { prisma } from "./prisma.js";

async function execOptional(sql: string, ignore = /Duplicate|already exists|errno: 1060|errno: 1061|Unknown table/i) {
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

const CREATE_CRUD = `
  CREATE TABLE IF NOT EXISTS \`CrudDelivery\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`groupId\` VARCHAR(191) NOT NULL,
    \`teamKey\` VARCHAR(191) NOT NULL,
    \`teamName\` VARCHAR(191) NOT NULL,
    \`fileName\` VARCHAR(191) NOT NULL,
    \`mimeType\` VARCHAR(191) NOT NULL,
    \`fileData\` LONGBLOB NOT NULL,
    \`sizeBytes\` INTEGER NOT NULL,
    \`uploadedById\` VARCHAR(191) NOT NULL,
    \`uploadedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`CrudDelivery_groupId_teamKey_key\`(\`groupId\`, \`teamKey\`),
    INDEX \`CrudDelivery_groupId_idx\`(\`groupId\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

export async function ensureCrudSchema() {
  console.log("[startup] Ensuring TEST CRUD schema...");
  const legacy = (await columnExists("CrudDelivery", "studentId")) && !(await columnExists("CrudDelivery", "teamKey"));
  if (legacy) await execOptional("DROP TABLE `CrudDelivery`");
  await execOptional(CREATE_CRUD);
  console.log("[startup] TEST CRUD schema ready.");
}
