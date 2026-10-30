import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations } from "@calcart/db";
import {
  ForbiddenError,
  hasRoleAtLeast,
  requireStoreAccess,
  resolveStoreMembership,
} from "@calcart/tenant";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Tenant and Store Authorization", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  describe("Role hierarchy checks", () => {
    it("evaluates role levels correctly", () => {
      // Owner satisfies all roles
      expect(hasRoleAtLeast("owner", "owner")).toBe(true);
      expect(hasRoleAtLeast("owner", "admin")).toBe(true);
      expect(hasRoleAtLeast("owner", "staff")).toBe(true);

      // Admin satisfies admin and staff, but not owner
      expect(hasRoleAtLeast("admin", "owner")).toBe(false);
      expect(hasRoleAtLeast("admin", "admin")).toBe(true);
      expect(hasRoleAtLeast("admin", "staff")).toBe(true);

      // Staff only satisfies staff
      expect(hasRoleAtLeast("staff", "owner")).toBe(false);
      expect(hasRoleAtLeast("staff", "admin")).toBe(false);
      expect(hasRoleAtLeast("staff", "staff")).toBe(true);
    });
  });

  describe("Store membership and tenant boundary enforcement", () => {
    async function setupTestDb() {
      const isolated = await createIsolatedDatabase();
      close = isolated.close;
      await runMigrations(isolated.database);
      return isolated.database;
    }

    async function seedTenantFixture(db: Awaited<ReturnType<typeof setupTestDb>>) {
      const orgId = generateUuidV7();
      await db.query(
        "INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')",
        [orgId, "Acme Corp"]
      );

      const storeAId = generateUuidV7();
      await db.query(
        `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
         VALUES ($1, $2, 'Store A', 'store-a', 'ACTIVE', 'USD', 'en-US', 'UTC')`,
        [storeAId, orgId]
      );

      const storeBId = generateUuidV7();
      await db.query(
        `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
         VALUES ($1, $2, 'Store B', 'store-b', 'ACTIVE', 'USD', 'en-US', 'UTC')`,
        [storeBId, orgId]
      );

      const userOwnerId = generateUuidV7();
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, status)
         VALUES ($1, 'owner@acme.com', 'Owner', 'scrypt:dummy:hash', 'ACTIVE')`,
        [userOwnerId]
      );

      const userStaffId = generateUuidV7();
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, status)
         VALUES ($1, 'staff@acme.com', 'Staff', 'scrypt:dummy:hash', 'ACTIVE')`,
        [userStaffId]
      );

      const userUnrelatedId = generateUuidV7();
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, status)
         VALUES ($1, 'outsider@other.com', 'Outsider', 'scrypt:dummy:hash', 'ACTIVE')`,
        [userUnrelatedId]
      );

      // Add memberships in Store A: userOwnerId as owner, userStaffId as staff
      await db.query(
        `INSERT INTO store_memberships (id, store_id, user_id, role, status)
         VALUES ($1, $2, $3, 'owner', 'ACTIVE')`,
        [generateUuidV7(), storeAId, userOwnerId]
      );

      await db.query(
        `INSERT INTO store_memberships (id, store_id, user_id, role, status)
         VALUES ($1, $2, $3, 'staff', 'ACTIVE')`,
        [generateUuidV7(), storeAId, userStaffId]
      );

      return {
        orgId,
        storeAId,
        storeBId,
        userOwnerId,
        userStaffId,
        userUnrelatedId,
      };
    }

    it("resolves active membership for valid user", async () => {
      const db = await setupTestDb();
      const { storeAId, userOwnerId } = await seedTenantFixture(db);

      const membership = await resolveStoreMembership(db, storeAId, userOwnerId);
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe("owner");
      expect(membership?.storeId).toBe(storeAId);
    });

    it("permits owner to access owner, admin, and staff operations in their store", async () => {
      const db = await setupTestDb();
      const { storeAId, userOwnerId } = await seedTenantFixture(db);

      await expect(requireStoreAccess(db, storeAId, userOwnerId, "owner")).resolves.toBeDefined();
      await expect(requireStoreAccess(db, storeAId, userOwnerId, "admin")).resolves.toBeDefined();
      await expect(requireStoreAccess(db, storeAId, userOwnerId, "staff")).resolves.toBeDefined();
    });

    it("rejects staff user from performing owner-required operations", async () => {
      const db = await setupTestDb();
      const { storeAId, userStaffId } = await seedTenantFixture(db);

      // Staff allowed for staff role
      await expect(requireStoreAccess(db, storeAId, userStaffId, "staff")).resolves.toBeDefined();

      // Staff denied for admin or owner role
      await expect(
        requireStoreAccess(db, storeAId, userStaffId, "admin")
      ).rejects.toThrowError(ForbiddenError);

      await expect(
        requireStoreAccess(db, storeAId, userStaffId, "owner")
      ).rejects.toThrowError(ForbiddenError);
    });

    it("strictly prevents cross-tenant access to another store", async () => {
      const db = await setupTestDb();
      const { storeBId, userOwnerId } = await seedTenantFixture(db);

      // userOwnerId is owner of Store A, but NOT a member of Store B
      await expect(
        requireStoreAccess(db, storeBId, userOwnerId)
      ).rejects.toThrowError(ForbiddenError);
    });

    it("rejects non-member user from accessing store", async () => {
      const db = await setupTestDb();
      const { storeAId, userUnrelatedId } = await seedTenantFixture(db);

      await expect(
        requireStoreAccess(db, storeAId, userUnrelatedId)
      ).rejects.toThrowError(ForbiddenError);
    });

    it("rejects suspended or non-active memberships", async () => {
      const db = await setupTestDb();
      const { storeAId, userStaffId } = await seedTenantFixture(db);

      await db.query(
        "UPDATE store_memberships SET status = 'SUSPENDED' WHERE store_id = $1 AND user_id = $2",
        [storeAId, userStaffId]
      );

      await expect(
        requireStoreAccess(db, storeAId, userStaffId)
      ).rejects.toThrowError(ForbiddenError);
    });
  });
});
