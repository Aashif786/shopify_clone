import { getDatabaseConfig } from "@shopify-clone/config";
import { createDatabase, type Database } from "@shopify-clone/db";

declare global {
  var __shopify_clone_web_db: Database | undefined;
}

export function getDb(): Database {
  if (globalThis.__shopify_clone_web_db) {
    return globalThis.__shopify_clone_web_db;
  }

  const config = getDatabaseConfig();
  const db = createDatabase(config);

  globalThis.__shopify_clone_web_db = db;

  return db;
}

export async function closeDb(): Promise<void> {
  const db = globalThis.__shopify_clone_web_db;
  if (db) {
    await db.close();
    globalThis.__shopify_clone_web_db = undefined;
  }
}
