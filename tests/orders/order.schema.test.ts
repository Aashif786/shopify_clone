import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  OrderRepository,
} from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Orders PostgreSQL Schema Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

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
    slug = "store-orders",
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

  async function seedTestCustomer(
    db: Database,
    storeId: string,
    email = "customer@example.com",
  ): Promise<string> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [customerId, storeId, email],
    );
    return customerId;
  }

  async function seedTestCart(db: Database, storeId: string): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    return cartId;
  }

  async function seedTestCheckout(
    db: Database,
    storeId: string,
    cartId: string,
    total = 5000,
  ): Promise<string> {
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId, total],
    );
    return checkoutId;
  }

  async function seedTestPayment(
    db: Database,
    storeId: string,
    checkoutId: string,
    amount = 5000,
  ): Promise<string> {
    const paymentId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, provider, captured_amount)
       VALUES ($1, $2, $3, $4, 'USD', 'CAPTURED', 'razorpay', $4)`,
      [paymentId, storeId, checkoutId, amount],
    );
    return paymentId;
  }

  async function seedTestProductAndVariant(
    db: Database,
    storeId: string,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Classic T-Shirt', 'classic-tshirt', 'ACTIVE')`,
      [productId, storeId],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Medium Black', 'TSHIRT-BLK-M', 2500, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId],
    );

    return { productId, variantId };
  }

  describe("1. Migration & Table Existence", () => {
    it("creates all 4 required order domain tables and applies forward migration 0010", async () => {
      const db = await setupDb();
      const res = await db.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN (
             'orders',
             'order_items',
             'order_addresses',
             'order_status_history'
           )
         ORDER BY table_name ASC`,
      );

      const tableNames = res.rows.map((r) => r.table_name);
      expect(tableNames).toEqual([
        "order_addresses",
        "order_items",
        "order_status_history",
        "orders",
      ]);
    });
  });

  describe("2. Orders Table Schema & Monetary / Status Constraints", () => {
    it("creates order record with valid financial defaults and minor unit integers", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-create");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000);
      const paymentId = await seedTestPayment(db, storeId, checkoutId, 5000);
      const customerId = await seedTestCustomer(db, storeId);
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (
           id, store_id, customer_id, checkout_id, payment_id,
           order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total,
           total, grand_total
         ) VALUES (
           $1, $2, $3, $4, $5,
           'ORD-1001', 'CONFIRMED', 'PAID', 'UNFULFILLED',
           'USD', 4000, 500, 1000, 500,
           5000, 5000
         )`,
        [orderId, storeId, customerId, checkoutId, paymentId],
      );

      const res = await db.query<{
        id: string;
        order_number: string;
        status: string;
        currency: string;
        total: string;
        grand_total: string;
      }>(`SELECT id, order_number, status, currency, total, grand_total FROM orders WHERE id = $1`, [orderId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0];
      expect(row?.order_number).toBe("ORD-1001");
      expect(row?.status).toBe("CONFIRMED");
      expect(row?.currency).toBe("USD");
      expect(Number(row?.total)).toBe(5000);
      expect(Number(row?.grand_total)).toBe(5000);
    });

    it("rejects invalid order status via check constraint", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-bad-status");
      const orderId = generateUuidV7();

      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, 'ORD-999', 'INVALID_STATUS', 'USD', 1000, 1000)`,
          [orderId, storeId],
        ),
      ).rejects.toThrow(/orders_status_check/);
    });

    it("rejects negative financial amounts via check constraints", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-neg-amt");

      // Negative total
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, 'ORD-NEG', 'PENDING', 'USD', -500, 0)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow(/orders_total_check/);

      // Negative grand_total
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, 'ORD-NEG-GT', 'PENDING', 'USD', 0, -500)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow(/orders_grand_total_check/);

      // Negative subtotal
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, order_number, status, currency, subtotal, total, grand_total)
           VALUES ($1, $2, 'ORD-NEG-SUB', 'PENDING', 'USD', -100, 1000, 1000)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow(/orders_subtotal_check/);
    });

    it("enforces uppercase 3-letter currency code check constraint", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-curr-fmt");

      // Lowercase currency
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, 'ORD-CUR-1', 'PENDING', 'usd', 1000, 1000)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow(/orders_currency_format_check/);

      // Length != 3
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, 'ORD-CUR-2', 'PENDING', 'US', 1000, 1000)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow(/orders_currency_format_check/);
    });

    it("enforces unique order_number per store while allowing same number in different stores", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "ord-num-a");
      const { storeId: storeB } = await seedTestStore(db, "ord-num-b");

      // Order in Store A
      await db.query(
        `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, 'ORD-1001', 'PENDING', 'USD', 1000, 1000)`,
        [generateUuidV7(), storeA],
      );

      // Duplicate order number in Store A fails
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, 'ORD-1001', 'PENDING', 'USD', 2000, 2000)`,
          [generateUuidV7(), storeA],
        ),
      ).rejects.toThrow(/orders_store_order_number_unique/);

      // Same order number in Store B succeeds (store scope)
      const resB = await db.query(
        `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, 'ORD-1001', 'PENDING', 'USD', 3000, 3000)
         RETURNING id`,
        [generateUuidV7(), storeB],
      );
      expect(resB.rows).toHaveLength(1);
    });

    it("enforces unique checkout_id per store for idempotent order creation", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-idem-chk");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000);

      // First order for checkout succeeds
      await db.query(
        `INSERT INTO orders (id, store_id, checkout_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, $3, 'ORD-CHK-1', 'CONFIRMED', 'USD', 5000, 5000)`,
        [generateUuidV7(), storeId, checkoutId],
      );

      // Second order for same checkout violates uniqueness
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, checkout_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, $3, 'ORD-CHK-2', 'CONFIRMED', 'USD', 5000, 5000)`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/orders_store_checkout_idx/);
    });
  });

  describe("3. Order Items Schema & Snapshot Immutability", () => {
    it("persists order item with immutable title, variant, sku snapshots and line total", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-item-snap");
      const { productId, variantId } = await seedTestProductAndVariant(db, storeId);
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, 'ORD-SNAP', 'CONFIRMED', 'USD', 5000, 5000)`,
        [orderId, storeId],
      );

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO order_items (
           id, order_id, store_id, product_id, variant_id,
           product_name_snapshot, variant_name_snapshot, sku_snapshot,
           quantity, unit_price, discount_amount, tax_amount, line_total
         ) VALUES (
           $1, $2, $3, $4, $5,
           'Classic T-Shirt', 'Medium Black', 'TSHIRT-BLK-M',
           2, 2500, 0, 0, 5000
         )`,
        [itemId, orderId, storeId, productId, variantId],
      );

      const res = await db.query<{
        id: string;
        product_name_snapshot: string;
        variant_name_snapshot: string;
        sku_snapshot: string;
        quantity: number;
        line_total: string;
      }>(`SELECT * FROM order_items WHERE id = $1`, [itemId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0];
      expect(row?.product_name_snapshot).toBe("Classic T-Shirt");
      expect(row?.variant_name_snapshot).toBe("Medium Black");
      expect(row?.sku_snapshot).toBe("TSHIRT-BLK-M");
      expect(row?.quantity).toBe(2);
      expect(Number(row?.line_total)).toBe(5000);
    });

    it("rejects non-positive order item quantity", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-item-qty");
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, 'ORD-QTY', 'CONFIRMED', 'USD', 1000, 1000)`,
        [orderId, storeId],
      );

      await expect(
        db.query(
          `INSERT INTO order_items (
             id, order_id, store_id, product_name_snapshot, variant_name_snapshot,
             quantity, unit_price, line_total
           ) VALUES ($1, $2, $3, 'Title', 'Variant', 0, 1000, 0)`,
          [generateUuidV7(), orderId, storeId],
        ),
      ).rejects.toThrow(/order_items_quantity_check/);
    });

    it("cascades delete from order to order items", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-cascade-items");
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, 'ORD-DEL-ITEM', 'CONFIRMED', 'USD', 2500, 2500)`,
        [orderId, storeId],
      );

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO order_items (
           id, order_id, store_id, product_name_snapshot, variant_name_snapshot,
           quantity, unit_price, line_total
         ) VALUES ($1, $2, $3, 'Title', 'Variant', 1, 2500, 2500)`,
        [itemId, orderId, storeId],
      );

      // Delete parent order
      await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

      // Verify item was cascaded
      const items = await db.query(`SELECT * FROM order_items WHERE id = $1`, [itemId]);
      expect(items.rows).toHaveLength(0);
    });
  });

  describe("4. Order Addresses & Status History", () => {
    it("persists billing and shipping address snapshots and enforces uniqueness per order and type", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-addr");
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, 'ORD-ADDR-1', 'CONFIRMED', 'USD', 5000, 5000)`,
        [orderId, storeId],
      );

      // Shipping address
      await db.query(
        `INSERT INTO order_addresses (
           id, order_id, store_id, type, name,
           address_line_1, city, state, postal_code, country
         ) VALUES ($1, $2, $3, 'SHIPPING', 'John Doe', '123 Main St', 'New York', 'NY', '10001', 'US')`,
        [generateUuidV7(), orderId, storeId],
      );

      // Billing address
      await db.query(
        `INSERT INTO order_addresses (
           id, order_id, store_id, type, name,
           address_line_1, city, state, postal_code, country
         ) VALUES ($1, $2, $3, 'BILLING', 'John Doe', '123 Main St', 'New York', 'NY', '10001', 'US')`,
        [generateUuidV7(), orderId, storeId],
      );

      // Duplicate shipping address on same order violates unique(order_id, type)
      await expect(
        db.query(
          `INSERT INTO order_addresses (
             id, order_id, store_id, type, name,
             address_line_1, city, postal_code, country
           ) VALUES ($1, $2, $3, 'SHIPPING', 'Another Name', '456 Elm St', 'Boston', '02101', 'US')`,
          [generateUuidV7(), orderId, storeId],
        ),
      ).rejects.toThrow(/order_addresses_order_type_unique/);
    });

    it("persists status history transitions with valid actor types", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ord-history");
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, 'ORD-HIST-1', 'PENDING', 'USD', 5000, 5000)`,
        [orderId, storeId],
      );

      // Record initial transition
      await db.query(
        `INSERT INTO order_status_history (
           id, order_id, store_id, from_status, to_status, reason, actor_type
         ) VALUES ($1, $2, $3, NULL, 'PENDING', 'Order created from checkout', 'SYSTEM')`,
        [generateUuidV7(), orderId, storeId],
      );

      // Record confirmation by merchant
      await db.query(
        `INSERT INTO order_status_history (
           id, order_id, store_id, from_status, to_status, reason, actor_type
         ) VALUES ($1, $2, $3, 'PENDING', 'CONFIRMED', 'Merchant confirmed order', 'MERCHANT')`,
        [generateUuidV7(), orderId, storeId],
      );

      const history = await db.query<{ to_status: string; actor_type: string }>(
        `SELECT to_status, actor_type FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`,
        [orderId],
      );
      expect(history.rows).toHaveLength(2);
      expect(history.rows[0]?.to_status).toBe("PENDING");
      expect(history.rows[1]?.to_status).toBe("CONFIRMED");

      // Invalid actor type rejected
      await expect(
        db.query(
          `INSERT INTO order_status_history (id, order_id, store_id, to_status, actor_type)
           VALUES ($1, $2, $3, 'SHIPPED', 'INVALID_ACTOR')`,
          [generateUuidV7(), orderId, storeId],
        ),
      ).rejects.toThrow(/order_status_history_actor_type_check/);
    });
  });

  describe("5. Foreign-Key Relationships & Tenant Integrity", () => {
    it("enforces tenant integrity: rejects order referencing customer from different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "ord-tenant-a");
      const { storeId: storeB } = await seedTestStore(db, "ord-tenant-b");

      const customerA = await seedTestCustomer(db, storeA);

      // Attempt to link Customer in Store A to Order in Store B
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, customer_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, $3, 'ORD-CROSS', 'PENDING', 'USD', 1000, 1000)`,
          [generateUuidV7(), storeB, customerA],
        ),
      ).rejects.toThrow(/orders_store_customer_fkey/);
    });

    it("enforces tenant integrity: rejects order referencing checkout from different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "chk-tenant-a");
      const { storeId: storeB } = await seedTestStore(db, "chk-tenant-b");

      const cartA = await seedTestCart(db, storeA);
      const checkoutA = await seedTestCheckout(db, storeA, cartA);

      // Attempt to link Checkout in Store A to Order in Store B
      await expect(
        db.query(
          `INSERT INTO orders (id, store_id, checkout_id, order_number, status, currency, total, grand_total)
           VALUES ($1, $2, $3, 'ORD-CROSS-CHK', 'PENDING', 'USD', 1000, 1000)`,
          [generateUuidV7(), storeB, checkoutA],
        ),
      ).rejects.toThrow(/orders_store_checkout_fkey/);
    });

    it("enforces foreign-key relationship between payments.order_id and orders", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-ord-fk");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000);
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, checkout_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, $3, 'ORD-PMT-1', 'CONFIRMED', 'USD', 5000, 5000)`,
        [orderId, storeId, checkoutId],
      );

      // Payment correctly references order
      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, order_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, $4, 5000, 'USD', 'CAPTURED', 5000)`,
        [paymentId, storeId, checkoutId, orderId],
      );

      const pmt = await db.query<{ order_id: string }>(`SELECT order_id FROM payments WHERE id = $1`, [paymentId]);
      expect(pmt.rows[0]?.order_id).toBe(orderId);

      // Attempting to set payments.order_id to non-existent order fails
      const checkoutId2 = await seedTestCheckout(db, storeId, cartId, 5000);
      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, order_id, amount, currency, status)
           VALUES ($1, $2, $3, $4, 5000, 'USD', 'CREATED')`,
          [generateUuidV7(), storeId, checkoutId2, generateUuidV7()],
        ),
      ).rejects.toThrow(/payments_order_store_fkey/);
    });

    it("sets payments.order_id to NULL upon order deletion (ON DELETE SET NULL)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-ord-del");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 3000);
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, checkout_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, $3, 'ORD-DEL-PMT', 'CONFIRMED', 'USD', 3000, 3000)`,
        [orderId, storeId, checkoutId],
      );

      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, order_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, $4, 3000, 'USD', 'CAPTURED', 3000)`,
        [paymentId, storeId, checkoutId, orderId],
      );

      // Delete order
      await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

      // Payment still exists, order_id set to null
      const pmt = await db.query<{ order_id: string | null }>(`SELECT order_id FROM payments WHERE id = $1`, [paymentId]);
      expect(pmt.rows[0]?.order_id).toBeNull();
    });

    it("enforces foreign-key relationship between refunds.order_id and orders", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-ord-fk");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 4000);
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, checkout_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, $3, 'ORD-REF-1', 'CONFIRMED', 'USD', 4000, 4000)`,
        [orderId, storeId, checkoutId],
      );

      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, order_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, $4, 4000, 'USD', 'CAPTURED', 4000)`,
        [paymentId, storeId, checkoutId, orderId],
      );

      // Valid refund referencing existing order succeeds
      const refundId = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency, status)
         VALUES ($1, $2, $3, $4, 2000, 'USD', 'PENDING')`,
        [refundId, storeId, paymentId, orderId],
      );

      const ref = await db.query<{ order_id: string }>(`SELECT order_id FROM refunds WHERE id = $1`, [refundId]);
      expect(ref.rows[0]?.order_id).toBe(orderId);

      // Refund referencing non-existent order fails
      await expect(
        db.query(
          `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency)
           VALUES ($1, $2, $3, $4, 1000, 'USD')`,
          [generateUuidV7(), storeId, paymentId, generateUuidV7()],
        ),
      ).rejects.toThrow(/refunds_order_store_fkey/);
    });

    it("restricts order deletion when active refunds reference it (ON DELETE RESTRICT)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-ord-restr");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000);
      const orderId = generateUuidV7();

      await db.query(
        `INSERT INTO orders (id, store_id, checkout_id, order_number, status, currency, total, grand_total)
         VALUES ($1, $2, $3, 'ORD-RESTR', 'CONFIRMED', 'USD', 5000, 5000)`,
        [orderId, storeId, checkoutId],
      );

      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, order_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, $4, 5000, 'USD', 'CAPTURED', 5000)`,
        [paymentId, storeId, checkoutId, orderId],
      );

      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency)
         VALUES ($1, $2, $3, $4, 1500, 'USD')`,
        [generateUuidV7(), storeId, paymentId, orderId],
      );

      // Attempting to delete order while refunds exist is RESTRICTED
      await expect(
        db.query(`DELETE FROM orders WHERE id = $1`, [orderId]),
      ).rejects.toThrow(/refunds_order_store_fkey/);
    });
  });

  describe("6. OrderRepository Integration", () => {
    it("exercises OrderRepository create, findById, findByIdForUpdate, findByOrderNumber, findByCheckoutId, updateStatus", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "repo-ord");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 6000);
      const repo = new OrderRepository();
      const orderId = generateUuidV7();

      // Create order
      const created = await repo.create(db, {
        id: orderId,
        storeId,
        checkoutId,
        orderNumber: "ORD-REPO-1",
        currency: "USD",
        subtotal: 5000,
        shippingTotal: 1000,
        total: 6000,
        status: "PENDING",
      });
      expect(created.id).toBe(orderId);
      expect(created.status).toBe("PENDING");
      expect(Number(created.total)).toBe(6000);

      // findById
      const found = await repo.findById(db, storeId, orderId);
      expect(found?.order_number).toBe("ORD-REPO-1");

      // findByOrderNumber
      const byNumber = await repo.findByOrderNumber(db, storeId, "ORD-REPO-1");
      expect(byNumber?.id).toBe(orderId);

      // findByCheckoutId
      const byCheckout = await repo.findByCheckoutId(db, storeId, checkoutId);
      expect(byCheckout?.id).toBe(orderId);

      // Row-lock within transaction
      await db.withTransaction(async (tx) => {
        const locked = await repo.findByIdForUpdate(tx, storeId, orderId);
        expect(locked?.id).toBe(orderId);

        const updated = await repo.updateStatus(tx, storeId, orderId, "CONFIRMED", {
          paymentStatus: "PAID",
        });
        expect(updated.status).toBe("CONFIRMED");
        expect(updated.payment_status).toBe("PAID");
      });
    });

    it("exercises OrderRepository items, addresses, and status history operations", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "repo-sub-entities");
      const repo = new OrderRepository();
      const orderId = generateUuidV7();

      await repo.create(db, {
        id: orderId,
        storeId,
        orderNumber: "ORD-SUB-1",
        currency: "USD",
        total: 3000,
      });

      // Create item
      const item = await repo.createItem(db, {
        id: generateUuidV7(),
        orderId,
        storeId,
        productNameSnapshot: "T-Shirt",
        variantNameSnapshot: "Blue / L",
        skuSnapshot: "TSHIRT-BLU-L",
        quantity: 1,
        unitPrice: 3000,
        lineTotal: 3000,
      });
      expect(item.order_id).toBe(orderId);

      const items = await repo.findItemsByOrderId(db, storeId, orderId);
      expect(items).toHaveLength(1);
      expect(items[0]?.product_name_snapshot).toBe("T-Shirt");

      // Create address
      const addr = await repo.createAddress(db, {
        id: generateUuidV7(),
        orderId,
        storeId,
        type: "SHIPPING",
        name: "Jane Smith",
        addressLine1: "456 Oak Rd",
        city: "Seattle",
        postalCode: "98101",
        country: "US",
      });
      expect(addr.type).toBe("SHIPPING");

      const addrs = await repo.findAddressesByOrderId(db, storeId, orderId);
      expect(addrs).toHaveLength(1);

      // Create status history
      const hist = await repo.createStatusHistory(db, {
        id: generateUuidV7(),
        orderId,
        storeId,
        fromStatus: "PENDING",
        toStatus: "CONFIRMED",
        reason: "Automatic verification",
        actorType: "SYSTEM",
      });
      expect(hist.to_status).toBe("CONFIRMED");

      const history = await repo.findStatusHistoryByOrderId(db, storeId, orderId);
      expect(history).toHaveLength(1);
      expect(history[0]?.actor_type).toBe("SYSTEM");
    });
  });
});
