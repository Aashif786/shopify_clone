import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { ProductService } from "@calcart/products";
import { CheckoutService } from "@calcart/checkout";
import { enrichCheckout } from "../../apps/web/src/lib/storefront-checkout-helpers.js";
import { generateSecureToken, hashToken } from "../../apps/web/src/lib/storefront-auth-helpers.js";
import { POST as processPaymentRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/payment/route.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Product-Level Cash on Delivery (COD) Toggle & Checkout Validation", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const productService = new ProductService();
  const checkoutService = new CheckoutService();

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
    return { orgId, storeId, slug };
  }

  async function createProductWithVariant(
    storeId: string,
    title: string,
    codEnabled: boolean,
    price = 2500,
  ) {
    const product = await productService.createProduct(db, storeId, {
      title,
      price,
      sku: `SKU-${generateUuidV7().slice(-6)}`,
      status: "ACTIVE",
      codEnabled,
    });

    const variantId = product.variants[0]!.id;

    // Seed inventory for variant
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 100, 0)`,
      [generateUuidV7(), storeId, variantId],
    );

    return { product, variantId };
  }

  async function createTestCheckout(
    storeId: string,
    items: Array<{ variantId: string; productName: string; price: number; quantity: number }>,
  ) {
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const guestToken = generateSecureToken();
    const guestTokenHash = hashToken(guestToken);
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeId]);

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingAddress = JSON.stringify({
      firstName: "Test",
      lastName: "Buyer",
      addressLine1: "123 Main St",
      city: "San Jose",
      state: "CA",
      postalCode: "95112",
      country: "US",
      phone: "+15551234567",
    });

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, email, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency, shipping_address, billing_address, guest_token_hash
       ) VALUES ($1, $2, $3, 'buyer@example.com', $4, $4, 0, 0, 0, 'OPEN', 'PENDING', 'USD', $5, $5, $6)`,
      [checkoutId, storeId, cartId, total, shippingAddress, guestTokenHash],
    );

    for (const item of items) {
      await db.query(
        `INSERT INTO checkout_items (
           id, checkout_id, store_id, variant_id, product_name_snapshot,
           variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
         ) VALUES ($1, $2, $3, $4, $5, 'Default', 'SKU-001', $6, $7, $8)`,
        [generateUuidV7(), checkoutId, storeId, item.variantId, item.productName, item.price, item.quantity, item.price * item.quantity],
      );
    }

    return { checkoutId, guestToken };
  }

  it("1. Product COD setting creation, persistence, and updating", async () => {
    const { storeId } = await createStore("cod-prod-crud");

    // Create product with codEnabled: false
    const prodDisabled = await productService.createProduct(db, storeId, {
      title: "No COD Product",
      price: 1500,
      codEnabled: false,
    });
    expect(prodDisabled.codEnabled).toBe(false);

    // Verify database row
    const dbRowDisabled = await db.query<{ cod_enabled: boolean }>(
      "SELECT cod_enabled FROM products WHERE id = $1",
      [prodDisabled.id],
    );
    expect(dbRowDisabled.rows[0]?.cod_enabled).toBe(false);

    // Create product with codEnabled: true
    const prodEnabled = await productService.createProduct(db, storeId, {
      title: "COD Product",
      price: 2000,
      codEnabled: true,
    });
    expect(prodEnabled.codEnabled).toBe(true);

    // Update product: toggle codEnabled from false to true
    const updated = await productService.updateProduct(db, storeId, prodDisabled.id, {
      codEnabled: true,
    });
    expect(updated.codEnabled).toBe(true);

    const reloaded = await productService.getProductById(db, storeId, prodDisabled.id);
    expect(reloaded.codEnabled).toBe(true);
  });

  it("2. Storefront enrichCheckout indicates COD availability based on cart items", async () => {
    const { storeId } = await createStore("cod-enrich");

    const itemEligible = await createProductWithVariant(storeId, "Eligible Item", true, 1000);
    const itemIneligible = await createProductWithVariant(storeId, "Ineligible Item", false, 2000);

    // Cart with only eligible items -> isCodAvailable is true
    const { checkoutId: checkoutEligibleId } = await createTestCheckout(storeId, [
      { variantId: itemEligible.variantId, productName: "Eligible Item", price: 1000, quantity: 1 },
    ]);
    const checkoutEligible = await checkoutService.getCheckout(db, storeId, checkoutEligibleId);
    const enrichedEligible = await enrichCheckout(db, storeId, checkoutEligible!);
    expect(enrichedEligible.isCodAvailable).toBe(true);

    // Cart with mixed items (one ineligible) -> isCodAvailable is false
    const { checkoutId: checkoutMixedId } = await createTestCheckout(storeId, [
      { variantId: itemEligible.variantId, productName: "Eligible Item", price: 1000, quantity: 1 },
      { variantId: itemIneligible.variantId, productName: "Ineligible Item", price: 2000, quantity: 1 },
    ]);
    const checkoutMixed = await checkoutService.getCheckout(db, storeId, checkoutMixedId);
    const enrichedMixed = await enrichCheckout(db, storeId, checkoutMixed!);
    expect(enrichedMixed.isCodAvailable).toBe(false);
  });

  it("3. Server-side checkout payment accepts COD when all products are eligible", async () => {
    const { storeId, slug } = await createStore("cod-pay-success");

    const itemEligible = await createProductWithVariant(storeId, "Eligible Shirt", true, 3000);
    const { checkoutId, guestToken } = await createTestCheckout(storeId, [
      { variantId: itemEligible.variantId, productName: "Eligible Shirt", price: 3000, quantity: 1 },
    ]);

    const req = new Request(
      `https://app.test/api/v1/storefront/${slug}/checkout/${checkoutId}/payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": guestToken,
        },
        body: JSON.stringify({ method: "COD" }),
      },
    );

    const res = await processPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: slug, checkoutId }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { order: { id: string; status: string; paymentStatus: string } } };
    expect(body.data.order).toBeDefined();
    expect(body.data.order.status).toBe("CONFIRMED");
    expect(body.data.order.paymentStatus).toBe("PENDING");
  });

  it("4. Server-side checkout payment rejects COD when any cart item is ineligible", async () => {
    const { storeId, slug } = await createStore("cod-pay-reject");

    const itemEligible = await createProductWithVariant(storeId, "Allowed Item", true, 1000);
    const itemIneligible = await createProductWithVariant(storeId, "Disallowed Item", false, 2000);

    // Multi-product cart containing at least one COD-disabled item
    const { checkoutId, guestToken } = await createTestCheckout(storeId, [
      { variantId: itemEligible.variantId, productName: "Allowed Item", price: 1000, quantity: 1 },
      { variantId: itemIneligible.variantId, productName: "Disallowed Item", price: 2000, quantity: 1 },
    ]);

    const req = new Request(
      `https://app.test/api/v1/storefront/${slug}/checkout/${checkoutId}/payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": guestToken,
        },
        body: JSON.stringify({ method: "COD" }),
      },
    );

    const res = await processPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: slug, checkoutId }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("COD_INELIGIBLE_ITEMS");
    expect(body.error.message).toContain("Cash on Delivery is not available");
  });
});
