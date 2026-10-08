import { prisma } from "./prisma.js";

async function tableExists(name: string) {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(${name})
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** No se guardan prácticas en el servidor: si la tabla llegó a crearse, se elimina. */
export async function dropPythonPracticeSchema() {
  if (!(await tableExists("PythonPractice"))) return;
  console.log("[startup] Dropping PythonPractice table (no server-side practice storage).");
  try {
    await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `PythonPractice`");
  } catch (err) {
    console.warn("[startup] Could not drop PythonPractice:", err);
  }
}
