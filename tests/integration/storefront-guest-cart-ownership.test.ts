import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { POST as addCartItemRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/cart/items/route.js";
import {
  PATCH as updateCartItemRoute,
  DELETE as removeCartItemRoute,
} from "../../apps/web/app/api/v1/storefront/[storeSlug]/cart/items/[itemId]/route.js";
import {
  POST as applyDiscountRoute,
  DELETE as removeDiscountRoute,
} from "../../apps/web/app/api/v1/storefront/[storeSlug]/cart/discount/route.js";
import {
  GET as getCartRoute,
  DELETE as clearCartRoute,
} from "../../apps/web/app/api/v1/storefront/[storeSlug]/cart/route.js";
import { POST as createCheckoutRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Storefront Guest Cart Ownership & Authorization Integration Suite", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;

  const storeSlug = "souled-store";
  let storeId: string;
  let variantId: string;
  let variant2Id: string;

  const otherStoreSlug = "other-merchant-store";
  let otherStoreId: string;
  let otherVariantId: string;

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = db;

    const orgId = generateUuidV7();
    storeId = generateUuidV7();
    const productId = generateUuidV7();
    variantId = generateUuidV7();
    variant2Id = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Souled Org', 'ACTIVE')`, [orgId]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'The Souled Store', $3, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, storeSlug],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Oversized Cotton Tee', 'oversized-cotton-tee', 'ACTIVE')`,
      [productId, storeId],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, position)
       VALUES ($1, $2, $3, 'Black / L', 'TEE-BLK-L', 2999, 1)`,
      [variantId, productId, storeId],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, position)
       VALUES ($1, $2, $3, 'White / M', 'TEE-WHT-M', 2499, 2)`,
      [variant2Id, productId, storeId],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 100, 0), ($4, $2, $5, 100, 0)`,
      [generateUuidV7(), storeId, variantId, generateUuidV7(), variant2Id],
    );

    const discountId = generateUuidV7();
    await db.query(
      `INSERT INTO discounts (id, store_id, name, code, type, value, status, starts_at)
       VALUES ($1, $2, 'Souled Promo', 'SOULED10', 'PERCENTAGE', 10, 'ACTIVE', NOW() - INTERVAL '1 day')`,
      [discountId, storeId],
    );

    // Other store for cross-tenant isolation testing
    otherStoreId = generateUuidV7();
    const otherProductId = generateUuidV7();
    otherVariantId = generateUuidV7();

    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Other Store', $3, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [otherStoreId, orgId, otherStoreSlug],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Other Product', 'other-product', 'ACTIVE')`,
      [otherProductId, otherStoreId],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, position)
       VALUES ($1, $2, $3, 'Standard', 'OTH-STD', 1500, 1)`,
      [otherVariantId, otherProductId, otherStoreId],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 50, 0)`,
      [generateUuidV7(), otherStoreId, otherVariantId],
    );
  });

  afterEach(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("completes full guest cart lifecycle with x-guest-identifier header", async () => {
    const guestId = "guest_header_test_001";

    // 1. Add item
    const addReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestId,
      },
      body: JSON.stringify({
        variantId,
        quantity: 1,
      }),
    });
    const addRes = await addCartItemRoute(addReq, { params: Promise.resolve({ storeSlug }) });
    expect(addRes.status).toBe(200);
    const addJson = await addRes.json();
    const cart = addJson.data.cart;
    const itemId = cart.items[0].id;
    expect(cart.guestIdentifier).toBe(guestId);
    expect(cart.items[0].quantity).toBe(1);

    // 2. Update item quantity (PATCH) with x-guest-identifier header
    const patchReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestId,
      },
      body: JSON.stringify({
        cartId: cart.id,
        quantity: 3,
      }),
    });
    const patchRes = await updateCartItemRoute(patchReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.data.cart.items[0].quantity).toBe(3);

    // 3. Apply discount code with x-guest-identifier header
    const discountReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestId,
      },
      body: JSON.stringify({
        cartId: cart.id,
        code: "SOULED10",
      }),
    });
    const discountRes = await applyDiscountRoute(discountReq, { params: Promise.resolve({ storeSlug }) });
    expect(discountRes.status).toBe(200);
    const discountJson = await discountRes.json();
    expect(discountJson.data.cart.discountTotal).toBeGreaterThan(0);

    // 4. Remove discount code with x-guest-identifier header
    const rmDiscountReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/discount?cartId=${cart.id}`, {
      method: "DELETE",
      headers: {
        "x-guest-identifier": guestId,
      },
    });
    const rmDiscountRes = await removeDiscountRoute(rmDiscountReq, { params: Promise.resolve({ storeSlug }) });
    expect(rmDiscountRes.status).toBe(200);
    const rmDiscountJson = await rmDiscountRes.json();
    expect(rmDiscountJson.data.cart.discountTotal).toBe(0);

    // 5. Get cart with x-guest-identifier header
    const getReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart?cartId=${cart.id}`, {
      method: "GET",
      headers: {
        "x-guest-identifier": guestId,
      },
    });
    const getRes = await getCartRoute(getReq, { params: Promise.resolve({ storeSlug }) });
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.cart.id).toBe(cart.id);

    // 6. Remove item (DELETE) with x-guest-identifier header
    const deleteReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}?cartId=${cart.id}`, {
      method: "DELETE",
      headers: {
        "x-guest-identifier": guestId,
      },
    });
    const deleteRes = await removeCartItemRoute(deleteReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(deleteRes.status).toBe(200);
    const deleteJson = await deleteRes.json();
    expect(deleteJson.data.cart.items.length).toBe(0);

    // 7. Add another item and then clear cart
    const addReq2 = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestId,
      },
      body: JSON.stringify({
        variantId: variant2Id,
        quantity: 2,
        cartId: cart.id,
      }),
    });
    const addRes2 = await addCartItemRoute(addReq2, { params: Promise.resolve({ storeSlug }) });
    expect(addRes2.status).toBe(200);

    const clearReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart?cartId=${cart.id}`, {
      method: "DELETE",
      headers: {
        "x-guest-identifier": guestId,
      },
    });
    const clearRes = await clearCartRoute(clearReq, { params: Promise.resolve({ storeSlug }) });
    expect(clearRes.status).toBe(200);
    const clearJson = await clearRes.json();
    expect(clearJson.data.cart.items.length).toBe(0);
  });

  it("authorizes operations when guestIdentifier is passed via body and query params", async () => {
    const guestId = "guest_body_param_test_002";

    // 1. Add item with body guestIdentifier
    const addReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        quantity: 2,
        guestIdentifier: guestId,
      }),
    });
    const addRes = await addCartItemRoute(addReq, { params: Promise.resolve({ storeSlug }) });
    expect(addRes.status).toBe(200);
    const addJson = await addRes.json();
    const cart = addJson.data.cart;
    const itemId = cart.items[0].id;
    expect(cart.guestIdentifier).toBe(guestId);

    // 2. PATCH item quantity with body guestIdentifier
    const patchReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: cart.id,
        quantity: 5,
        guestIdentifier: guestId,
      }),
    });
    const patchRes = await updateCartItemRoute(patchReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.data.cart.items[0].quantity).toBe(5);

    // 3. POST discount with body guestIdentifier
    const discountReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: cart.id,
        code: "SOULED10",
        guestIdentifier: guestId,
      }),
    });
    const discountRes = await applyDiscountRoute(discountReq, { params: Promise.resolve({ storeSlug }) });
    expect(discountRes.status).toBe(200);

    // 4. DELETE discount with query param guestIdentifier
    const rmDiscountReq = new Request(
      `http://localhost/api/v1/storefront/${storeSlug}/cart/discount?cartId=${cart.id}&guestIdentifier=${guestId}`,
      { method: "DELETE" },
    );
    const rmDiscountRes = await removeDiscountRoute(rmDiscountReq, { params: Promise.resolve({ storeSlug }) });
    expect(rmDiscountRes.status).toBe(200);

    // 5. DELETE item with query param guestIdentifier
    const deleteReq = new Request(
      `http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}?cartId=${cart.id}&guestIdentifier=${guestId}`,
      { method: "DELETE" },
    );
    const deleteRes = await removeCartItemRoute(deleteReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(deleteRes.status).toBe(200);
  });

  it("authorizes operations when guestIdentifier is extracted from cookies", async () => {
    const guestId = "guest_cookie_test_003";

    // 1. Add item with cookie
    const addReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `sc_${storeSlug}_guest_id=${guestId}`,
      },
      body: JSON.stringify({
        variantId,
        quantity: 1,
      }),
    });
    const addRes = await addCartItemRoute(addReq, { params: Promise.resolve({ storeSlug }) });
    expect(addRes.status).toBe(200);
    const addJson = await addRes.json();
    const cart = addJson.data.cart;
    const itemId = cart.items[0].id;
    expect(cart.guestIdentifier).toBe(guestId);

    // 2. PATCH item quantity with cookie
    const patchReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `sc_${storeSlug}_guest_id=${guestId}`,
      },
      body: JSON.stringify({
        cartId: cart.id,
        quantity: 2,
      }),
    });
    const patchRes = await updateCartItemRoute(patchReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(patchRes.status).toBe(200);

    // 3. POST discount with cookie
    const discountReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `sc_${storeSlug}_guest_id=${guestId}`,
      },
      body: JSON.stringify({
        cartId: cart.id,
        code: "SOULED10",
      }),
    });
    const discountRes = await applyDiscountRoute(discountReq, { params: Promise.resolve({ storeSlug }) });
    expect(discountRes.status).toBe(200);

    // 4. DELETE item with cookie
    const deleteReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}?cartId=${cart.id}`, {
      method: "DELETE",
      headers: {
        cookie: `sc_${storeSlug}_guest_id=${guestId}`,
      },
    });
    const deleteRes = await removeCartItemRoute(deleteReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(deleteRes.status).toBe(200);
  });

  it("creates checkout from guest cart with guestIdentifier", async () => {
    const guestId = "guest_checkout_test_004";

    const addReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestId,
      },
      body: JSON.stringify({
        variantId,
        quantity: 1,
      }),
    });
    const addRes = await addCartItemRoute(addReq, { params: Promise.resolve({ storeSlug }) });
    expect(addRes.status).toBe(200);
    const cart = (await addRes.json()).data.cart;

    // Create checkout with x-guest-identifier header and body guestIdentifier
    const checkoutReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestId,
      },
      body: JSON.stringify({
        cartId: cart.id,
        guestIdentifier: guestId,
        email: "guest@example.com",
      }),
    });
    const checkoutRes = await createCheckoutRoute(checkoutReq, { params: Promise.resolve({ storeSlug }) });
    expect(checkoutRes.status).toBe(201);
    const checkoutJson = await checkoutRes.json();
    expect(checkoutJson.data.checkout.cartId).toBe(cart.id);
    expect(checkoutJson.data.checkout.email).toBe("guest@example.com");
    expect(checkoutJson.data.checkout.guestToken).toBeDefined();
  });

  it("strictly enforces tenant ownership: blocks unauthorized guest from modifying another guest cart (HTTP 403)", async () => {
    const guestOwner = "guest_legitimate_owner";
    const guestAttacker = "guest_unauthorized_attacker";

    // 1. Legitimate owner creates cart and adds item
    const addReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestOwner,
      },
      body: JSON.stringify({
        variantId,
        quantity: 1,
      }),
    });
    const addRes = await addCartItemRoute(addReq, { params: Promise.resolve({ storeSlug }) });
    const cart = (await addRes.json()).data.cart;
    const itemId = cart.items[0].id;

    // 2. Attacker tries to modify item quantity -> 403 Forbidden
    const attackPatchReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestAttacker,
      },
      body: JSON.stringify({
        cartId: cart.id,
        quantity: 10,
      }),
    });
    const attackPatchRes = await updateCartItemRoute(attackPatchReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(attackPatchRes.status).toBe(403);
    const patchJson = await attackPatchRes.json();
    expect(patchJson.error.code).toBe("CART_ACCESS_DENIED");

    // 3. Attacker tries to apply discount -> 403 Forbidden
    const attackDiscountReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestAttacker,
      },
      body: JSON.stringify({
        cartId: cart.id,
        code: "SOULED10",
      }),
    });
    const attackDiscountRes = await applyDiscountRoute(attackDiscountReq, { params: Promise.resolve({ storeSlug }) });
    expect(attackDiscountRes.status).toBe(403);

    // 4. Attacker tries to delete item -> 403 Forbidden
    const attackDeleteReq = new Request(
      `http://localhost/api/v1/storefront/${storeSlug}/cart/items/${itemId}?cartId=${cart.id}`,
      {
        method: "DELETE",
        headers: { "x-guest-identifier": guestAttacker },
      },
    );
    const attackDeleteRes = await removeCartItemRoute(attackDeleteReq, { params: Promise.resolve({ storeSlug, itemId }) });
    expect(attackDeleteRes.status).toBe(403);

    // 5. Attacker tries to checkout the owner's cart -> rejected (400 / 403)
    const attackCheckoutReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestAttacker,
      },
      body: JSON.stringify({
        cartId: cart.id,
        email: "attacker@example.com",
      }),
    });
    const attackCheckoutRes = await createCheckoutRoute(attackCheckoutReq, { params: Promise.resolve({ storeSlug }) });
    expect([400, 403]).toContain(attackCheckoutRes.status);
  });

  it("strictly enforces cross-store isolation: prevents using cart from another store (HTTP 404/403)", async () => {
    const guestId = "guest_cross_store_test";

    // 1. Create cart in storeSlug
    const addReq = new Request(`http://localhost/api/v1/storefront/${storeSlug}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-identifier": guestId,
      },
      body: JSON.stringify({
        variantId,
        quantity: 1,
      }),
    });
    const addRes = await addCartItemRoute(addReq, { params: Promise.resolve({ storeSlug }) });
    const cart = (await addRes.json()).data.cart;

    // 2. Attempt to access or mutate store 1's cart using store 2's endpoint
    const crossStoreReq = new Request(
      `http://localhost/api/v1/storefront/${otherStoreSlug}/cart?cartId=${cart.id}`,
      {
        method: "GET",
        headers: { "x-guest-identifier": guestId },
      },
    );
    const crossStoreRes = await getCartRoute(crossStoreReq, { params: Promise.resolve({ storeSlug: otherStoreSlug }) });
    // In other store, store 1's cart cannot be found -> cart is null
    const crossStoreJson = await crossStoreRes.json();
    expect(crossStoreJson.data.cart).toBeNull();
  });
});
