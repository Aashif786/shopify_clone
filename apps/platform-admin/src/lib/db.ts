import { getDatabaseConfig } from "@calcart/config";
import { createDatabase, type Database } from "@calcart/db";

declare global {
  var __calcart_admin_db: Database | undefined;
}

export function getDb(): Database {
  if (globalThis.__calcart_admin_db) {
    return globalThis.__calcart_admin_db;
  }

  const config = getDatabaseConfig();
  const db = createDatabase(config);

  globalThis.__calcart_admin_db = db;

  return db;
}
