import { prisma } from "./prisma.js";
import { ensure301MarkedRoles } from "./skillSurveyService.js";

async function tableExists(name: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(${name})
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function execOptional(sql: string, ignore = /Duplicate|already exists|errno: 1061|errno: 1826|errno: 1060/i) {
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

async function ensureProjectRoleColumns() {
  if (!(await columnExists("SkillSurveyResponse", "assignedRole"))) {
    await execOptional("ALTER TABLE `SkillSurveyResponse` ADD COLUMN `assignedRole` VARCHAR(191) NULL");
  }
  if (!(await columnExists("ProjectTeam", "leaderId"))) {
    await execOptional("ALTER TABLE `ProjectTeam` ADD COLUMN `leaderId` VARCHAR(191) NULL");
    await execOptional("CREATE INDEX `ProjectTeam_leaderId_idx` ON `ProjectTeam`(`leaderId`)");
    await execOptional(`
      ALTER TABLE \`ProjectTeam\`
      ADD CONSTRAINT \`ProjectTeam_leaderId_fkey\`
      FOREIGN KEY (\`leaderId\`) REFERENCES \`User\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
}

export async function ensureSkillSurveySchema() {
  console.log("[startup] Ensuring skill survey schema...");
  const hasSurvey = await tableExists("SkillSurveyResponse");
  const hasTeam = await tableExists("ProjectTeam");
  const hasMember = await tableExists("ProjectTeamMember");
  if (hasSurvey && hasTeam && hasMember) {
    await ensureProjectRoleColumns();
    try {
      await ensure301MarkedRoles();
    } catch (err) {
      console.warn("[startup] 301 marked roles skipped:", err);
    }
    console.log("[startup] Skill survey schema already ready.");
    return;
  }

  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`SkillSurveyResponse\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`studentId\` VARCHAR(191) NOT NULL,
      \`groupId\` VARCHAR(191) NOT NULL,
      \`answers\` JSON NOT NULL,
      \`scores\` JSON NOT NULL,
      \`suggestedRole\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`SkillSurveyResponse_studentId_key\`(\`studentId\`),
      INDEX \`SkillSurveyResponse_groupId_idx\`(\`groupId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`ProjectTeam\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`groupId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`createdById\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`ProjectTeam_groupId_idx\`(\`groupId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await execOptional(`
    CREATE TABLE IF NOT EXISTS \`ProjectTeamMember\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`teamId\` VARCHAR(191) NOT NULL,
      \`studentId\` VARCHAR(191) NOT NULL,
      \`role\` VARCHAR(191) NOT NULL,
      UNIQUE INDEX \`ProjectTeamMember_studentId_key\`(\`studentId\`),
      INDEX \`ProjectTeamMember_teamId_idx\`(\`teamId\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await execOptional(`
    ALTER TABLE \`SkillSurveyResponse\`
    ADD CONSTRAINT \`SkillSurveyResponse_studentId_fkey\`
    FOREIGN KEY (\`studentId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`SkillSurveyResponse\`
    ADD CONSTRAINT \`SkillSurveyResponse_groupId_fkey\`
    FOREIGN KEY (\`groupId\`) REFERENCES \`ClassGroup\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`ProjectTeam\`
    ADD CONSTRAINT \`ProjectTeam_groupId_fkey\`
    FOREIGN KEY (\`groupId\`) REFERENCES \`ClassGroup\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`ProjectTeam\`
    ADD CONSTRAINT \`ProjectTeam_createdById_fkey\`
    FOREIGN KEY (\`createdById\`) REFERENCES \`User\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`ProjectTeamMember\`
    ADD CONSTRAINT \`ProjectTeamMember_teamId_fkey\`
    FOREIGN KEY (\`teamId\`) REFERENCES \`ProjectTeam\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);
  await execOptional(`
    ALTER TABLE \`ProjectTeamMember\`
    ADD CONSTRAINT \`ProjectTeamMember_studentId_fkey\`
    FOREIGN KEY (\`studentId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  `);

  await ensureProjectRoleColumns();
  try {
    await ensure301MarkedRoles();
  } catch (err) {
    console.warn("[startup] 301 marked roles skipped:", err);
  }
  console.log("[startup] Skill survey schema ready.");
}
