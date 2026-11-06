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

export async function ensureExamSchema() {
  console.log("[startup] Ensuring examen schema...");
  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`ExamDelivery\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`groupId\` VARCHAR(191) NOT NULL,
      \`studentId\` VARCHAR(191) NOT NULL,
      \`fileName\` VARCHAR(191) NOT NULL,
      \`mimeType\` VARCHAR(191) NOT NULL,
      \`fileData\` LONGBLOB NOT NULL,
      \`sizeBytes\` INTEGER NOT NULL,
      \`uploadedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`ExamDelivery_groupId_studentId_key\`(\`groupId\`, \`studentId\`),
      INDEX \`ExamDelivery_groupId_idx\`(\`groupId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log("[startup] Examen schema ready.");
}
