import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { dedupeStudentsForTeacher } from "../src/dedupeStudents.js";

async function main() {
  const teacherEmail = process.env.TEACHER_EMAIL ?? "seribamont@gmail.com";
  const teacher = await prisma.user.findFirst({
    where: { email: teacherEmail, role: "TEACHER" },
  });
  if (!teacher) {
    console.error(`No se encontró docente: ${teacherEmail}`);
    process.exit(1);
  }

  const { removed, details } = await dedupeStudentsForTeacher(teacher.id);
  for (const line of details) console.log(line);
  console.log(`Listo. Alumnos duplicados eliminados: ${removed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
