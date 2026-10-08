import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations } from "@shopify-clone/db";
import {
  CannotRemoveLastOwnerError,
  DuplicateStoreSlugError,
  ImmutableFieldError,
  InvalidStoreStatusTransitionError,
  OrganizationAccessDeniedError,
  StoreNotFoundError,
  StoreService,
} from "@shopify-clone/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Stores Application Service Integration", { timeout: 30_000 }, () => {
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
  ) {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  describe("Store Creation (createStore)", () => {
    it("atomically creates an organization, store, settings, and owner membership", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      const store = await storeService.createStore(db, userId, {
        name: "Acme Apparel",
        slug: "acme-apparel",
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        contactEmail: "contact@acme.com",
        contactPhone: "+15550100",
        description: "Finest quality clothing",
      });

      expect(store.id).toBeDefined();
      expect(store.name).toBe("Acme Apparel");
      expect(store.slug).toBe("acme-apparel");
      expect(store.status).toBe("DRAFT");
      expect(store.currency).toBe("USD");
      expect(store.settings).toEqual({
        contactEmail: "contact@acme.com",
        contactPhone: "+15550100",
        description: "Finest quality clothing",
      });

      // Verify records in DB
      const orgQuery = await db.query(
        "SELECT * FROM organizations WHERE id = $1",
        [store.organizationId],
      );
      expect(orgQuery.rows).toHaveLength(1);

      const orgMemQuery = await db.query(
        "SELECT * FROM organization_memberships WHERE organization_id = $1 AND user_id = $2",
        [store.organizationId, userId],
      );
      expect(orgMemQuery.rows).toHaveLength(1);
      expect(orgMemQuery.rows[0].role).toBe("owner");

      const storeMemQuery = await db.query(
        "SELECT * FROM store_memberships WHERE store_id = $1 AND user_id = $2",
        [store.id, userId],
      );
      expect(storeMemQuery.rows).toHaveLength(1);
      expect(storeMemQuery.rows[0].role).toBe("owner");
      expect(storeMemQuery.rows[0].status).toBe("ACTIVE");
    });

    it("creates a store under an existing organization if user is authorized", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      // Create initial store (which creates an organization)
      const store1 = await storeService.createStore(db, userId, {
        name: "Store One",
      });

      // Create second store under same organization
      const store2 = await storeService.createStore(db, userId, {
        name: "Store Two",
        organizationId: store1.organizationId,
      });

      expect(store2.organizationId).toBe(store1.organizationId);
    });

    it("rejects creating store under an organization user does not belong to", async () => {
      const db = await setupDb();
      const ownerA = await createTestUser(db, "a@example.com");
      const userB = await createTestUser(db, "b@example.com");

      const storeA = await storeService.createStore(db, ownerA, {
        name: "Store A",
      });

      await expect(
        storeService.createStore(db, userB, {
          name: "Attacker Store",
          organizationId: storeA.organizationId,
        }),
      ).rejects.toThrow(OrganizationAccessDeniedError);
    });

    it("rejects duplicate store slugs", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      await storeService.createStore(db, userId, {
        name: "Unique Shop",
        slug: "unique-shop",
      });

      await expect(
        storeService.createStore(db, userId, {
          name: "Another Shop",
          slug: "unique-shop",
        }),
      ).rejects.toThrow(DuplicateStoreSlugError);
    });
  });

  describe("Store Updates & Currency Immutability", () => {
    it("updates basic store settings when permitted", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      const store = await storeService.createStore(db, userId, {
        name: "Initial Name",
        currency: "USD",
      });

      const updated = await storeService.updateStore(db, store.id, userId, {
        name: "Updated Name",
        contactEmail: "new@example.com",
        description: "New description",
        timezone: "Europe/London",
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.timezone).toBe("Europe/London");
      expect(updated.settings?.contactEmail).toBe("new@example.com");
      expect(updated.settings?.description).toBe("New description");
    });

    it("allows currency change while in DRAFT status", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      const store = await storeService.createStore(db, userId, {
        name: "Draft Store",
        currency: "USD",
      });

      const updated = await storeService.updateStore(db, store.id, userId, {
        currency: "EUR",
      });

      expect(updated.currency).toBe("EUR");
    });

    it("rejects currency change once store is ACTIVE (currency immutability invariant)", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      const store = await storeService.createStore(db, userId, {
        name: "Active Store",
        currency: "USD",
      });

      await storeService.activateStore(db, store.id, userId);

      await expect(
        storeService.updateStore(db, store.id, userId, {
          currency: "GBP",
        }),
      ).rejects.toThrow(ImmutableFieldError);
    });
  });

  describe("Lifecycle Transitions", () => {
    it("handles the complete valid lifecycle: DRAFT -> ACTIVE -> SUSPENDED -> ACTIVE -> ARCHIVED", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      const store = await storeService.createStore(db, userId, {
        name: "Lifecycle Test Store",
      });
      expect(store.status).toBe("DRAFT");

      const active = await storeService.activateStore(db, store.id, userId);
      expect(active.status).toBe("ACTIVE");

      const suspended = await storeService.suspendStore(db, store.id, userId);
      expect(suspended.status).toBe("SUSPENDED");

      const reactivated = await storeService.reactivateStore(
        db,
        store.id,
        userId,
      );
      expect(reactivated.status).toBe("ACTIVE");

      const archived = await storeService.archiveStore(db, store.id, userId);
      expect(archived.status).toBe("ARCHIVED");
    });

    it("rejects transition attempts from terminal ARCHIVED state", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);

      const store = await storeService.createStore(db, userId, {
        name: "Archive Test",
      });

      await storeService.archiveStore(db, store.id, userId);

      await expect(
        storeService.activateStore(db, store.id, userId),
      ).rejects.toThrow(InvalidStoreStatusTransitionError);
    });
  });

  describe("Membership Management & Owner Protection", () => {
    it("adds and updates staff members", async () => {
      const db = await setupDb();
      const ownerId = await createTestUser(db, "owner@example.com");
      const staffId = await createTestUser(db, "staff@example.com");

      const store = await storeService.createStore(db, ownerId, {
        name: "Membership Store",
      });

      const member = await storeService.addStoreMember(db, store.id, ownerId, {
        userId: staffId,
        role: "staff",
      });

      expect(member.userId).toBe(staffId);
      expect(member.role).toBe("staff");
      expect(member.status).toBe("ACTIVE");

      const updated = await storeService.updateStoreMember(
        db,
        store.id,
        ownerId,
        member.id,
        { role: "admin" },
      );

      expect(updated.role).toBe("admin");
    });

    it("strictly prevents removing the last remaining store owner", async () => {
      const db = await setupDb();
      const ownerId = await createTestUser(db, "owner@example.com");

      const store = await storeService.createStore(db, ownerId, {
        name: "Solo Owner Store",
      });

      const members = await storeService.listStoreMembers(
        db,
        store.id,
        ownerId,
      );
      const ownerMember = members.find((m) => m.userId === ownerId)!;

      // Attempting to remove the only owner
      await expect(
        storeService.removeStoreMember(db, store.id, ownerId, ownerMember.id),
      ).rejects.toThrow(CannotRemoveLastOwnerError);

      // Attempting to demote the only owner to admin
      await expect(
        storeService.updateStoreMember(db, store.id, ownerId, ownerMember.id, {
          role: "admin",
        }),
      ).rejects.toThrow(CannotRemoveLastOwnerError);
    });

    it("allows removing an owner when another active owner exists", async () => {
      const db = await setupDb();
      const owner1 = await createTestUser(db, "owner1@example.com");
      const owner2 = await createTestUser(db, "owner2@example.com");

      const store = await storeService.createStore(db, owner1, {
        name: "Co-owned Store",
      });

      const secondOwner = await storeService.addStoreMember(
        db,
        store.id,
        owner1,
        {
          userId: owner2,
          role: "owner",
        },
      );

      // Now there are 2 owners. Removing one must succeed!
      await expect(
        storeService.removeStoreMember(db, store.id, owner1, secondOwner.id),
      ).resolves.not.toThrow();
    });
  });

  describe("Store Lookups & Listing", () => {
    it("lists only stores accessible to the user", async () => {
      const db = await setupDb();
      const userA = await createTestUser(db, "a@example.com");
      const userB = await createTestUser(db, "b@example.com");

      await storeService.createStore(db, userA, { name: "Store A1" });
      await storeService.createStore(db, userA, { name: "Store A2" });
      await storeService.createStore(db, userB, { name: "Store B1" });

      const storesA = await storeService.listUserStores(db, userA);
      const storesB = await storeService.listUserStores(db, userB);

      expect(storesA).toHaveLength(2);
      expect(storesB).toHaveLength(1);
    });

    it("resolves store by slug", async () => {
      const db = await setupDb();
      const user = await createTestUser(db);

      await storeService.createStore(db, user, {
        name: "Slug Lookup Store",
        slug: "slug-lookup-store",
      });

      const store = await storeService.getStoreBySlug(db, "slug-lookup-store");
      expect(store.name).toBe("Slug Lookup Store");

      await expect(
        storeService.getStoreBySlug(db, "nonexistent-slug"),
      ).rejects.toThrow(StoreNotFoundError);
    });
  });
});
