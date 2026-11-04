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

  // Fallback to primary database connection string
  process.env.DATABASE_URL =
    "postgresql://neondb_owner:npg_SoWl4MDV1hAE@ep-patient-dawn-b4bccg1r-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
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
