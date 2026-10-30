import { describe, it, expect, afterEach } from "vitest";
import { generateUuidV7 } from "@calcart/db";
import { StoreService } from "@calcart/stores";
import { ForbiddenError } from "@calcart/tenant";
import { runMigrations } from "@calcart/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Store Domains Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb() {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function createTestUser(
    db: Awaited<ReturnType<typeof setupDb>>,
    email = "merchant@example.com",
  ): Promise<string> {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [userId, email, "Test User", "hashed_password"],
    );
    return userId;
  }

  it("retrieves the assigned platform subdomain and domain details for authorized merchant", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "owner@example.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "Domain Test Store",
      slug: "domain-test-store",
      status: "ACTIVE",
    });

    const res = await storeService.getStoreDomains(db, store.id, ownerId);

    expect(res).toBeDefined();
    expect(res.assignedSubdomain).toBe("domain-test-store");
    expect(res.basePlatformDomain).toBe("calcart.com");
    expect(res.assignedDomain).toBe("domain-test-store.calcart.com");
    expect(res.domains.length).toBeGreaterThanOrEqual(1);

    const primarySubdomain = res.domains.find((d) => d.type === "SUBDOMAIN" && d.isPrimary);
    expect(primarySubdomain).toBeDefined();
    expect(primarySubdomain?.status).toBe("ACTIVE");
    expect(primarySubdomain?.subdomain).toBe("domain-test-store");
  });

  it("strictly enforces tenant boundary: unauthorized merchant cannot inspect domains of another store", async () => {
    const db = await setupDb();
    const ownerA = await createTestUser(db, "owner-a@example.com");
    const userB = await createTestUser(db, "user-b@example.com");

    const store = await storeService.createStore(db, ownerA, {
      name: "Store A",
      slug: "store-a",
      status: "ACTIVE",
    });

    await expect(
      storeService.getStoreDomains(db, store.id, userB),
    ).rejects.toThrow(ForbiddenError);
  });

  it("resolves store by verified active domain", async () => {
    const db = await setupDb();
    const owner = await createTestUser(db, "resolver@example.com");

    const store = await storeService.createStore(db, owner, {
      name: "Resolvable Store",
      slug: "resolvable-store",
      status: "ACTIVE",
    });

    const domainsRes = await storeService.getStoreDomains(db, store.id, owner);
    const resolved = await storeService.resolveStoreByDomain(db, domainsRes.assignedDomain);

    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(store.id);
    expect(resolved?.slug).toBe("resolvable-store");
  });

  it("returns null when resolving an unregistered or unknown domain", async () => {
    const db = await setupDb();
    const resolved = await storeService.resolveStoreByDomain(db, "unknown-store-12345.calcart.com");
    expect(resolved).toBeNull();
  });
});
