import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@calcart/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("database health and lifecycle", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("reports healthy connectivity without exposing secrets", async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;

    const health = await isolated.database.healthCheck();
    expect(health).toEqual({ ok: true });
    expect(JSON.stringify(health)).not.toMatch(/postgres|password|DATABASE_URL/i);
  });

  it("reports unhealthy connectivity without exposing credentials", async () => {
    const database = createDatabase({
      url: "postgresql://calcart:supersecret@127.0.0.1:1/missing",
    });

    try {
      const health = await database.healthCheck();
      expect(health).toEqual({ ok: false });
      expect(JSON.stringify(health)).not.toContain("supersecret");
    } finally {
      await database.close();
    }
  });

  it("closes the pool on shutdown", async () => {
    const isolated = await createIsolatedDatabase();
    close = undefined;

    await isolated.database.healthCheck();
    await isolated.database.close();

    await expect(isolated.database.query("SELECT 1")).rejects.toThrow();
    await isolated.close();
  });
});
