import { existsSync } from "node:fs";
import path from "node:path";
import { createDatabase, type Database } from "@calcart/db";

const ADMIN_DATABASE = "postgres";

export function requireDatabaseUrl(): string {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) {
    const envFile = path.resolve(process.cwd(), ".env");
    if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
      try {
        process.loadEnvFile(envFile);
        url = process.env.DATABASE_URL?.trim();
      } catch {
        // Ignore errors reading local .env
      }
    }
  }

  if (!url) {
    throw new Error(
      "BLOCKED: DATABASE_URL is required for PostgreSQL integration tests"
    );
  }
  return url;
}

function withDatabaseName(connectionUrl: string, databaseName: string): string {
  const parsed = new URL(connectionUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error("Invalid database identifier");
  }
  return `"${identifier}"`;
}

export async function createIsolatedDatabase(): Promise<{
  database: Database;
  databaseName: string;
  close: () => Promise<void>;
}> {
  const sourceUrl = requireDatabaseUrl();
  const databaseName = `calcart_test_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const admin = createDatabase({ url: withDatabaseName(sourceUrl, ADMIN_DATABASE) });

  try {
    await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  } finally {
    await admin.close();
  }

  const database = createDatabase({ url: withDatabaseName(sourceUrl, databaseName) });
  let closed = false;

  return {
    database,
    databaseName,
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      try {
        await database.close();
      } catch {
        // Pool may already be shut down by the test.
      }
      const cleanup = createDatabase({
        url: withDatabaseName(sourceUrl, ADMIN_DATABASE),
      });
      try {
        await cleanup.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()
        `, [databaseName]);
        await cleanup.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
      } finally {
        await cleanup.close();
      }
    },
  };
}
