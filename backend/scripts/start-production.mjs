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

const dbUrl = resolveDatabaseUrl();
if (!dbUrl) {
  console.error("[startup] Missing DATABASE_URL.");
  console.error("[startup] In Railway: backend service → Variables → Add Reference → MySQL → DATABASE_URL (or MYSQL_URL).");
  process.exit(1);
}

console.log("[startup] Running prisma migrate deploy...");
try {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} catch {
  console.error("[startup] prisma migrate deploy failed.");
  console.error("[startup] Check that MySQL is in the same Railway project and DATABASE_URL is correct.");
  process.exit(1);
}

console.log("[startup] Starting API...");
await import("../dist/index.js");
