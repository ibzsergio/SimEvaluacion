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
  return jwt.sign(input, secret, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  const decoded = jwt.verify(token, secret);
  return JwtPayloadSchema.parse(decoded);
}

/** Permite renovar la sesión aunque el token haya caducado hace poco (hasta 3 días). */
export function verifyAuthTokenForRefresh(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  const decoded = jwt.verify(token, secret, { ignoreExpiration: true });
  const payload = JwtPayloadSchema.parse(decoded);
  const exp = (jwt.decode(token) as { exp?: number } | null)?.exp;
  if (exp && exp * 1000 < Date.now() - 3 * 24 * 60 * 60 * 1000) {
    throw new Error("token_too_old");
  }
  return payload;
}

