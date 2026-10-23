import { afterEach, describe, expect, it } from "vitest";
import {
  ForbiddenError,
  UserAlreadyExistsError,
  createPasswordResetToken,
  login,
  register,
  resetPasswordWithToken,
  updateUserProfile,
  validateSession,
} from "@shopify-clone/auth";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import {
  StoreService,
  InvitationExpiredError,
  InvitationRevokedError,
  InsufficientStorePermissionError,
} from "@shopify-clone/stores";
import { CustomerService } from "@shopify-clone/customers";
import { CartService } from "@shopify-clone/carts";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import { requireAuth, requireStore } from "../apps/web/src/lib/api/guard.js";
import { ApiHttpError } from "../apps/web/src/lib/api/errors.js";

describe("E2E Authentication, Onboarding & Multi-Tenant Account Flows", { timeout: 35_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const customerService = new CustomerService();
  const cartService = new CartService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  describe("1. Merchant Journey & Self-Service Onboarding", () => {
    it("completes registration, password recovery, profile edit, and multi-store onboarding", async () => {
      const db = await setupDb();

      // Step 1: Merchant Signup
      const signup = await register(db, {
        email: "merchant.founder@acme.com",
        password: "secure-initial-password-1",
        name: "Acme Founder",
      });

      expect(signup.user.id).toBeDefined();
      expect(signup.session.id).toBeDefined();

      // Step 2: Merchant Self-Service Onboarding Wizard
      // Create Organization & First Store
      const store1 = await storeService.createStore(db, signup.user.id, {
        name: "Acme Flagship",
        slug: "acme-flagship",
        organizationName: "Acme Holdings Corp",
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      });

      expect(store1.id).toBeDefined();
      expect(store1.slug).toBe("acme-flagship");
      expect(store1.organizationId).toBeDefined();

      // Update store settings (Customer service contact info)
      const updatedStore1 = await storeService.updateStore(
        db,
        store1.id,
        signup.user.id,
        {
          contactEmail: "support@acmeflagship.com",
          contactPhone: "+1 (555) 234-5678",
          description: "Premium handcrafted items",
        }
      );
      expect(updatedStore1.settings?.contactEmail).toBe("support@acmeflagship.com");

      // Verify organization deduplication: Retry onboarding or create 2nd store without passing organizationId
      const store2 = await storeService.createStore(db, signup.user.id, {
        name: "Acme Outlet",
        slug: "acme-outlet",
      });

      // Must automatically reuse existing owner organization, avoiding duplicate organization creation
      expect(store2.organizationId).toBe(store1.organizationId);

      // Verify merchant can switch between stores
      const accessibleStores = await storeService.listUserStores(db, signup.user.id);
      expect(accessibleStores).toHaveLength(2);
      expect(accessibleStores.map((s) => s.slug).sort()).toEqual(["acme-flagship", "acme-outlet"]);

      // Step 3: Account & Profile Management
      const updatedUser = await updateUserProfile(db, signup.user.id, {
        name: "Acme Founder & CEO",
      });
      expect(updatedUser.name).toBe("Acme Founder & CEO");

      // Step 4: Forgot Password & Password Recovery
      const resetToken = await createPasswordResetToken(db, "merchant.founder@acme.com");
      expect(resetToken).toBeDefined();

      await resetPasswordWithToken(db, resetToken!, "new-master-password-2");

      // Verify old session revoked
      await expect(validateSession(db, signup.session.id)).rejects.toThrow();

      // Login with new password
      const newLogin = await login(db, {
        email: "merchant.founder@acme.com",
        password: "new-master-password-2",
      });
      expect(newLogin.user.id).toBe(signup.user.id);
    });

    it("rejects duplicate merchant registration with normalized email", async () => {
      const db = await setupDb();

      await register(db, {
        email: "owner@boutique.com",
        password: "master-password-1",
        name: "Boutique Owner",
      });

      await expect(
        register(db, {
          email: "  OWNER@BOUTIQUE.COM ",
          password: "another-password",
          name: "Duplicate Attempt",
        })
      ).rejects.toThrow(UserAlreadyExistsError);
    });
  });

  describe("2. Staff Authentication, Invitations & Role Boundaries", () => {
    it("handles staff invitation, onboarding, and verifies strict role permissions", async () => {
      const db = await setupDb();

      // 1. Merchant Owner registers & creates store
      const owner = await register(db, {
        email: "owner@store.com",
        password: "owner-password-1234",
        name: "Store Owner",
      });

      const store = await storeService.createStore(db, owner.user.id, {
        name: "Gadget Hub",
        slug: "gadget-hub",
      });

      // 2. Owner invites a staff member
      const invitation = await storeService.createStoreInvitation(
        db,
        store.id,
        owner.user.id,
        {
          email: "support.staff@store.com",
          role: "staff",
        }
      );
      expect(invitation.status).toBe("PENDING");
      expect(invitation.role).toBe("staff");

      // 3. Staff accepts invitation (simulating new user registration via invite link)
      const staffUser = await register(db, {
        email: "support.staff@store.com",
        password: "staff-secure-password-1",
        name: "Support Staff Member",
      });

      const membership = await storeService.acceptStoreInvitation(
        db,
        invitation.rawToken,
        staffUser.user.id
      );
      expect(membership.storeId).toBe(store.id);
      expect(membership.role).toBe("staff");
      expect(membership.status).toBe("ACTIVE");

      // 4. Staff cannot remove the owner
      const ownerMember = (await storeService.listStoreMembers(db, store.id, owner.user.id))
        .find((m) => m.userId === owner.user.id)!;

      await expect(
        storeService.removeStoreMember(db, store.id, staffUser.user.id, ownerMember.id)
      ).rejects.toThrow(ForbiddenError);

      // 5. Staff cannot archive the store (requires owner)
      await expect(
        storeService.changeStoreStatus(db, store.id, staffUser.user.id, "ARCHIVED")
      ).rejects.toThrow(ForbiddenError);

      // 6. Test invitation revocation
      const revokeInvite = await storeService.createStoreInvitation(
        db,
        store.id,
        owner.user.id,
        {
          email: "temp.agent@store.com",
          role: "staff",
        }
      );

      await storeService.revokeStoreInvitation(
        db,
        store.id,
        owner.user.id,
        revokeInvite.id
      );

      const tempUser = await register(db, {
        email: "temp.agent@store.com",
        password: "password12345",
        name: "Temp Agent",
      });

      await expect(
        storeService.acceptStoreInvitation(db, revokeInvite.rawToken, tempUser.user.id)
      ).rejects.toThrow(InvitationRevokedError);
    });

    it("allows existing users to accept invitations without creating duplicate accounts", async () => {
      const db = await setupDb();

      // Owner registers
      const owner = await register(db, {
        email: "lead.owner@store.com",
        password: "owner-pass-12345",
        name: "Lead Owner",
      });

      const store = await storeService.createStore(db, owner.user.id, {
        name: "Studio Two",
        slug: "studio-two",
      });

      // Existing user already exists in the system
      const existingUser = await register(db, {
        email: "experienced.designer@consulting.com",
        password: "designer-pass-12345",
        name: "Experienced Designer",
      });

      // Owner invites existing user's email as admin
      const invitation = await storeService.createStoreInvitation(
        db,
        store.id,
        owner.user.id,
        {
          email: "experienced.designer@consulting.com",
          role: "admin",
        }
      );

      // Existing user accepts invitation directly with their existing user ID
      const member = await storeService.acceptStoreInvitation(
        db,
        invitation.rawToken,
        existingUser.user.id
      );

      expect(member.userId).toBe(existingUser.user.id);
      expect(member.role).toBe("admin");

      // Verify user can now access store
      const userStores = await storeService.listUserStores(db, existingUser.user.id);
      expect(userStores.some((s) => s.id === store.id)).toBe(true);
    });

    it("enforces role restrictions: cannot invite an owner role", async () => {
      const db = await setupDb();

      const owner = await register(db, {
        email: "owner@roletest.com",
        password: "owner-password-1",
        name: "Owner Role Test",
      });

      const store = await storeService.createStore(db, owner.user.id, {
        name: "Role Test Store",
        slug: "role-test-store",
      });

      await expect(
        storeService.createStoreInvitation(
          db,
          store.id,
          owner.user.id,
          {
            email: "co-owner@test.com",
            role: "owner" as unknown as "admin" | "staff",
          }
        )
      ).rejects.toThrow(InsufficientStorePermissionError);
    });

    it("rejects expired invitations", async () => {
      const db = await setupDb();

      const owner = await register(db, {
        email: "owner@expiry.com",
        password: "password-123456",
        name: "Expiry Owner",
      });

      const store = await storeService.createStore(db, owner.user.id, {
        name: "Expiry Store",
        slug: "expiry-store",
      });

      const invite = await storeService.createStoreInvitation(
        db,
        store.id,
        owner.user.id,
        {
          email: "late.joiner@test.com",
          role: "staff",
        }
      );

      // Artificially expire invitation in DB
      await db.query(
        `UPDATE store_invitations SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`,
        [invite.id]
      );

      const lateUser = await register(db, {
        email: "late.joiner@test.com",
        password: "password-123456",
        name: "Late Joiner",
      });

      await expect(
        storeService.acceptStoreInvitation(db, invite.rawToken, lateUser.user.id)
      ).rejects.toThrow(InvitationExpiredError);
    });
  });

  describe("3. Storefront Customer Authentication, Cart Merging & Store Isolation", () => {
    it("merges guest cart items into customer cart on authentication and preserves customer order history", async () => {
      const db = await setupDb();

      const owner = await register(db, {
        email: "merchant@catalog.com",
        password: "password12345",
        name: "Catalog Merchant",
      });

      const store = await storeService.createStore(db, owner.user.id, {
        name: "Boutique Goods",
        slug: "boutique-goods",
      });

      // Seed product and variant
      const productId = generateUuidV7();
      const variantId = generateUuidV7();
      await db.query(
        `INSERT INTO products (id, store_id, title, slug, status)
         VALUES ($1, $2, 'Handmade Mug', 'handmade-mug', 'ACTIVE')`,
        [productId, store.id]
      );
      await db.query(
        `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, position)
         VALUES ($1, $2, $3, 'Ceramic', 'MUG-01', 2500, 1)`,
        [variantId, productId, store.id]
      );
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 100, 0)`,
        [generateUuidV7(), store.id, variantId]
      );

      // Guest creates anonymous cart and adds item
      const guestId = generateUuidV7();
      const guestCart = await cartService.getOrCreateCart(db, store.id, {
        guestIdentifier: guestId,
        currency: "USD",
      });
      await cartService.addItem(db, store.id, guestCart.id, { variantId, quantity: 2 });

      // Customer registers
      const customerUser = await register(db, {
        email: "shopper.jane@buyer.com",
        password: "customer-password-123",
        name: "Jane Buyer",
      });

      const customer = await customerService.createCustomer(db, store.id, {
        email: "shopper.jane@buyer.com",
        firstName: "Jane",
        lastName: "Buyer",
        userId: customerUser.user.id,
      });

      // Merge guest cart into customer cart
      const mergedCart = await cartService.mergeCart(db, store.id, guestId, customer.id);
      expect(mergedCart.customerId).toBe(customer.id);
      expect(mergedCart.items).toHaveLength(1);
      expect(mergedCart.items[0]?.quantity).toBe(2);

      // Customer updates profile
      const updatedProfile = await customerService.updateCustomer(db, store.id, customer.id, {
        phone: "+1 (555) 987-6543",
      });
      expect(updatedProfile.phone).toBe("+1 (555) 987-6543");

      // Verify customer order history query isolation
      const orderQuery = await db.query(
        `SELECT id FROM orders WHERE store_id = $1 AND customer_id = $2`,
        [store.id, customer.id]
      );
      expect(orderQuery.rows).toHaveLength(0);
    });

    it("maintains strict customer isolation between stores and protects merchant boundaries", async () => {
      const db = await setupDb();

      // Create two distinct stores
      const owner = await register(db, {
        email: "store-owner@test.com",
        password: "password12345",
        name: "Merchant",
      });

      const storeA = await storeService.createStore(db, owner.user.id, {
        name: "Store Alpha",
        slug: "store-alpha",
      });

      const storeB = await storeService.createStore(db, owner.user.id, {
        name: "Store Beta",
        slug: "store-beta",
      });

      // Customer registers in Store Alpha
      const customerUserA = await register(db, {
        email: "shopper@consumer.com",
        password: "shopper-password-123",
        name: "Shopper Alpha",
      });

      const customerRecordA = await customerService.createCustomer(
        db,
        storeA.id,
        {
          email: "shopper@consumer.com",
          firstName: "Shopper",
          lastName: "Alpha",
          userId: customerUserA.user.id,
        }
      );

      expect(customerRecordA.storeId).toBe(storeA.id);
      expect(customerRecordA.email).toBe("shopper@consumer.com");

      // Verify customer has NO access to merchant store management
      const customerStores = await storeService.listUserStores(db, customerUserA.user.id);
      expect(customerStores).toHaveLength(0); // Cannot administer any store

      // Customer in Store Alpha does not exist in Store Beta
      const customerInBeta = await customerService.getCustomerByEmail(
        db,
        storeB.id,
        "shopper@consumer.com"
      );
      expect(customerInBeta).toBeNull();

      // Customer in Store Alpha cannot view Store Beta's customers
      const storeBCustomers = await customerService.listCustomers(db, storeB.id, {
        page: 1,
        limit: 10,
      });
      expect(storeBCustomers.items).toHaveLength(0);
    });
  });

  describe("4. Route Guard & Direct API Access Protection", () => {
    it("rejects direct API calls when unauthenticated with 401", () => {
      const fakeCtx = {
        db: {} as Database,
        requestId: "test-req",
        auth: null,
      };

      expect(() => requireAuth(fakeCtx)).toThrow(ApiHttpError);

      try {
        requireAuth(fakeCtx);
      } catch (err) {
        expect((err as ApiHttpError).status).toBe(401);
        expect((err as ApiHttpError).code).toBe("AUTHENTICATION_REQUIRED");
      }
    });

    it("rejects store management access with 403 when user is not a store member", async () => {
      const db = await setupDb();

      const user = await register(db, {
        email: "outsider@evil.com",
        password: "password12345",
        name: "Outsider",
      });

      const storeId = generateUuidV7();

      const fakeCtx = {
        db,
        requestId: "test-req",
        auth: {
          user: {
            id: user.user.id,
            email: user.user.email,
            name: user.user.name,
            status: "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          session: {
            id: user.session.id,
            userId: user.user.id,
            createdAt: new Date(),
            expiresAt: new Date(),
            revokedAt: null,
          },
        },
      };

      await expect(requireStore(fakeCtx, storeId, "admin")).rejects.toThrow(ApiHttpError);

      try {
        await requireStore(fakeCtx, storeId, "admin");
      } catch (err) {
        expect((err as ApiHttpError).status).toBe(403);
      }
    });
  });
});
