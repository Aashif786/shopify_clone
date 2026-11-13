import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { CheckoutService, InvalidCheckoutStateTransitionError } from "@calcart/checkout";
import { InventoryService } from "@calcart/inventory";
import { PaymentOrderIntegration } from "../../modules/payments/src/index.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

/**
 * Regression: placing a Cash on Delivery order failed with
 * "Cannot transition checkout from status 'OPEN' to 'COMPLETED'".
 *
 * The checkout state machine only allows OPEN -> PAYMENT_PENDING -> COMPLETED. The COD
 * workflow completed an OPEN checkout directly. It must go through the domain's
 * beginPayment() step first, and COD must stay an unpaid (PENDING) payment.
 */
describe("Cash on Delivery checkout workflow", { timeout: 120_000, hookTimeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const integration = new PaymentOrderIntegration();
  const checkoutService = new CheckoutService();
  const inventoryService = new InventoryService();

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

  async function seed(db: Database, status = "OPEN") {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const price = 5000;

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Org COD', 'ACTIVE')`, [orgId]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'COD Store', $3, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, `cod-${storeId.slice(-8)}`],
    );
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, 'Mug', $3, 'ACTIVE')`,
      [productId, storeId, `mug-${productId.slice(-8)}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Black', 'MUG-BLK', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 5, 0)`,
      [generateUuidV7(), storeId, variantId],
    );
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeId]);

    const address = JSON.stringify({
      firstName: "Alice",
      lastName: "Smith",
      addressLine1: "456 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      phone: "+15559876543",
    });
    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, email, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency, shipping_address, billing_address
       ) VALUES ($1, $2, $3, 'alice@example.com', $4, $4, 0, 0, 0, $5, 'PENDING', 'USD', $6, $6)`,
      [checkoutId, storeId, cartId, price, status, address],
    );
    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Mug', 'Black', 'MUG-BLK', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price],
    );

    // The payment route reserves stock against the checkout before placing the order.
    await inventoryService.reserveMany(db, storeId, {
      referenceType: "checkout",
      referenceId: checkoutId,
      items: [{ variantId, quantity: 1 }],
    });

    return { storeId, checkoutId, variantId };
  }

  it("places a COD order from an OPEN checkout via valid transitions, unpaid", async () => {
    const db = await setupDb();
    const { storeId, checkoutId } = await seed(db);

    const { order, checkout } = await integration.completeCodPurchaseWorkflow(db, {
      storeId,
      checkoutId,
    });

    expect(checkout.status).toBe("COMPLETED");
    expect(order.status).toBe("CONFIRMED");
    // COD is not an online payment: nothing has been collected at placement.
    expect(order.paymentStatus).toBe("PENDING");

    const payments = await db.query<{ provider: string; status: string; captured_amount: string }>(
      `SELECT provider, status, captured_amount FROM payments WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0]).toMatchObject({ provider: "COD", status: "PENDING" });
    expect(Number(payments.rows[0]!.captured_amount)).toBe(0);
  });

  it("moves the inventory reservation from the checkout to the order without double reserving", async () => {
    const db = await setupDb();
    const { storeId, checkoutId, variantId } = await seed(db);

    const { order } = await integration.completeCodPurchaseWorkflow(db, { storeId, checkoutId });

    const reservations = await db.query<{ reference_type: string; reference_id: string; status: string }>(
      `SELECT reference_type, reference_id, status FROM inventory_reservations WHERE store_id = $1`,
      [storeId],
    );
    expect(reservations.rows).toEqual([
      { reference_type: "order", reference_id: order.id, status: "ACTIVE" },
    ]);

    const stock = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE variant_id = $1`,
      [variantId],
    );
    expect(Number(stock.rows[0]!.reserved_quantity)).toBe(1);
  });

  it("is idempotent: a duplicate submission returns the same order and creates no second one", async () => {
    const db = await setupDb();
    const { storeId, checkoutId } = await seed(db);

    const first = await integration.completeCodPurchaseWorkflow(db, { storeId, checkoutId });
    const second = await integration.completeCodPurchaseWorkflow(db, { storeId, checkoutId });

    expect(second.order.id).toBe(first.order.id);
    const orders = await db.query(`SELECT id FROM orders WHERE checkout_id = $1`, [checkoutId]);
    expect(orders.rows).toHaveLength(1);
    const payments = await db.query(`SELECT id FROM payments WHERE checkout_id = $1`, [checkoutId]);
    expect(payments.rows).toHaveLength(1);
  });

  it("still rejects an OPEN -> COMPLETED jump made directly (the state machine is unchanged)", async () => {
    const db = await setupDb();
    const { storeId, checkoutId } = await seed(db);

    await expect(checkoutService.completeCheckout(db, storeId, checkoutId)).rejects.toBeInstanceOf(
      InvalidCheckoutStateTransitionError,
    );
  });

  it("rejects COD for a cancelled checkout and creates no order", async () => {
    const db = await setupDb();
    const { storeId, checkoutId } = await seed(db, "CANCELLED");

    await expect(
      integration.completeCodPurchaseWorkflow(db, { storeId, checkoutId }),
    ).rejects.toThrow();
    const orders = await db.query(`SELECT id FROM orders WHERE checkout_id = $1`, [checkoutId]);
    expect(orders.rows).toHaveLength(0);
  });
});
