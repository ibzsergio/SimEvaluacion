import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma.js";
import { ensureTeacherGroups } from "../src/groups.js";

/**
 * Crea o actualiza el docente en producción.
 * Uso (Railway shell o local apuntando a prod):
 *   TEACHER_PASSWORD="tu-clave" npm run seed:teacher
 */
async function main() {
  const email = process.env.TEACHER_EMAIL ?? "seribamont@gmail.com";
  const password = process.env.TEACHER_PASSWORD;
  const displayName = process.env.TEACHER_NAME ?? "Sergio Ibañez Montiel";

  if (!password || password.length < 4) {
    console.error("Define TEACHER_PASSWORD (mín. 4 caracteres). Ejemplo:");
    console.error('  TEACHER_PASSWORD="..." npm run seed:teacher');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const teacher = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      passwordSet: true,
      role: "TEACHER",
      displayName,
    },
    create: {
      email,
      passwordHash,
      passwordSet: true,
      role: "TEACHER",
      displayName,
    },
  });

  await ensureTeacherGroups(teacher.id);

  console.log(`Docente listo: ${email}`);
  console.log("Grupos 201 y 202 creados. Importa alumnos desde el panel.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
