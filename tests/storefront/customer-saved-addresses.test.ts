import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { serializeCustomerSessionCookie } from "@calcart/auth";
import { CustomerService } from "@calcart/customers";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { POST as setDefaultAddressRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/account/addresses/[addressId]/default/route.js";
import { DELETE as deleteAddressRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/account/addresses/[addressId]/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Storefront Customer Saved Addresses Management", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const customerService = new CustomerService();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;
  });

  afterAll(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createStore(slug: string) {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { storeId, slug };
  }

  async function createCustomerSession(
    storeId: string,
    slug: string,
    name = "Test Customer",
  ) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();
    const email = `buyer-${userId.slice(-8)}@example.com`;
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, $3, 'scrypt:hash', 'ACTIVE')`,
      [userId, email, name],
    );
    const expiresAt = new Date(Date.now() + 86_400_000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );
    const customer = await customerService.resolveStoreCustomerForUser(db, storeId, {
      userId,
      email,
      firstName: name.split(" ")[0] || "Test",
      lastName: name.split(" ")[1] || "Customer",
      emailVerified: true,
    });
    const cookie = serializeCustomerSessionCookie(sessionId, slug, { expires: expiresAt }).split(";")[0]!;
    return { cookie, email, userId, customerId: customer.id };
  }

  const defaultCtx = (slug: string, addressId: string) => ({
    params: Promise.resolve({ storeSlug: slug, addressId }),
  });
  const withCookie = (url: string, cookie?: string, method = "POST") =>
    new Request(url, { method, headers: cookie ? { cookie } : {} });

  it("1. Selecting a saved address makes it the default address and updates other addresses", async () => {
    const { storeId, slug } = await createStore("addr-store-1");
    const { cookie, customerId } = await createCustomerSession(storeId, slug);

    // Add 2 addresses for this customer: address 1 is initial default, address 2 is not
    const addr1 = await customerService.createAddress(db, storeId, customerId, {
      firstName: "John",
      lastName: "Doe",
      addressLine1: "123 Main St",
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
      country: "US",
      isDefault: true,
    });

    const addr2 = await customerService.createAddress(db, storeId, customerId, {
      firstName: "John",
      lastName: "Doe",
      addressLine1: "456 Oak Ave",
      city: "Springfield",
      state: "IL",
      postalCode: "62702",
      country: "US",
      isDefault: false,
    });

    expect(addr1.isDefault).toBe(true);
    expect(addr2.isDefault).toBe(false);

    // Make address 2 the default via the storefront route
    const res = await setDefaultAddressRoute(
      withCookie(`https://app.test/api/v1/storefront/${slug}/account/addresses/${addr2.id}/default`, cookie),
      defaultCtx(slug, addr2.id),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; isDefault: boolean } };
    expect(body.data.id).toBe(addr2.id);
    expect(body.data.isDefault).toBe(true);

    // Verify in customer addresses list that addr2 is now default and addr1 is no longer default
    const addresses = await customerService.listAddresses(db, storeId, customerId);
    const updatedAddr1 = addresses.find((a) => a.id === addr1.id);
    const updatedAddr2 = addresses.find((a) => a.id === addr2.id);

    expect(updatedAddr2?.isDefault).toBe(true);
    expect(updatedAddr1?.isDefault).toBe(false);
  });

  it("2. Deleting an address removes it successfully", async () => {
    const { storeId, slug } = await createStore("addr-store-2");
    const { cookie, customerId } = await createCustomerSession(storeId, slug);

    const addr = await customerService.createAddress(db, storeId, customerId, {
      firstName: "Jane",
      lastName: "Smith",
      addressLine1: "789 Pine Rd",
      city: "Chicago",
      postalCode: "60601",
      country: "US",
      isDefault: false,
    });

    const res = await deleteAddressRoute(
      withCookie(`https://app.test/api/v1/storefront/${slug}/account/addresses/${addr.id}`, cookie, "DELETE"),
      defaultCtx(slug, addr.id),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { success: boolean; deletedId: string } };
    expect(body.data.success).toBe(true);
    expect(body.data.deletedId).toBe(addr.id);

    // Verify address is gone
    const addresses = await customerService.listAddresses(db, storeId, customerId);
    expect(addresses.some((a) => a.id === addr.id)).toBe(false);
  });

  it("3. Deleting the current default address removes it cleanly", async () => {
    const { storeId, slug } = await createStore("addr-store-3");
    const { cookie, customerId } = await createCustomerSession(storeId, slug);

    const defaultAddr = await customerService.createAddress(db, storeId, customerId, {
      firstName: "Alice",
      lastName: "Wonderland",
      addressLine1: "1 Queen Way",
      city: "Wonder",
      postalCode: "12345",
      country: "US",
      isDefault: true,
    });

    const otherAddr = await customerService.createAddress(db, storeId, customerId, {
      firstName: "Alice",
      lastName: "Wonderland",
      addressLine1: "2 Rabbit Hole",
      city: "Wonder",
      postalCode: "12345",
      country: "US",
      isDefault: false,
    });

    // Delete the default address
    const res = await deleteAddressRoute(
      withCookie(`https://app.test/api/v1/storefront/${slug}/account/addresses/${defaultAddr.id}`, cookie, "DELETE"),
      defaultCtx(slug, defaultAddr.id),
    );

    expect(res.status).toBe(200);

    const addresses = await customerService.listAddresses(db, storeId, customerId);
    expect(addresses.some((a) => a.id === defaultAddr.id)).toBe(false);
    expect(addresses.some((a) => a.id === otherAddr.id)).toBe(true);
  });

  it("4. Cross-customer and cross-store address modification and deletion is rejected", async () => {
    const { storeId: store1, slug: slug1 } = await createStore("addr-store-4a");
    const { storeId: store2, slug: slug2 } = await createStore("addr-store-4b");

    const customerA = await createCustomerSession(store1, slug1, "Customer A");
    const customerB = await createCustomerSession(store1, slug1, "Customer B");
    const customerOtherStore = await createCustomerSession(store2, slug2, "Customer Other Store");

    // Add address for Customer A in Store 1
    const addrA = await customerService.createAddress(db, store1, customerA.customerId, {
      firstName: "Customer",
      lastName: "A",
      addressLine1: "100 Safe St",
      city: "Boston",
      postalCode: "02101",
      country: "US",
      isDefault: true,
    });

    // Customer B in Store 1 attempts to set Customer A's address as default -> Rejected (403 or 404)
    const setDefRes = await setDefaultAddressRoute(
      withCookie(`https://app.test/api/v1/storefront/${slug1}/account/addresses/${addrA.id}/default`, customerB.cookie),
      defaultCtx(slug1, addrA.id),
    );
    expect([403, 404]).toContain(setDefRes.status);

    // Customer B in Store 1 attempts to delete Customer A's address -> Rejected (403 or 404)
    const delRes = await deleteAddressRoute(
      withCookie(`https://app.test/api/v1/storefront/${slug1}/account/addresses/${addrA.id}`, customerB.cookie, "DELETE"),
      defaultCtx(slug1, addrA.id),
    );
    expect([403, 404]).toContain(delRes.status);

    // Customer from Store 2 attempts to set Customer A's address as default -> Rejected (403 or 404)
    const crossStoreRes = await setDefaultAddressRoute(
      withCookie(`https://app.test/api/v1/storefront/${slug2}/account/addresses/${addrA.id}/default`, customerOtherStore.cookie),
      defaultCtx(slug2, addrA.id),
    );
    expect([403, 404]).toContain(crossStoreRes.status);
  });
});
