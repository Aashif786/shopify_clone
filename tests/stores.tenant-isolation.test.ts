import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations } from "@shopify-clone/db";
import { ForbiddenError } from "@shopify-clone/tenant";
import { StoreService } from "@shopify-clone/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe(
  "Stores Tenant Isolation & Authorization Boundary",
  { timeout: 30_000 },
  () => {
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
      email: string,
    ) {
      const userId = generateUuidV7();
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'User', 'scrypt:hash', 'ACTIVE')`,
        [userId, email],
      );
      return userId;
    }

    it("permits store owner to perform all store operations in their store", async () => {
      const db = await setupDb();
      const ownerId = await createTestUser(db, "owner@store-a.com");

      const store = await storeService.createStore(db, ownerId, {
        name: "Store A",
        slug: "store-a",
      });

      // Owner can read store
      const read = await storeService.getStoreById(db, store.id, ownerId);
      expect(read.id).toBe(store.id);

      // Owner can update configuration
      const updated = await storeService.updateStore(db, store.id, ownerId, {
        name: "Store A Renamed",
      });
      expect(updated.name).toBe("Store A Renamed");

      // Owner can manage lifecycle
      const activated = await storeService.activateStore(db, store.id, ownerId);
      expect(activated.status).toBe("ACTIVE");
    });

    it("strictly prevents cross-store access between independent store tenants", async () => {
      const db = await setupDb();
      const userA = await createTestUser(db, "userA@store-a.com");
      const userB = await createTestUser(db, "userB@store-b.com");

      const storeA = await storeService.createStore(db, userA, {
        name: "Store A",
        slug: "store-a",
      });

      const storeB = await storeService.createStore(db, userB, {
        name: "Store B",
        slug: "store-b",
      });

      // User A cannot read Store B
      await expect(
        storeService.getStoreById(db, storeB.id, userA),
      ).rejects.toThrow(ForbiddenError);

      // User B cannot read Store A
      await expect(
        storeService.getStoreById(db, storeA.id, userB),
      ).rejects.toThrow(ForbiddenError);

      // User A cannot mutate Store B
      await expect(
        storeService.updateStore(db, storeB.id, userA, {
          name: "Hacked Store",
        }),
      ).rejects.toThrow(ForbiddenError);

      // User B cannot mutate Store A
      await expect(
        storeService.updateStore(db, storeA.id, userB, {
          name: "Hacked Store",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejects non-members with ForbiddenError", async () => {
      const db = await setupDb();
      const ownerId = await createTestUser(db, "owner@store-a.com");
      const strangerId = await createTestUser(db, "stranger@other.com");

      const store = await storeService.createStore(db, ownerId, {
        name: "Private Store",
      });

      await expect(
        storeService.getStoreById(db, store.id, strangerId),
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces role permissions: staff members cannot perform administrative operations", async () => {
      const db = await setupDb();
      const ownerId = await createTestUser(db, "owner@example.com");
      const staffId = await createTestUser(db, "staff@example.com");

      const store = await storeService.createStore(db, ownerId, {
        name: "Role Test Store",
      });

      await storeService.addStoreMember(db, store.id, ownerId, {
        userId: staffId,
        role: "staff",
      });

      // Staff CAN view the store
      const view = await storeService.getStoreById(db, store.id, staffId);
      expect(view.id).toBe(store.id);

      // Staff CANNOT update store configuration (requires admin or owner)
      await expect(
        storeService.updateStore(db, store.id, staffId, {
          name: "Staff Rename",
        }),
      ).rejects.toThrow(ForbiddenError);

      // Staff CANNOT activate store
      await expect(
        storeService.activateStore(db, store.id, staffId),
      ).rejects.toThrow(ForbiddenError);

      // Staff CANNOT suspend store
      await expect(
        storeService.suspendStore(db, store.id, staffId),
      ).rejects.toThrow(ForbiddenError);

      // Staff CANNOT list or manage members
      await expect(
        storeService.listStoreMembers(db, store.id, staffId),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        storeService.addStoreMember(db, store.id, staffId, {
          userId: generateUuidV7(),
          role: "staff",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces role permissions: admins cannot archive store (owner only)", async () => {
      const db = await setupDb();
      const ownerId = await createTestUser(db, "owner@example.com");
      const adminId = await createTestUser(db, "admin@example.com");

      const store = await storeService.createStore(db, ownerId, {
        name: "Owner Protected Store",
      });

      await storeService.addStoreMember(db, store.id, ownerId, {
        userId: adminId,
        role: "admin",
      });

      // Admin can activate/suspend
      await expect(
        storeService.activateStore(db, store.id, adminId),
      ).resolves.not.toThrow();

      // Admin CANNOT archive (per specification matrix, archival is owner-level operation)
      await expect(
        storeService.archiveStore(db, store.id, adminId),
      ).rejects.toThrow(ForbiddenError);

      // Owner CAN archive
      await expect(
        storeService.archiveStore(db, store.id, ownerId),
      ).resolves.not.toThrow();
    });
  },
);
