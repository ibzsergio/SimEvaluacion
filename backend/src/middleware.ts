import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./auth.js";

export type AuthedRequest = Request & {
  auth?: { userId: string; role: "TEACHER" | "STUDENT" };
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "missing_token" });
  try {
    const payload = verifyAuthToken(header.slice("Bearer ".length));
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function requireTeacher(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "missing_token" });
  if (req.auth.role !== "TEACHER") return res.status(403).json({ error: "forbidden" });
  next();
}

export function requireStudent(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "missing_token" });
  if (req.auth.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });
  next();
}

