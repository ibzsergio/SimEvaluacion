import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.error("[startup] Missing DATABASE_URL. Link the MySQL service in Railway Variables.");
  process.exit(1);
}

console.log("[startup] Running prisma migrate deploy...");
try {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} catch {
  console.error("[startup] prisma migrate deploy failed. Check DATABASE_URL and that MySQL is running.");
  process.exit(1);
}

console.log("[startup] Starting API...");
await import("../dist/index.js");
