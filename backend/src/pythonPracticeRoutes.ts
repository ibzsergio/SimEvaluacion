import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { requireAuth, type AuthedRequest } from "./middleware.js";

const MAX_PRACTICES = 40;
const MAX_CODE_CHARS = 80_000;

const saveBody = z.object({
  title: z.string().trim().min(1).max(120),
  code: z.string().max(MAX_CODE_CHARS),
});

type PracticeRow = {
  id: string;
  title: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
};

function toItem(row: { id: string; title: string; updatedAt: Date; createdAt: Date }) {
  return {
    id: row.id,
    title: row.title,
    updatedAt: new Date(row.updatedAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export const pythonPracticeRouter = Router();
pythonPracticeRouter.use(requireAuth);

pythonPracticeRouter.get("/", async (req: AuthedRequest, res) => {
  const items = await prisma.$queryRaw<Array<Omit<PracticeRow, "code">>>`
    SELECT id, title, createdAt, updatedAt
    FROM PythonPractice
    WHERE userId = ${req.auth!.userId}
    ORDER BY updatedAt DESC
  `;
  return res.json({ items: items.map(toItem), limit: MAX_PRACTICES });
});

pythonPracticeRouter.get("/:id", async (req: AuthedRequest, res) => {
  const id = String(req.params.id ?? "");
  const rows = await prisma.$queryRaw<PracticeRow[]>`
    SELECT id, title, code, createdAt, updatedAt
    FROM PythonPractice
    WHERE id = ${id} AND userId = ${req.auth!.userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "practice_not_found" });
  return res.json({ ...toItem(row), code: row.code });
});

pythonPracticeRouter.post("/", async (req: AuthedRequest, res) => {
  if (typeof req.body?.code === "string" && req.body.code.length > MAX_CODE_CHARS) {
    return res.status(400).json({ error: "code_too_large" });
  }
  const body = saveBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const countRows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt FROM PythonPractice WHERE userId = ${req.auth!.userId}
  `;
  if (Number(countRows[0]?.cnt ?? 0) >= MAX_PRACTICES) {
    return res.status(400).json({
      error: "practice_limit",
      message: `Puedes guardar hasta ${MAX_PRACTICES} prácticas. Elimina una para hacer espacio.`,
    });
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO PythonPractice (id, userId, title, code, createdAt, updatedAt)
    VALUES (${id}, ${req.auth!.userId}, ${body.data.title}, ${body.data.code}, NOW(3), NOW(3))
  `;
  const rows = await prisma.$queryRaw<PracticeRow[]>`
    SELECT id, title, code, createdAt, updatedAt FROM PythonPractice WHERE id = ${id} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return res.status(500).json({ error: "practice_not_found" });
  return res.status(201).json({ ...toItem(row), code: row.code });
});

pythonPracticeRouter.put("/:id", async (req: AuthedRequest, res) => {
  if (typeof req.body?.code === "string" && req.body.code.length > MAX_CODE_CHARS) {
    return res.status(400).json({ error: "code_too_large" });
  }
  const body = saveBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const id = String(req.params.id ?? "");
  const updated = await prisma.$executeRaw`
    UPDATE PythonPractice
    SET title = ${body.data.title}, code = ${body.data.code}, updatedAt = NOW(3)
    WHERE id = ${id} AND userId = ${req.auth!.userId}
  `;
  if (Number(updated) === 0) return res.status(404).json({ error: "practice_not_found" });

  const rows = await prisma.$queryRaw<PracticeRow[]>`
    SELECT id, title, code, createdAt, updatedAt FROM PythonPractice WHERE id = ${id} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "practice_not_found" });
  return res.json({ ...toItem(row), code: row.code });
});

pythonPracticeRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const id = String(req.params.id ?? "");
  const deleted = await prisma.$executeRaw`
    DELETE FROM PythonPractice WHERE id = ${id} AND userId = ${req.auth!.userId}
  `;
  if (Number(deleted) === 0) return res.status(404).json({ error: "practice_not_found" });
  return res.json({ ok: true, deletedId: id });
});
