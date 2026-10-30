import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverMigrationFiles,
  runMigrations,
} from "@calcart/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";

async function writeMigrations(
  files: Record<string, string>
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "calcart-migrations-"));
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(path.join(directory, name), sql, "utf8");
  }
  return directory;
}

describe("migration runner", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("discovers and sorts migration files deterministically", async () => {
    const directory = await writeMigrations({
      "0002_later.sql": "SELECT 1;",
      "readme.txt": "ignored",
      "0001_first.sql": "SELECT 1;",
    });

    await expect(discoverMigrationFiles(directory)).resolves.toEqual([
      "0001_first.sql",
      "0002_later.sql",
    ]);
  });

  it("applies pending migrations once and records metadata", async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    const directory = await writeMigrations({
      "0001_create_probe.sql": "CREATE TABLE probe (id TEXT PRIMARY KEY);",
      "0002_insert_probe.sql": "INSERT INTO probe (id) VALUES ('seed');",
    });

    const first = await runMigrations(isolated.database, {
      migrationsDirectory: directory,
      advisoryLockKey: 11_001,
    });
    const second = await runMigrations(isolated.database, {
      migrationsDirectory: directory,
      advisoryLockKey: 11_001,
    });

    expect(first.applied).toEqual(["0001_create_probe.sql", "0002_insert_probe.sql"]);
    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toEqual([
      "0001_create_probe.sql",
      "0002_insert_probe.sql",
    ]);

    const rows = await isolated.database.query<{ id: string }>(
      "SELECT id FROM probe"
    );
    expect(rows.rows.map((row) => row.id)).toEqual(["seed"]);
  });

  it("rolls back a failed migration and does not record it", async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    const directory = await writeMigrations({
      "0001_ok.sql": "CREATE TABLE probe (id TEXT PRIMARY KEY);",
      "0002_bad.sql": "INSERT INTO probe (id) VALUES ('ok'); CREATE TABLE;",
    });

    await expect(
      runMigrations(isolated.database, {
        migrationsDirectory: directory,
        advisoryLockKey: 11_002,
      })
    ).rejects.toThrow();

    const applied = await isolated.database.query<{ id: string }>(
      "SELECT id FROM _migrations ORDER BY id"
    );
    expect(applied.rows.map((row) => row.id)).toEqual(["0001_ok.sql"]);

    const probe = await isolated.database.query<{ id: string }>("SELECT id FROM probe");
    expect(probe.rows).toEqual([]);
  });

  it("serializes concurrent migrators with an advisory lock", async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    const directory = await writeMigrations({
      "0001_slow.sql": `
        CREATE TABLE IF NOT EXISTS lock_probe (
          id TEXT PRIMARY KEY,
          applied_by TEXT NOT NULL
        );
        INSERT INTO lock_probe (id, applied_by)
        VALUES ('only-once', 'migrator');
      `,
    });

    const [first, second] = await Promise.all([
      runMigrations(isolated.database, {
        migrationsDirectory: directory,
        advisoryLockKey: 11_003,
      }),
      runMigrations(isolated.database, {
        migrationsDirectory: directory,
        advisoryLockKey: 11_003,
      }),
    ]);

    const appliedRuns = [first.applied, second.applied].filter(
      (applied) => applied.length > 0
    );
    expect(appliedRuns).toHaveLength(1);

    const rows = await isolated.database.query<{ id: string }>(
      "SELECT id FROM lock_probe"
    );
    expect(rows.rowCount).toBe(1);
  });
});
