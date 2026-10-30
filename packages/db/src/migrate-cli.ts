import { existsSync } from "node:fs";
import path from "node:path";
import { getDatabaseConfig } from "@calcart/config";
import { createDatabase } from "./database.js";
import { getMigrationStatus, runMigrations } from "./migrate.js";

import { fileURLToPath } from "node:url";

async function main(): Promise<void> {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
  ];

  if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        try {
          process.loadEnvFile(candidate);
          if (process.env.DATABASE_URL) {
            break;
          }
        } catch {
          // Ignore errors reading local .env
        }
      }
    }
  }

  const args = process.argv.slice(2);
  const statusOnly = args.includes("--status");
  const config = getDatabaseConfig();
  const database = createDatabase(config);

  try {
    if (statusOnly) {
      const status = await getMigrationStatus(database);
      for (const applied of status.applied) {
        process.stdout.write(`applied\t${applied.id}\n`);
      }
      for (const pending of status.pending) {
        process.stdout.write(`pending\t${pending}\n`);
      }
      return;
    }

    const result = await runMigrations(database);
    if (result.applied.length === 0) {
      process.stdout.write("No pending migrations.\n");
      return;
    }

    for (const id of result.applied) {
      process.stdout.write(`applied ${id}\n`);
    }
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  const safeMessage = /\/\/[^/\s]+:[^/\s]+@/i.test(message)
    ? "database error"
    : message;
  process.stderr.write(`Migration failed: ${safeMessage}\n`);
  process.exitCode = 1;
});
