import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database, DatabaseClient } from "./database.js";

export const MIGRATION_ADVISORY_LOCK_KEY = 7_421_903_384;

const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

export interface MigrationRecord {
  id: string;
  appliedAt: Date;
}

export interface MigrationRunResult {
  applied: string[];
  alreadyApplied: string[];
}

export interface RunMigrationsOptions {
  migrationsDirectory?: string;
  advisoryLockKey?: number;
}

export function defaultMigrationsDirectory(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
}

export async function discoverMigrationFiles(
  migrationsDirectory: string
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(migrationsDirectory);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return entries
    .filter((name) => MIGRATION_FILE_PATTERN.test(name))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client: DatabaseClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function listAppliedMigrationIds(client: DatabaseClient): Promise<Set<string>> {
  const result = await client.query<{ id: string }>("SELECT id FROM _migrations");
  return new Set(result.rows.map((row) => row.id));
}

async function applyMigration(
  client: DatabaseClient,
  migrationId: string,
  sql: string
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO _migrations (id) VALUES ($1)", [migrationId]);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original migration error.
    }
    throw error;
  }
}

export async function runMigrations(
  database: Database,
  options: RunMigrationsOptions = {}
): Promise<MigrationRunResult> {
  const migrationsDirectory =
    options.migrationsDirectory ?? defaultMigrationsDirectory();
  const advisoryLockKey = options.advisoryLockKey ?? MIGRATION_ADVISORY_LOCK_KEY;
  const files = await discoverMigrationFiles(migrationsDirectory);

  return database.withExclusiveConnection(async (client) => {
    await client.query("SELECT pg_advisory_lock($1)", [advisoryLockKey]);
    try {
      await ensureMigrationsTable(client);
      const appliedIds = await listAppliedMigrationIds(client);
      const alreadyApplied = files.filter((file) => appliedIds.has(file));
      const pending = files.filter((file) => !appliedIds.has(file));
      const applied: string[] = [];

      for (const file of pending) {
        const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
        await applyMigration(client, file, sql);
        applied.push(file);
      }

      return { applied, alreadyApplied };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [advisoryLockKey]);
    }
  });
}

export async function getMigrationStatus(
  database: Database,
  options: RunMigrationsOptions = {}
): Promise<{ applied: MigrationRecord[]; pending: string[] }> {
  const migrationsDirectory =
    options.migrationsDirectory ?? defaultMigrationsDirectory();
  const files = await discoverMigrationFiles(migrationsDirectory);

  await database.withExclusiveConnection(async (client) => {
    await ensureMigrationsTable(client);
    return undefined;
  });

  const result = await database.query<{ id: string; applied_at: Date }>(
    "SELECT id, applied_at FROM _migrations ORDER BY id ASC"
  );
  const applied = result.rows.map((row) => ({
    id: row.id,
    appliedAt: row.applied_at,
  }));
  const appliedIds = new Set(applied.map((row) => row.id));
  const pending = files.filter((file) => !appliedIds.has(file));

  return { applied, pending };
}
