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

export async function ensureBasedatosSchema() {
  console.log("[startup] Ensuring base de datos schema...");
  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`TeamDelivery\` (
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
      UNIQUE INDEX \`TeamDelivery_groupId_teamKey_key\`(\`groupId\`, \`teamKey\`),
      INDEX \`TeamDelivery_groupId_idx\`(\`groupId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log("[startup] Base de datos schema ready.");
}
