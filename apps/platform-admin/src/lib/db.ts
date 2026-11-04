import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDatabaseConfig } from "@calcart/config";
import { createDatabase, type Database } from "@calcart/db";

declare global {
  var __calcart_admin_db: Database | undefined;
}

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;

  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../../apps/web/.env.local"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const content = readFileSync(candidate, "utf-8");
        for (const line of content.split("\n")) {
          const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
          if (match && match[1]) {
            process.env.DATABASE_URL = match[1].replace(/^["']|["']$/g, "").trim();
            return;
          }
        }
      } catch {
        // Continue to next candidate
      }
    }
  }

  // Fallback to standard local development connection string
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/calcart_dev";
}

export function getDb(): Database {
  if (globalThis.__calcart_admin_db) {
    return globalThis.__calcart_admin_db;
  }

  ensureDatabaseUrl();

  const config = getDatabaseConfig();
  const db = createDatabase(config);

  globalThis.__calcart_admin_db = db;

  return db;
}
