import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { serializeSessionCookie } from "@shopify-clone/auth";
import { StoreService } from "@shopify-clone/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";

import {
  GET as getCustomers,
  POST as postCustomer,
} from "../apps/web/app/api/v1/stores/[storeId]/customers/route.js";
import {
  GET as getCustomer,
  PATCH as patchCustomer,
} from "../apps/web/app/api/v1/stores/[storeId]/customers/[customerId]/route.js";
import { POST as enableCustomer } from "../apps/web/app/api/v1/stores/[storeId]/customers/[customerId]/enable/route.js";
import { POST as disableCustomer } from "../apps/web/app/api/v1/stores/[storeId]/customers/[customerId]/disable/route.js";
import {
  GET as getAddresses,
  POST as postAddress,
} from "../apps/web/app/api/v1/stores/[storeId]/customers/[customerId]/addresses/route.js";
import {
  GET as getAddress,
  PATCH as patchAddress,
  DELETE as deleteAddress,
} from "../apps/web/app/api/v1/stores/[storeId]/customers/[customerId]/addresses/[addressId]/route.js";
import { POST as setDefaultAddress } from "../apps/web/app/api/v1/stores/[storeId]/customers/[customerId]/addresses/[addressId]/default/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Customers API Endpoints (/api/v1/stores/[storeId]/customers/*)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createAuthenticatedUser(email: string) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'User', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );

    const expiresAt = new Date(Date.now() + 86400000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );

    const cookie = serializeSessionCookie(sessionId, { expires: expiresAt });
    return { userId, sessionId, cookie };
  }

  async function createStoreWithOwner(email = "owner@test.com") {
    const user = await createAuthenticatedUser(email);
    const store = await storeService.createStore(db, user.userId, {
      name: "Test Store",
      slug: `store-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { user, store };
  }

  // ---------------------------------------------------------------------------
  // 1. Authentication & Authorization
  // ---------------------------------------------------------------------------
  describe("Authentication & Authorization", () => {
    it("rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "guest@example.com" }),
        },
      );

      const res = await postCustomer(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("returns 404 NOT_FOUND when accessed by user with no membership (tenant-safe)", async () => {
      const { store } = await createStoreWithOwner("owner@test.com");
      const stranger = await createAuthenticatedUser("stranger@other.com");

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: stranger.cookie,
          },
          body: JSON.stringify({ email: "stranger-customer@example.com" }),
        },
      );

      const res = await postCustomer(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("allows staff member to view customers with 200", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const staff = await createAuthenticatedUser("staff@test.com");

      await storeService.addStoreMember(db, store.id, owner.userId, {
        userId: staff.userId,
        role: "staff",
      });

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "GET",
          headers: { cookie: staff.cookie },
        },
      );

      const res = await getCustomers(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
    });

    it("rejects staff member with 403 FORBIDDEN when attempting customer creation", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const staff = await createAuthenticatedUser("staff2@test.com");

      await storeService.addStoreMember(db, store.id, owner.userId, {
        userId: staff.userId,
        role: "staff",
      });

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: staff.cookie,
          },
          body: JSON.stringify({ email: "staff-customer@example.com" }),
        },
      );

      const res = await postCustomer(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Customer CRUD
  // ---------------------------------------------------------------------------
  describe("Customer CRUD", () => {
    it("creates a customer and returns 201 with Customer DTO", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            email: "Jane.Doe@example.COM ",
            firstName: "Jane",
            lastName: "Doe",
            phone: "+1-555-123-4567",
          }),
        },
      );

      const res = await postCustomer(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.storeId).toBe(store.id);
      expect(body.data.email).toBe("jane.doe@example.com");
      expect(body.data.firstName).toBe("Jane");
      expect(body.data.lastName).toBe("Doe");
      expect(body.data.phone).toBe("+1-555-123-4567");
      expect(body.data.status).toBe("ACTIVE");
    });

    it("rejects duplicate email in the same store with 409 CUSTOMER_ALREADY_EXISTS", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const createReq = () =>
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/customers`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: owner.cookie,
            },
            body: JSON.stringify({ email: "duplicate@example.com" }),
          },
        );

      const res1 = await postCustomer(createReq(), {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res1.status).toBe(201);

      const res2 = await postCustomer(createReq(), {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res2.status).toBe(409);
      const body = await res2.json();
      expect(body.error.code).toBe("CUSTOMER_ALREADY_EXISTS");
    });

    it("retrieves a customer by ID with 200 and addresses included", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const createReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ email: "detail@example.com", firstName: "Alice" }),
        },
      );
      const createRes = await postCustomer(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const created = (await createRes.json()).data;

      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${created.id}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const getRes = await getCustomer(getReq, {
        params: Promise.resolve({ storeId: store.id, customerId: created.id }),
      });
      expect(getRes.status).toBe(200);
      const body = await getRes.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(created.id);
      expect(body.data.email).toBe("detail@example.com");
      expect(body.data.addresses).toEqual([]);
      expect(body.data.defaultAddress).toBeNull();
    });

    it("returns 404 CUSTOMER_NOT_FOUND when customer does not exist", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const fakeId = generateUuidV7();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${fakeId}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const res = await getCustomer(req, {
        params: Promise.resolve({ storeId: store.id, customerId: fakeId }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("CUSTOMER_NOT_FOUND");
    });

    it("updates customer profile with PATCH", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const createReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ email: "bob@example.com", firstName: "Bob" }),
        },
      );
      const createRes = await postCustomer(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const created = (await createRes.json()).data;

      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${created.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            firstName: "Robert",
            lastName: "Smith",
            phone: "+1-800-555-0199",
          }),
        },
      );
      const patchRes = await patchCustomer(patchReq, {
        params: Promise.resolve({ storeId: store.id, customerId: created.id }),
      });
      expect(patchRes.status).toBe(200);
      const body = await patchRes.json();
      expect(body.success).toBe(true);
      expect(body.data.firstName).toBe("Robert");
      expect(body.data.lastName).toBe("Smith");
      expect(body.data.phone).toBe("+1-800-555-0199");
    });

    it("lists customers with cursor pagination and search", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      for (let i = 1; i <= 5; i++) {
        const req = new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/customers`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: owner.cookie,
            },
            body: JSON.stringify({
              email: `user${i}@pagination.com`,
              firstName: `User${i}`,
              lastName: "Test",
            }),
          },
        );
        await postCustomer(req, {
          params: Promise.resolve({ storeId: store.id }),
        });
      }

      // Page 1 with limit 2
      const page1Req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers?limit=2`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const page1Res = await getCustomers(page1Req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(page1Res.status).toBe(200);
      const page1Body = await page1Res.json();
      expect(page1Body.data.items).toHaveLength(2);
      expect(page1Body.data.hasMore).toBe(true);
      expect(page1Body.data.nextCursor).toBeDefined();

      // Search
      const searchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers?search=user3`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const searchRes = await getCustomers(searchReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(searchRes.status).toBe(200);
      const searchBody = await searchRes.json();
      expect(searchBody.data.items).toHaveLength(1);
      expect(searchBody.data.items[0].email).toBe("user3@pagination.com");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Customer Lifecycle (enable / disable)
  // ---------------------------------------------------------------------------
  describe("Customer Lifecycle", () => {
    it("disables an active customer and then re-enables it", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const createReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ email: "lifecycle@example.com" }),
        },
      );
      const createRes = await postCustomer(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const customer = (await createRes.json()).data;
      expect(customer.status).toBe("ACTIVE");

      // Disable
      const disableReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/disable`,
        {
          method: "POST",
          headers: { cookie: owner.cookie },
        },
      );
      const disableRes = await disableCustomer(disableReq, {
        params: Promise.resolve({ storeId: store.id, customerId: customer.id }),
      });
      expect(disableRes.status).toBe(200);
      const disabledBody = await disableRes.json();
      expect(disabledBody.data.status).toBe("DISABLED");

      // Enable
      const enableReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/enable`,
        {
          method: "POST",
          headers: { cookie: owner.cookie },
        },
      );
      const enableRes = await enableCustomer(enableReq, {
        params: Promise.resolve({ storeId: store.id, customerId: customer.id }),
      });
      expect(enableRes.status).toBe(200);
      const enabledBody = await enableRes.json();
      expect(enabledBody.data.status).toBe("ACTIVE");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Customer Addresses
  // ---------------------------------------------------------------------------
  describe("Customer Addresses", () => {
    it("creates, retrieves, updates, sets default, and deletes customer addresses", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      // Create customer
      const custReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ email: "addresses@example.com" }),
        },
      );
      const custRes = await postCustomer(custReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const customer = (await custRes.json()).data;

      // 1. Create Address 1 (default)
      const addr1Req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            addressLine1: "123 Main St",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "US",
            firstName: "John",
            lastName: "Doe",
            isDefault: true,
          }),
        },
      );
      const addr1Res = await postAddress(addr1Req, {
        params: Promise.resolve({ storeId: store.id, customerId: customer.id }),
      });
      expect(addr1Res.status).toBe(201);
      const addr1 = (await addr1Res.json()).data;
      expect(addr1.id).toBeDefined();
      expect(addr1.addressLine1).toBe("123 Main St");
      expect(addr1.isDefault).toBe(true);

      // 2. Create Address 2 (non-default)
      const addr2Req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            addressLine1: "456 Oak Ave",
            city: "Boston",
            state: "MA",
            postalCode: "02108",
            country: "US",
            isDefault: false,
          }),
        },
      );
      const addr2Res = await postAddress(addr2Req, {
        params: Promise.resolve({ storeId: store.id, customerId: customer.id }),
      });
      expect(addr2Res.status).toBe(201);
      const addr2 = (await addr2Res.json()).data;
      expect(addr2.isDefault).toBe(false);

      // 3. List addresses
      const listReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const listRes = await getAddresses(listReq, {
        params: Promise.resolve({ storeId: store.id, customerId: customer.id }),
      });
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.data.items).toHaveLength(2);

      // 4. Get Address 1
      const getAddrReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses/${addr1.id}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const getAddrRes = await getAddress(getAddrReq, {
        params: Promise.resolve({
          storeId: store.id,
          customerId: customer.id,
          addressId: addr1.id,
        }),
      });
      expect(getAddrRes.status).toBe(200);
      expect((await getAddrRes.json()).data.id).toBe(addr1.id);

      // 5. Update Address 2
      const updateAddrReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses/${addr2.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            addressLine2: "Suite 400",
            company: "Acme Corp",
          }),
        },
      );
      const updateAddrRes = await patchAddress(updateAddrReq, {
        params: Promise.resolve({
          storeId: store.id,
          customerId: customer.id,
          addressId: addr2.id,
        }),
      });
      expect(updateAddrRes.status).toBe(200);
      const updatedAddr2 = (await updateAddrRes.json()).data;
      expect(updatedAddr2.addressLine2).toBe("Suite 400");
      expect(updatedAddr2.company).toBe("Acme Corp");

      // 6. Set Address 2 as default
      const defaultReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses/${addr2.id}/default`,
        {
          method: "POST",
          headers: { cookie: owner.cookie },
        },
      );
      const defaultRes = await setDefaultAddress(defaultReq, {
        params: Promise.resolve({
          storeId: store.id,
          customerId: customer.id,
          addressId: addr2.id,
        }),
      });
      expect(defaultRes.status).toBe(200);
      expect((await defaultRes.json()).data.isDefault).toBe(true);

      // Verify Address 1 is no longer default
      const checkAddr1Req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses/${addr1.id}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const checkAddr1Res = await getAddress(checkAddr1Req, {
        params: Promise.resolve({
          storeId: store.id,
          customerId: customer.id,
          addressId: addr1.id,
        }),
      });
      expect((await checkAddr1Res.json()).data.isDefault).toBe(false);

      // 7. Delete Address 1
      const deleteReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${customer.id}/addresses/${addr1.id}`,
        {
          method: "DELETE",
          headers: { cookie: owner.cookie },
        },
      );
      const deleteRes = await deleteAddress(deleteReq, {
        params: Promise.resolve({
          storeId: store.id,
          customerId: customer.id,
          addressId: addr1.id,
        }),
      });
      expect(deleteRes.status).toBe(200);
      expect((await deleteRes.json()).data.deleted).toBe(true);

      // Verify Address 1 is gone
      const deletedCheckRes = await getAddress(checkAddr1Req, {
        params: Promise.resolve({
          storeId: store.id,
          customerId: customer.id,
          addressId: addr1.id,
        }),
      });
      expect(deletedCheckRes.status).toBe(404);
      expect((await deletedCheckRes.json()).error.code).toBe("ADDRESS_NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Tenant Isolation Boundary
  // ---------------------------------------------------------------------------
  describe("Tenant Isolation Boundary", () => {
    it("strictly prevents cross-store customer access (Store B cannot access Store A customer)", async () => {
      const storeA = await createStoreWithOwner("ownerA@storeA.com");
      const storeB = await createStoreWithOwner("ownerB@storeB.com");

      // Create customer in Store A
      const custReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: storeA.user.cookie,
          },
          body: JSON.stringify({ email: "secret@storeA.com", firstName: "Secret" }),
        },
      );
      const custRes = await postCustomer(custReq, {
        params: Promise.resolve({ storeId: storeA.store.id }),
      });
      const customerA = (await custRes.json()).data;

      // 1. Store B attempts to GET Customer A via Store B URL -> 404
      const crossGetReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.store.id}/customers/${customerA.id}`,
        {
          method: "GET",
          headers: { cookie: storeB.user.cookie },
        },
      );
      const crossGetRes = await getCustomer(crossGetReq, {
        params: Promise.resolve({
          storeId: storeB.store.id,
          customerId: customerA.id,
        }),
      });
      expect(crossGetRes.status).toBe(404);
      expect((await crossGetRes.json()).error.code).toBe("CUSTOMER_NOT_FOUND");

      // 2. Store B attempts to PATCH Customer A via Store B URL -> 404
      const crossPatchReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.store.id}/customers/${customerA.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: storeB.user.cookie,
          },
          body: JSON.stringify({ firstName: "Hacked" }),
        },
      );
      const crossPatchRes = await patchCustomer(crossPatchReq, {
        params: Promise.resolve({
          storeId: storeB.store.id,
          customerId: customerA.id,
        }),
      });
      expect(crossPatchRes.status).toBe(404);
      expect((await crossPatchRes.json()).error.code).toBe("CUSTOMER_NOT_FOUND");

      // 3. Store B attempts to access Store A URL directly -> 404 (tenant-safe membership check)
      const directCrossReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.store.id}/customers/${customerA.id}`,
        {
          method: "GET",
          headers: { cookie: storeB.user.cookie },
        },
      );
      const directCrossRes = await getCustomer(directCrossReq, {
        params: Promise.resolve({
          storeId: storeA.store.id,
          customerId: customerA.id,
        }),
      });
      expect(directCrossRes.status).toBe(404);
      expect((await directCrossRes.json()).error.code).toBe("NOT_FOUND");
    });

    it("allows the same email to exist in two different stores", async () => {
      const storeA = await createStoreWithOwner("ownerA2@storeA.com");
      const storeB = await createStoreWithOwner("ownerB2@storeB.com");

      const email = "shared.shopper@domain.com";

      // Create in Store A
      const reqA = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: storeA.user.cookie,
          },
          body: JSON.stringify({ email }),
        },
      );
      const resA = await postCustomer(reqA, {
        params: Promise.resolve({ storeId: storeA.store.id }),
      });
      expect(resA.status).toBe(201);

      // Create in Store B
      const reqB = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: storeB.user.cookie,
          },
          body: JSON.stringify({ email }),
        },
      );
      const resB = await postCustomer(reqB, {
        params: Promise.resolve({ storeId: storeB.store.id }),
      });
      expect(resB.status).toBe(201);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Validation & Bad Inputs
  // ---------------------------------------------------------------------------
  describe("Validation & Bad Inputs", () => {
    it("rejects invalid email with 400 VALIDATION_ERROR", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ email: "not-an-email" }),
        },
      );
      const res = await postCustomer(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects malformed UUID path parameters with 400 VALIDATION_ERROR", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/not-a-uuid`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const res = await getCustomer(req, {
        params: Promise.resolve({
          storeId: store.id,
          customerId: "not-a-uuid",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid pagination limit with 400 VALIDATION_ERROR", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers?limit=999`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const res = await getCustomers(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects address creation with missing required fields with 400 VALIDATION_ERROR", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const custId = generateUuidV7();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/customers/${custId}/addresses`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            // Missing city, country, postalCode, addressLine1
            firstName: "John",
          }),
        },
      );
      const res = await postAddress(req, {
        params: Promise.resolve({ storeId: store.id, customerId: custId }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
