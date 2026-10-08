import { getDatabaseConfig } from "@shopify-clone/config";
import { createDatabase, type Database } from "@shopify-clone/db";

declare global {
  var __shopify_clone_web_db: Database | undefined;
}

export function getDb(): Database {
  if (global.__shopify_clone_web_db) {
    return global.__shopify_clone_web_db;
  }

  const config = getDatabaseConfig();
  const db = createDatabase(config);

  if (process.env.NODE_ENV !== "production") {
    global.__shopify_clone_web_db = db;
  }

  return db;
}

export async function closeDb(): Promise<void> {
  if (global.__shopify_clone_web_db) {
    await global.__shopify_clone_web_db.close();
    global.__shopify_clone_web_db = undefined;
  }
}
