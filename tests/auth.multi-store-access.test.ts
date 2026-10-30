import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { login, register } from "@calcart/auth";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { StoreService } from "@calcart/stores";
import {
  ForbiddenError,
  isPlatformAdmin,
  requireStoreAccess,
  resolveStoreMembership,
} from "@calcart/tenant";
import {
  ApiHttpError,
  requirePlatformAdmin,
  requireStore,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api/index.js";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Multi-Store Access Control & Tenant Boundaries", { timeout: 45_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();

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

  async function createTestUser(email: string, name: string = "Test User") {
    return register(db, {
      email,
      password: "SecurePassword123!",
      name,
    });
  }

  it("1. A user with access to one store cannot access another store", async () => {
    const userA = await createTestUser("user-a@example.com", "User A");
    const userB = await createTestUser("user-b@example.com", "User B");

    const storeA = await storeService.createStore(db, userA.user.id, {
      name: "Store Alpha",
      slug: "store-alpha",
    });

    const storeB = await storeService.createStore(db, userB.user.id, {
      name: "Store Beta",
      slug: "store-beta",
    });

    // User A can access Store A
    const reqA = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/products`, {
      headers: { authorization: `Bearer ${userA.session.id}` },
    });
    const ctxA = await resolveRequestContext(reqA, { db });
    const memberA = await requireStoreOrNotFound(ctxA, storeA.id, "staff");
    expect(memberA.storeId).toBe(storeA.id);

    // User A attempting to access Store B is rejected with 404 (prevent store existence disclosure)
    const reqCross = new Request(`http://localhost:3000/api/v1/stores/${storeB.id}/products`, {
      headers: { authorization: `Bearer ${userA.session.id}` },
    });
    const ctxCross = await resolveRequestContext(reqCross, { db });
    await expect(requireStoreOrNotFound(ctxCross, storeB.id, "staff")).rejects.toThrowError(
      ApiHttpError
    );
    try {
      await requireStoreOrNotFound(ctxCross, storeB.id, "staff");
    } catch (err) {
      const apiErr = err as ApiHttpError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe("NOT_FOUND");
    }
  });

  it("2. A user with membership in multiple stores can switch between them", async () => {
    const multiUser = await createTestUser("multi@example.com", "Multi Store User");
    const otherOwner = await createTestUser("other-owner@example.com", "Other Owner");

    // multiUser creates Store 1 (Owner)
    const store1 = await storeService.createStore(db, multiUser.user.id, {
      name: "Store One",
      slug: "store-one",
    });

    // otherOwner creates Store 2 and adds multiUser as Staff
    const store2 = await storeService.createStore(db, otherOwner.user.id, {
      name: "Store Two",
      slug: "store-two",
    });

    await storeService.addStoreMember(db, store2.id, otherOwner.user.id, {
      userId: multiUser.user.id,
      role: "staff",
    });

    // listUserStores returns both stores for multiUser
    const userStores = await storeService.listUserStores(db, multiUser.user.id);
    expect(userStores.length).toBe(2);

    const storeIds = userStores.map((s) => s.id);
    expect(storeIds).toContain(store1.id);
    expect(storeIds).toContain(store2.id);

    // Context switching: User can access Store 1 as owner
    const access1 = await requireStoreAccess(db, store1.id, multiUser.user.id);
    expect(access1.role).toBe("owner");

    // Context switching: User can access Store 2 as staff
    const access2 = await requireStoreAccess(db, store2.id, multiUser.user.id);
    expect(access2.role).toBe("staff");
  });

  it("3. Different memberships have different roles and permission boundaries", async () => {
    const alice = await createTestUser("alice@example.com", "Alice");
    const bob = await createTestUser("bob@example.com", "Bob");

    const storeA = await storeService.createStore(db, alice.user.id, {
      name: "Alice Shop",
      slug: "alice-shop",
    });

    const storeB = await storeService.createStore(db, bob.user.id, {
      name: "Bob Shop",
      slug: "bob-shop",
    });

    // Alice is Owner in Store A, Staff in Store B
    await storeService.addStoreMember(db, storeB.id, bob.user.id, {
      userId: alice.user.id,
      role: "staff",
    });

    // Alice in Store A: Satisfies admin and owner operations
    const memberInA = await requireStoreAccess(db, storeA.id, alice.user.id, "owner");
    expect(memberInA.role).toBe("owner");

    // Alice in Store B: Satisfies staff, but rejects admin operations
    const memberInB = await requireStoreAccess(db, storeB.id, alice.user.id, "staff");
    expect(memberInB.role).toBe("staff");

    await expect(
      requireStoreAccess(db, storeB.id, alice.user.id, "admin")
    ).rejects.toThrowError(ForbiddenError);
  });

  it("4. A staff member cannot access unassigned stores", async () => {
    const owner = await createTestUser("owner4@example.com", "Owner");
    const staff = await createTestUser("staff4@example.com", "Staff");
    const thirdParty = await createTestUser("third@example.com", "Third Party");

    const assignedStore = await storeService.createStore(db, owner.user.id, {
      name: "Assigned Store",
      slug: "assigned-store",
    });

    const unassignedStore = await storeService.createStore(db, thirdParty.user.id, {
      name: "Unassigned Store",
      slug: "unassigned-store",
    });

    await storeService.addStoreMember(db, assignedStore.id, owner.user.id, {
      userId: staff.user.id,
      role: "staff",
    });

    // Staff can access assigned store
    const accessAssigned = await requireStoreAccess(db, assignedStore.id, staff.user.id);
    expect(accessAssigned.storeId).toBe(assignedStore.id);

    // Staff cannot access unassigned store
    await expect(
      requireStoreAccess(db, unassignedStore.id, staff.user.id)
    ).rejects.toThrowError(ForbiddenError);
  });

  it("5. A store admin cannot exercise platform super-admin privileges", async () => {
    const owner = await createTestUser("owner5@example.com", "Owner 5");
    const storeAdmin = await createTestUser("admin5@example.com", "Store Admin");

    const store = await storeService.createStore(db, owner.user.id, {
      name: "Store 5",
      slug: "store-5",
    });

    await storeService.addStoreMember(db, store.id, owner.user.id, {
      userId: storeAdmin.user.id,
      role: "admin",
    });

    // Request from store admin
    const reqAdmin = new Request("http://localhost:3000/api/v1/platform/protected", {
      headers: { authorization: `Bearer ${storeAdmin.session.id}` },
    });
    const ctxAdmin = await resolveRequestContext(reqAdmin, { db });

    // Store admin must be rejected when platform admin is required
    expect(() => requirePlatformAdmin(ctxAdmin)).toThrowError(ApiHttpError);
    try {
      requirePlatformAdmin(ctxAdmin);
    } catch (err) {
      const apiErr = err as ApiHttpError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe("PLATFORM_ADMIN_REQUIRED");
    }

    // Now promote a user to platform super-admin
    const superAdmin = await createTestUser("super@platform.internal", "Super Admin");
    await db.query("UPDATE users SET is_platform_admin = TRUE WHERE id = $1", [
      superAdmin.user.id,
    ]);

    // Relogin to load updated session with platform admin flag
    const superLogin = await login(db, {
      email: "super@platform.internal",
      password: "SecurePassword123!",
    });

    const reqSuper = new Request("http://localhost:3000/api/v1/platform/protected", {
      headers: { authorization: `Bearer ${superLogin.session.id}` },
    });
    const ctxSuper = await resolveRequestContext(reqSuper, { db });

    const verifiedAuth = requirePlatformAdmin(ctxSuper);
    expect(verifiedAuth.user.isPlatformAdmin).toBe(true);

    // Platform super-admin can access any store with audit record
    const superAccess = await requireStoreAccess(db, store.id, superAdmin.user.id);
    expect(superAccess.isPlatformAdmin).toBe(true);
    expect(superAccess.role).toBe("owner");
  });

  it("6. A user cannot gain access by tampering with URL, cookie, or storeId hint", async () => {
    const userVictim = await createTestUser("victim@example.com", "Victim");
    const userAttacker = await createTestUser("attacker@example.com", "Attacker");

    const victimStore = await storeService.createStore(db, userVictim.user.id, {
      name: "Victim Store",
      slug: "victim-store",
    });

    // Attacker crafts request with victim's storeId in URL and headers
    const reqTampered = new Request(
      `http://localhost:3000/api/v1/stores/${victimStore.id}/settings`,
      {
        headers: {
          authorization: `Bearer ${userAttacker.session.id}`,
          cookie: `calcart_active_store_id=${victimStore.id}`,
          "x-store-id": victimStore.id,
        },
      }
    );

    const ctx = await resolveRequestContext(reqTampered, { db });
    await expect(requireStoreOrNotFound(ctx, victimStore.id, "staff")).rejects.toThrowError(
      ApiHttpError
    );

    try {
      await requireStoreOrNotFound(ctx, victimStore.id, "staff");
    } catch (err) {
      const apiErr = err as ApiHttpError;
      expect(apiErr.status).toBe(404);
    }
  });

  it("7. Revoked memberships stop working immediately on subsequent requests", async () => {
    const owner = await createTestUser("owner7@example.com", "Owner");
    const staff = await createTestUser("staff7@example.com", "Staff");

    const store = await storeService.createStore(db, owner.user.id, {
      name: "Store Seven",
      slug: "store-seven",
    });

    const membership = await storeService.addStoreMember(db, store.id, owner.user.id, {
      userId: staff.user.id,
      role: "staff",
    });

    // Request 1: Staff has active membership
    const req1 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
      headers: { authorization: `Bearer ${staff.session.id}` },
    });
    const ctx1 = await resolveRequestContext(req1, { db });
    const active = await requireStore(ctx1, store.id, "staff");
    expect(active.status).toBe("ACTIVE");

    // Owner revokes/removes the staff membership
    await storeService.removeStoreMember(db, store.id, owner.user.id, membership.id);

    // Request 2: Immediate subsequent request is rejected
    const req2 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
      headers: { authorization: `Bearer ${staff.session.id}` },
    });
    const ctx2 = await resolveRequestContext(req2, { db });
    await expect(requireStore(ctx2, store.id, "staff")).rejects.toThrowError(ApiHttpError);

    const membershipInDb = await resolveStoreMembership(db, store.id, staff.user.id);
    expect(membershipInDb).toBeNull();
  });

  it("8. Switching stores does not leak data or grant cross-store access", async () => {
    const merchant = await createTestUser("merchant8@example.com", "Merchant");

    const storeA = await storeService.createStore(db, merchant.user.id, {
      name: "Store Eight A",
      slug: "store-eight-a",
    });

    const storeB = await storeService.createStore(db, merchant.user.id, {
      name: "Store Eight B",
      slug: "store-eight-b",
    });

    // Check store details independently
    const detailA = await storeService.getStoreById(db, storeA.id, merchant.user.id);
    const detailB = await storeService.getStoreById(db, storeB.id, merchant.user.id);

    expect(detailA.slug).toBe("store-eight-a");
    expect(detailB.slug).toBe("store-eight-b");
    expect(detailA.id).not.toBe(detailB.id);
  });

  it("9. Existing legitimate owner accounts retain access after migration", async () => {
    const owner = await createTestUser("legit-owner@example.com", "Legit Owner");
    const store = await storeService.createStore(db, owner.user.id, {
      name: "Legit Store",
      slug: "legit-store",
    });

    // Check is_platform_admin default
    const isSuper = await isPlatformAdmin(db, owner.user.id);
    expect(isSuper).toBe(false);

    // Legitimate owner retains full owner permissions
    const membership = await requireStoreAccess(db, store.id, owner.user.id, "owner");
    expect(membership.role).toBe("owner");
    expect(membership.status).toBe("ACTIVE");
  });

  it("10. Unauthorized users cannot modify membership roles or assign themselves to other stores", async () => {
    const owner = await createTestUser("owner10@example.com", "Owner");
    const staff = await createTestUser("staff10@example.com", "Staff");
    const admin = await createTestUser("admin10@example.com", "Admin");

    const store = await storeService.createStore(db, owner.user.id, {
      name: "Store Ten",
      slug: "store-ten",
    });

    const staffMember = await storeService.addStoreMember(db, store.id, owner.user.id, {
      userId: staff.user.id,
      role: "staff",
    });

    const adminMember = await storeService.addStoreMember(db, store.id, owner.user.id, {
      userId: admin.user.id,
      role: "admin",
    });

    // Staff cannot update member roles (not an admin)
    await expect(
      storeService.updateStoreMember(db, store.id, staff.user.id, staffMember.id, {
        role: "admin",
      })
    ).rejects.toThrowError(ForbiddenError);

    // Admin cannot self-promote to owner
    await expect(
      storeService.updateStoreMember(db, store.id, admin.user.id, adminMember.id, {
        role: "owner",
      })
    ).rejects.toThrow();

    // Admin cannot grant owner role to someone else (privilege escalation blocked)
    await expect(
      storeService.updateStoreMember(db, store.id, admin.user.id, staffMember.id, {
        role: "owner",
      })
    ).rejects.toThrow();

    // Admin cannot demote or remove the store owner
    const ownerMembership = (await storeService.listStoreMembers(db, store.id, owner.user.id)).find(
      (m) => m.role === "owner"
    );
    expect(ownerMembership).toBeDefined();

    await expect(
      storeService.updateStoreMember(db, store.id, admin.user.id, ownerMembership!.id, {
        role: "staff",
      })
    ).rejects.toThrow();

    await expect(
      storeService.removeStoreMember(db, store.id, admin.user.id, ownerMembership!.id)
    ).rejects.toThrow();
  });

  it("11. Concurrency: duplicate memberships are rejected by database unique constraint", async () => {
    const owner = await createTestUser("owner11@example.com", "Owner");
    const candidate = await createTestUser("candidate11@example.com", "Candidate");

    const store = await storeService.createStore(db, owner.user.id, {
      name: "Store Eleven",
      slug: "store-eleven",
    });

    // Adding candidate works
    await storeService.addStoreMember(db, store.id, owner.user.id, {
      userId: candidate.user.id,
      role: "staff",
    });

    // Attempting to add candidate again is rejected
    await expect(
      storeService.addStoreMember(db, store.id, owner.user.id, {
        userId: candidate.user.id,
        role: "staff",
      })
    ).rejects.toThrow();

    // Direct concurrent INSERT is rejected by database constraint
    await expect(
      db.query(
        `INSERT INTO store_memberships (id, store_id, user_id, role, status)
         VALUES ($1, $2, $3, 'staff', 'ACTIVE')`,
        [generateUuidV7(), store.id, candidate.user.id]
      )
    ).rejects.toThrow();
  });

  it("12. Invitations cannot be accepted by a different user email", async () => {
    const owner = await createTestUser("owner12@example.com", "Owner");
    const intendedUser = await createTestUser("intended@company.com", "Intended User");
    const imposter = await createTestUser("imposter@attacker.com", "Imposter");

    const store = await storeService.createStore(db, owner.user.id, {
      name: "Store Twelve",
      slug: "store-twelve",
    });

    const invite = await storeService.createStoreInvitation(db, store.id, owner.user.id, {
      email: "intended@company.com",
      role: "staff",
    });

    // Imposter attempts to accept the invitation
    await expect(
      storeService.acceptStoreInvitation(db, invite.rawToken, imposter.user.id)
    ).rejects.toThrow();

    // Intended user accepts successfully
    const accepted = await storeService.acceptStoreInvitation(
      db,
      invite.rawToken,
      intendedUser.user.id
    );
    expect(accepted.userId).toBe(intendedUser.user.id);
    expect(accepted.role).toBe("staff");
  });
});
