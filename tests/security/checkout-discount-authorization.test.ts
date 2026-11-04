import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { hashToken, serializeSessionCookie } from "@calcart/auth";
import { DiscountService } from "@calcart/discounts";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  DELETE as removeDiscount,
  POST as applyDiscount,
} from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/discount/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Checkout discount ownership", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeSlug = "discount-auth-store";
  const otherSlug = "discount-auth-other";
  let storeId: string;
  let otherStoreId: string;
  let variantId: string;

  afterEach(async () => {
    globalThis.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setup(): Promise<void> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    globalThis.__calcart_web_db = db;

    const orgId = generateUuidV7();
    storeId = generateUuidV7();
    otherStoreId = generateUuidV7();
    const productId = generateUuidV7();
    variantId = generateUuidV7();

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, 'Discount Auth Org', 'ACTIVE')`,
      [orgId],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Discount Auth', $3, 'ACTIVE', 'USD', 'en-US', 'UTC'),
              ($4, $2, 'Other Store', $5, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, storeSlug, otherStoreId, otherSlug],
    );
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Notebook', $3, 'ACTIVE')`,
      [productId, storeId, `notebook-${productId}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Plain', $4, 5000, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, `NB-${variantId}`],
    );
    await new DiscountService().createDiscount(db, storeId, {
      code: "SAVE10",
      name: "Ten percent",
      type: "PERCENTAGE",
      value: 10,
      status: "ACTIVE",
    });
  }

  async function seedCheckout(options: {
    customerId?: string | null;
    guestToken?: string | null;
    email?: string;
  }): Promise<string> {
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const guestTokenHash = options.guestToken ? hashToken(options.guestToken) : null;
    const address = JSON.stringify({
      firstName: "Ada",
      lastName: "Lovelace",
      addressLine1: "99 Secret Lane",
      city: "Mumbai",
      state: "MH",
      postalCode: "400001",
      country: "IN",
    });

    await db.query(
      `INSERT INTO carts (id, store_id, customer_id, status, currency, subtotal, grand_total)
       VALUES ($1, $2, $3, 'ACTIVE', 'USD', 5000, 5000)`,
      [cartId, storeId, options.customerId ?? null],
    );
    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, customer_id, email, status, currency,
         subtotal, discount_total, tax_total, shipping_total, total,
         shipping_address, billing_address, guest_token_hash
       ) VALUES (
         $1, $2, $3, $4, $5, 'OPEN', 'USD',
         5000, 0, 0, 0, 5000,
         $6, $6, $7
       )`,
      [
        checkoutId,
        storeId,
        cartId,
        options.customerId ?? null,
        options.email ?? "secret-owner@example.com",
        address,
        guestTokenHash,
      ],
    );
    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Notebook', 'Plain', 5000, 1, 5000)`,
      [generateUuidV7(), checkoutId, storeId, variantId],
    );
    return checkoutId;
  }

  async function seedCustomer(email: string): Promise<{ customerId: string; cookie: string }> {
    const userId = generateUuidV7();
    const customerId = generateUuidV7();
    const sessionId = generateUuidV7();
    const expiresAt = new Date(Date.now() + 86_400_000);
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Customer', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    await db.query(
      `INSERT INTO customers (id, store_id, user_id, email, first_name, last_name)
       VALUES ($1, $2, $3, $4, 'Test', 'Customer')`,
      [customerId, storeId, userId, email],
    );
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );
    return {
      customerId,
      cookie: serializeSessionCookie(sessionId, { expires: expiresAt }),
    };
  }

  function apply(checkoutId: string, headers: Record<string, string>, slug = storeSlug) {
    return applyDiscount(
      new Request(`http://localhost/api/v1/storefront/${slug}/checkout/${checkoutId}/discount`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ code: "SAVE10" }),
      }),
      { params: Promise.resolve({ storeSlug: slug, checkoutId }) },
    );
  }

  function remove(checkoutId: string, headers: Record<string, string>, slug = storeSlug) {
    return removeDiscount(
      new Request(`http://localhost/api/v1/storefront/${slug}/checkout/${checkoutId}/discount`, {
        method: "DELETE",
        headers,
      }),
      { params: Promise.resolve({ storeSlug: slug, checkoutId }) },
    );
  }

  async function discountTotal(checkoutId: string): Promise<number> {
    const row = await db.query<{ discount_total: string; discount_code: string | null }>(
      `SELECT discount_total, discount_code FROM checkouts WHERE id = $1 AND store_id = $2`,
      [checkoutId, storeId],
    );
    return Number(row.rows[0]?.discount_total ?? -1);
  }

  async function errorShape(response: Response) {
    const json = (await response.json()) as {
      success?: boolean;
      data?: unknown;
      error?: { code?: string; message?: string };
    };
    return {
      status: response.status,
      success: json.success,
      data: json.data,
      code: json.error?.code,
      message: json.error?.message,
      raw: JSON.stringify(json),
    };
  }

  it("lets a guest owner apply and remove a discount", async () => {
    await setup();
    const token = "guest-owner-token";
    const checkoutId = await seedCheckout({ guestToken: token });

    const applied = await apply(checkoutId, { "x-guest-token": token });
    expect(applied.status).toBe(200);
    const appliedJson = await applied.json();
    expect(appliedJson.data.checkout.discountTotal).toBe(500);
    expect(appliedJson.data.checkout.discountCode).toBe("SAVE10");
    expect(appliedJson.data.discount.amount).toBe(500);
    expect(appliedJson.data.checkout.guestTokenHash).toBeUndefined();
    expect(await discountTotal(checkoutId)).toBe(500);

    const removed = await remove(checkoutId, { "x-guest-token": token });
    expect(removed.status).toBe(200);
    const removedJson = await removed.json();
    expect(removedJson.data.checkout.discountTotal).toBe(0);
    expect(removedJson.data.checkout.discountCode).toBeNull();
    expect(removedJson.data.checkout.guestTokenHash).toBeUndefined();
    expect(await discountTotal(checkoutId)).toBe(0);
  });

  it("lets an authenticated customer apply and remove a discount on their checkout", async () => {
    await setup();
    const owner = await seedCustomer("owner@example.com");
    const checkoutId = await seedCheckout({
      customerId: owner.customerId,
      email: "owner@example.com",
    });

    const applied = await apply(checkoutId, { cookie: owner.cookie });
    expect(applied.status).toBe(200);
    const appliedJson = await applied.json();
    expect(appliedJson.data.checkout.discountTotal).toBe(500);
    expect(await discountTotal(checkoutId)).toBe(500);

    const removed = await remove(checkoutId, { cookie: owner.cookie });
    expect(removed.status).toBe(200);
    const removedJson = await removed.json();
    expect(removedJson.data.checkout.discountTotal).toBe(0);
    expect(await discountTotal(checkoutId)).toBe(0);
  });

  it("rejects another guest, another customer, a caller without credentials, and a missing checkout with the same 404", async () => {
    await setup();
    const ownerToken = "guest-owner-token";
    const guestCheckoutId = await seedCheckout({ guestToken: ownerToken });
    const owner = await seedCustomer("owner@example.com");
    const intruder = await seedCustomer("intruder@example.com");
    const customerCheckoutId = await seedCheckout({
      customerId: owner.customerId,
      email: "owner@example.com",
    });
    const missingId = generateUuidV7();
    const closedCheckoutId = await seedCheckout({ guestToken: ownerToken });
    await db.query(`UPDATE checkouts SET status = 'COMPLETED' WHERE id = $1 AND store_id = $2`, [
      closedCheckoutId,
      storeId,
    ]);

    const attacks = [
      apply(guestCheckoutId, { "x-guest-token": "other-guest-token" }),
      remove(guestCheckoutId, { "x-guest-token": "other-guest-token" }),
      apply(customerCheckoutId, { cookie: intruder.cookie }),
      remove(customerCheckoutId, { cookie: intruder.cookie }),
      apply(guestCheckoutId, {}),
      remove(customerCheckoutId, {}),
      apply(missingId, { "x-guest-token": ownerToken }),
      remove(missingId, {}),
      apply(guestCheckoutId, { "x-guest-token": ownerToken }, otherSlug),
      apply(closedCheckoutId, {}),
      remove(closedCheckoutId, { "x-guest-token": "other-guest-token" }),
    ];
    const results = await Promise.all(attacks.map((pending) => pending.then(errorShape)));
    const missing = results[6];
    if (!missing) {
      throw new Error("missing checkout response was not captured");
    }

    for (const result of results) {
      expect(result.status).toBe(missing.status);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.code).toBe("CHECKOUT_NOT_FOUND");
      expect(result.message).toBe(missing.message);
      expect(result.raw).not.toContain("secret-owner@example.com");
      expect(result.raw).not.toContain("owner@example.com");
      expect(result.raw).not.toContain("99 Secret Lane");
      expect(result.raw).not.toContain("guestTokenHash");
    }

    expect(await discountTotal(guestCheckoutId)).toBe(0);
    expect(await discountTotal(customerCheckoutId)).toBe(0);
  });
});
