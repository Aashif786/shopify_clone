import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { register } from "@shopify-clone/auth";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import {
  ApiHttpError,
  requireAuth,
  requireStore,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api/index.js";

describe("API Tenant & Authorization Guards", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  });

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedStoreWithMember(role: "owner" | "admin" | "staff" = "owner") {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${orgId}`]
    );

    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, `Store ${storeId}`, `store-${storeId}`]
    );

    const user = await register(db, {
      email: `user-${Date.now()}@example.com`,
      password: "secure-password-123",
      name: "Test Tenant User",
    });

    const membershipId = generateUuidV7();
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [membershipId, storeId, user.user.id, role]
    );

    return { orgId, storeId, user };
  }

  it("requireAuth rejects unauthenticated context with 401 AUTHENTICATION_REQUIRED", async () => {
    const req = new Request("http://localhost:3000/api/v1/protected");
    const ctx = await resolveRequestContext(req, { db });

    expect(() => requireAuth(ctx)).toThrowError(ApiHttpError);
    try {
      requireAuth(ctx);
    } catch (err) {
      const httpErr = err as ApiHttpError;
      expect(httpErr.status).toBe(401);
      expect(httpErr.code).toBe("AUTHENTICATION_REQUIRED");
    }
  });

  it("requireStore rejects unauthenticated request with 401", async () => {
    const req = new Request("http://localhost:3000/api/v1/stores/store-123/products");
    const ctx = await resolveRequestContext(req, { db });

    await expect(requireStore(ctx, "store-123")).rejects.toThrowError(ApiHttpError);
  });

  it("requireStore permits authorized store member with sufficient role", async () => {
    const { storeId, user } = await seedStoreWithMember("owner");

    const req = new Request(`http://localhost:3000/api/v1/stores/${storeId}`, {
      headers: {
        Authorization: `Bearer ${user.session.id}`,
      },
    });

    const ctx = await resolveRequestContext(req, { db });
    const membership = await requireStore(ctx, storeId, "admin");

    expect(membership.storeId).toBe(storeId);
    expect(membership.userId).toBe(user.user.id);
    expect(membership.role).toBe("owner");
  });

  it("requireStore rejects member with insufficient role with 403 FORBIDDEN", async () => {
    const { storeId, user } = await seedStoreWithMember("staff");

    const req = new Request(`http://localhost:3000/api/v1/stores/${storeId}/settings`, {
      headers: {
        Authorization: `Bearer ${user.session.id}`,
      },
    });

    const ctx = await resolveRequestContext(req, { db });
    await expect(requireStore(ctx, storeId, "owner")).rejects.toThrowError(
      /Operation requires at least owner role/
    );
  });

  it("requireStore strictly rejects cross-tenant access when user accesses another store", async () => {
    const storeA = await seedStoreWithMember("owner");
    const storeB = await seedStoreWithMember("owner");

    // User A attempts to access Store B
    const req = new Request(`http://localhost:3000/api/v1/stores/${storeB.storeId}/orders`, {
      headers: {
        Authorization: `Bearer ${storeA.user.session.id}`,
      },
    });

    const ctx = await resolveRequestContext(req, { db });
    await expect(requireStore(ctx, storeB.storeId)).rejects.toThrowError(
      /User is not an active member of this store/
    );
  });

  it("requireStoreOrNotFound returns 404 NOT_FOUND instead of 403 to prevent store existence disclosure", async () => {
    const storeA = await seedStoreWithMember("owner");
    const storeB = await seedStoreWithMember("owner");

    const req = new Request(`http://localhost:3000/api/v1/stores/${storeB.storeId}/products`, {
      headers: {
        Authorization: `Bearer ${storeA.user.session.id}`,
      },
    });

    const ctx = await resolveRequestContext(req, { db });
    try {
      await requireStoreOrNotFound(ctx, storeB.storeId);
      expect.unreachable("Should have thrown 404");
    } catch (err) {
      const httpErr = err as ApiHttpError;
      expect(httpErr.status).toBe(404);
      expect(httpErr.code).toBe("NOT_FOUND");
    }
  });
});
