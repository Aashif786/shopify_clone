import { getDatabaseConfig } from "@calcart/config";
import { createDatabase, type Database } from "@calcart/db";

declare global {
  var __calcart_web_db: Database | undefined;
}

export function getDb(): Database {
  if (globalThis.__calcart_web_db) {
    return globalThis.__calcart_web_db;
  }

  const config = getDatabaseConfig();
  const db = createDatabase(config);

  globalThis.__calcart_web_db = db;

  return db;
}

export async function closeDb(): Promise<void> {
  const db = globalThis.__calcart_web_db;
  if (db) {
    await db.close();
    globalThis.__calcart_web_db = undefined;
  }
}
