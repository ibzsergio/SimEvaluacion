import jwt from "jsonwebtoken";
import { z } from "zod";

const JwtPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(["TEACHER", "STUDENT"]),
});

export type AuthTokenPayload = z.infer<typeof JwtPayloadSchema>;

export function signAuthToken(input: AuthTokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(input, secret, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  const decoded = jwt.verify(token, secret);
  return JwtPayloadSchema.parse(decoded);
}

