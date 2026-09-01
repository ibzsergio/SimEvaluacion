import { execSync } from "node:child_process";

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const direct = ["MYSQL_URL", "MYSQL_PUBLIC_URL", "MYSQL_PRIVATE_URL"];
  for (const key of direct) {
    const value = process.env[key]?.trim();
    if (value) {
      process.env.DATABASE_URL = value;
      console.log(`[startup] DATABASE_URL set from ${key}`);
      return value;
    }
  }

  const host = process.env.MYSQLHOST ?? process.env.MYSQL_HOST;
  const port = process.env.MYSQLPORT ?? process.env.MYSQL_PORT ?? "3306";
  const user = process.env.MYSQLUSER ?? process.env.MYSQL_USER ?? "root";
  const password = process.env.MYSQLPASSWORD ?? process.env.MYSQL_PASSWORD ?? "";
  const database = process.env.MYSQLDATABASE ?? process.env.MYSQL_DATABASE ?? "railway";

  if (host) {
    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(password);
    const url = `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;
    process.env.DATABASE_URL = url;
    console.log("[startup] DATABASE_URL built from MYSQLHOST/MYSQLUSER/MYSQLDATABASE");
    return url;
  }

  return null;
}

function migrationOutput(err) {
  if (!err || typeof err !== "object") return String(err);
  return `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}${String(err)}`;
}

function extractFailedMigration(output) {
  const match = output.match(/The `(\d+_[\w_]+)` migration/);
  return match?.[1] ?? null;
}

function runMigrationsWithRecovery() {
  console.log("[startup] Running prisma migrate deploy...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "pipe", encoding: "utf8" });
    console.log("[startup] Migrations complete.");
    return;
  } catch (err) {
    const output = migrationOutput(err);
    const failed = extractFailedMigration(output);
    if (output.includes("P3009") && failed) {
      console.log(`[startup] Recovering failed migration ${failed}...`);
      execSync(`npx prisma migrate resolve --rolled-back ${failed}`, { stdio: "inherit" });
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("[startup] Migrations complete after recovery.");
      return;
    }
    console.error(output);
    throw err;
  }
}

const dbUrl = resolveDatabaseUrl();
if (!dbUrl) {
  console.error("[startup] Missing DATABASE_URL.");
  console.error("[startup] In Railway: backend service → Variables → Add Reference → MySQL → DATABASE_URL (or MYSQL_URL).");
  process.exit(1);
}

try {
  runMigrationsWithRecovery();
} catch {
  console.warn("[startup] prisma migrate deploy failed; index bootstrap will repair seating schema.");
}

console.log("[startup] Starting API...");
await import("../dist/index.js");
