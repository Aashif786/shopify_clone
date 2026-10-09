import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { PaymentOrderIntegration } from "../../modules/payments/src/application/payment-order-integration.js";
import {
  CrossStorePaymentAccessError,
  PaymentNotFoundError,
  PaymentValidationError,
} from "../../modules/payments/src/domain/payment-errors.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Captured Payment to Order Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const orderIntegration = new PaymentOrderIntegration();

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

  async function seedTestStore(
    db: Database,
    slug = "pmt-order-store",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { orgId, storeId };
  }

  async function seedProductAndVariant(
    db: Database,
    storeId: string,
    price = 5000,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Classic Hoodie', $3, 'ACTIVE')`,
      [productId, storeId, `hoodie-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Large Grey', 'HD-GRY-L', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    return { productId, variantId };
  }

  async function seedCheckoutWithItem(
    db: Database,
    storeId: string,
    variantId: string,
    options?: {
      quantity?: number;
      price?: number;
      status?: string;
      currency?: string;
    },
  ): Promise<{ cartId: string; checkoutId: string }> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    const quantity = options?.quantity ?? 1;
    const price = options?.price ?? 5000;
    const total = quantity * price;
    const status = options?.status ?? "PAYMENT_PENDING";
    const currency = options?.currency ?? "USD";

    const address = JSON.stringify({
      firstName: "Jane",
      lastName: "Doe",
      addressLine1: "123 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      phone: "+15551234567",
    });

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency, shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $5, 'PENDING', $6, $7, $7)`,
      [checkoutId, storeId, cartId, total, status, currency, address],
    );

    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Classic Hoodie', 'Large Grey', 'HD-GRY-L', $5, $6, $7)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price, quantity, total],
    );

    return { cartId, checkoutId };
  }

  async function seedPayment(
    db: Database,
    storeId: string,
    checkoutId: string,
    options?: {
      amount?: number;
      currency?: string;
      status?: string;
      orderId?: string | null;
    },
  ): Promise<string> {
    const paymentId = generateUuidV7();
    const amount = options?.amount ?? 5000;
    const currency = options?.currency ?? "USD";
    const status = options?.status ?? "CAPTURED";
    const orderId = options?.orderId ?? null;

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'razorpay', $5, 0)`,
      [paymentId, storeId, checkoutId, orderId, amount, currency, status],
    );

    return paymentId;
  }

  it("creates order and finalizes checkout when payment is captured", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "order-success");
    const { variantId } = await seedProductAndVariant(db, storeId, 5000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, { price: 5000 });
    const paymentId = await seedPayment(db, storeId, checkoutId, { amount: 5000, status: "CAPTURED" });

    const result = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      paymentId,
    });

    expect(result.orderCreated).toBe(true);
    expect(result.order.total).toBe(5000);
    expect(result.order.paymentStatus).toBe("PAID");
    expect(result.checkout.status).toBe("COMPLETED");

    // Verify order is linked in payments table
    const paymentRes = await db.query<{ order_id: string }>(
      `SELECT order_id FROM payments WHERE id = $1`,
      [paymentId],
    );
    expect(paymentRes.rows[0]?.order_id).toBe(result.order.id);

    // Verify checkout is marked COMPLETED in database
    const checkoutRes = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRes.rows[0]?.status).toBe("COMPLETED");
  });

  it("rejects order creation if payment is not in CAPTURED status", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "order-uncaptured");
    const { variantId } = await seedProductAndVariant(db, storeId, 3000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, { price: 3000 });
    const paymentId = await seedPayment(db, storeId, checkoutId, {
      amount: 3000,
      status: "CREATED", // Not captured!
    });

    await expect(
      orderIntegration.completePurchaseWorkflow(db, { storeId, paymentId }),
    ).rejects.toThrow(PaymentValidationError);
  });

  it("is idempotent when retried after order was already created", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "order-idemp");
    const { variantId } = await seedProductAndVariant(db, storeId, 4500);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, { price: 4500 });
    const paymentId = await seedPayment(db, storeId, checkoutId, { amount: 4500, status: "CAPTURED" });

    const first = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      paymentId,
    });
    expect(first.orderCreated).toBe(true);

    const second = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      paymentId,
    });
    expect(second.orderCreated).toBe(false);
    expect(second.order.id).toBe(first.order.id);

    // Verify exactly one order exists in database
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(countRes.rows[0]?.count).toBe("1");
  });

  it("safely handles concurrent workflow calls and produces exactly one order", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "order-concurrent");
    const { variantId } = await seedProductAndVariant(db, storeId, 8000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, { price: 8000 });
    const paymentId = await seedPayment(db, storeId, checkoutId, { amount: 8000, status: "CAPTURED" });

    const [res1, res2] = await Promise.all([
      orderIntegration.completePurchaseWorkflow(db, { storeId, paymentId }),
      orderIntegration.completePurchaseWorkflow(db, { storeId, paymentId }),
    ]);

    expect(res1.order.id).toBe(res2.order.id);

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(countRes.rows[0]?.count).toBe("1");
  });

  it("rejects order creation if payment and checkout amounts mismatch", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "order-mismatch");
    const { variantId } = await seedProductAndVariant(db, storeId, 6000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, { price: 6000 });
    // Payment amount is 5000, but checkout is 6000!
    const paymentId = await seedPayment(db, storeId, checkoutId, { amount: 5000, status: "CAPTURED" });

    await expect(
      orderIntegration.completePurchaseWorkflow(db, { storeId, paymentId }),
    ).rejects.toThrow(PaymentValidationError);
  });

  it("enforces tenant boundary and rejects cross-store payment access", async () => {
    const db = await setupDb();
    const { storeId: storeA } = await seedTestStore(db, "store-a-ord");
    const { storeId: storeB } = await seedTestStore(db, "store-b-ord");
    const { variantId } = await seedProductAndVariant(db, storeA, 2000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeA, variantId, { price: 2000 });
    const paymentId = await seedPayment(db, storeA, checkoutId, { amount: 2000, status: "CAPTURED" });

    await expect(
      orderIntegration.completePurchaseWorkflow(db, {
        storeId: storeB, // Wrong store!
        paymentId,
      }),
    ).rejects.toThrow(CrossStorePaymentAccessError);

    await expect(
      orderIntegration.completePurchaseWorkflow(db, {
        storeId: storeA,
        paymentId: generateUuidV7(), // Non-existent
      }),
    ).rejects.toThrow(PaymentNotFoundError);
  });
});
