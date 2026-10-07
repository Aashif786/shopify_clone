import { afterEach, describe, expect, it } from "vitest";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("database transactions", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("commits successful work and releases the client", async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    const { database } = isolated;

    await database.query("CREATE TABLE tx_probe (id TEXT PRIMARY KEY)");

    const inserted = await database.withTransaction(async (client) => {
      await client.query("INSERT INTO tx_probe (id) VALUES ($1)", ["ok"]);
      const result = await client.query<{ id: string }>(
        "SELECT id FROM tx_probe WHERE id = $1",
        ["ok"]
      );
      return result.rows[0]?.id;
    });

    expect(inserted).toBe("ok");
    const persisted = await database.query<{ id: string }>("SELECT id FROM tx_probe");
    expect(persisted.rows.map((row) => row.id)).toEqual(["ok"]);

    const stats = database.getPoolStats();
    expect(stats.idleCount).toBe(stats.totalCount);
    expect(stats.waitingCount).toBe(0);
  });

  it("rolls back on failure and still releases the client", async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    const { database } = isolated;

    await database.query("CREATE TABLE tx_probe (id TEXT PRIMARY KEY)");
    const failure = new Error("boom");

    await expect(
      database.withTransaction(async (client) => {
        await client.query("INSERT INTO tx_probe (id) VALUES ($1)", ["partial"]);
        throw failure;
      })
    ).rejects.toBe(failure);

    const persisted = await database.query<{ id: string }>("SELECT id FROM tx_probe");
    expect(persisted.rows).toEqual([]);

    const stats = database.getPoolStats();
    expect(stats.idleCount).toBe(stats.totalCount);
    expect(stats.waitingCount).toBe(0);
  });
});
