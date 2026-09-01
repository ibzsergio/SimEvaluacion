import { execSync } from "node:child_process";

function migrationOutput(err: unknown) {
  if (!err || typeof err !== "object") return String(err);
  const e = err as { stdout?: string; stderr?: string; message?: string };
  return `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}${String(err)}`;
}

function extractFailedMigration(output: string) {
  const match = output.match(/The `(\d+_[\w_]+)` migration/);
  return match?.[1] ?? null;
}

export function runMigrationsWithRecovery() {
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
