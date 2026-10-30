import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Checkout PostgreSQL Schema Integration", { timeout: 30_000 }, () => {
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
    slug = "store-1",
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
    email = "customer@test.com",
  ): Promise<string> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [customerId, storeId, email],
    );
    return customerId;
  }

  async function seedTestCart(
    db: Database,
    storeId: string,
    customerId?: string,
  ): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, customer_id, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [cartId, storeId, customerId ?? null],
    );
    return cartId;
  }

  async function seedTestProductAndVariant(
    db: Database,
    storeId: string,
    sku = "SKU-001",
    price = 2500,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Test Product', $3, 'ACTIVE')`,
      [productId, storeId, `product-${productId}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, status)
       VALUES ($1, $2, $3, 'Default Variant', $4, $5, 'ACTIVE')`,
      [variantId, productId, storeId, sku, price],
    );
    return { productId, variantId };
  }

  describe("Checkouts Table Schema & Invariants", () => {
    it("creates a valid checkout with default values", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-insert");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = generateUuidV7();

      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id) VALUES ($1, $2, $3)`,
        [checkoutId, storeId, cartId],
      );

      const res = await db.query<{
        id: string;
        store_id: string;
        cart_id: string;
        status: string;
        currency: string;
        subtotal: string;
        total: string;
        payment_status: string;
      }>(`SELECT * FROM checkouts WHERE id = $1`, [checkoutId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0]!;
      expect(row.id).toBe(checkoutId);
      expect(row.store_id).toBe(storeId);
      expect(row.cart_id).toBe(cartId);
      expect(row.status).toBe("OPEN");
      expect(row.currency).toBe("USD");
      expect(Number(row.subtotal)).toBe(0);
      expect(Number(row.total)).toBe(0);
      expect(row.payment_status).toBe("PENDING");
    });

    it("persists structured addresses as JSONB", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-address");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = generateUuidV7();

      const address = {
        addressLine1: "123 Broadway",
        city: "New York",
        postalCode: "10001",
        country: "US",
      };

      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id, shipping_address, billing_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [checkoutId, storeId, cartId, JSON.stringify(address), JSON.stringify(address)],
      );

      const res = await db.query<{
        shipping_address: typeof address;
        billing_address: typeof address;
      }>(`SELECT shipping_address, billing_address FROM checkouts WHERE id = $1`, [checkoutId]);

      expect(res.rows[0]?.shipping_address).toEqual(address);
      expect(res.rows[0]?.billing_address).toEqual(address);
    });

    it("rejects invalid checkout status via check constraint", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-status-check");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = generateUuidV7();

      await expect(
        db.query(
          `INSERT INTO checkouts (id, store_id, cart_id, status) VALUES ($1, $2, $3, 'INVALID_STATUS')`,
          [checkoutId, storeId, cartId],
        ),
      ).rejects.toThrow(/checkouts_status_check/);
    });

    it("rejects invalid currency format via check constraint", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-currency-check");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = generateUuidV7();

      await expect(
        db.query(
          `INSERT INTO checkouts (id, store_id, cart_id, currency) VALUES ($1, $2, $3, 'usd')`,
          [checkoutId, storeId, cartId],
        ),
      ).rejects.toThrow(/checkouts_currency_format_check/);
    });

    it("rejects negative monetary amounts via check constraints", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-monetary-check");
      const cartId = await seedTestCart(db, storeId);

      await expect(
        db.query(
          `INSERT INTO checkouts (id, store_id, cart_id, subtotal) VALUES ($1, $2, $3, -100)`,
          [generateUuidV7(), storeId, cartId],
        ),
      ).rejects.toThrow(/checkouts_subtotal_check/);

      await expect(
        db.query(
          `INSERT INTO checkouts (id, store_id, cart_id, discount_total) VALUES ($1, $2, $3, -50)`,
          [generateUuidV7(), storeId, cartId],
        ),
      ).rejects.toThrow(/checkouts_discount_total_check/);

      await expect(
        db.query(
          `INSERT INTO checkouts (id, store_id, cart_id, total) VALUES ($1, $2, $3, -1)`,
          [generateUuidV7(), storeId, cartId],
        ),
      ).rejects.toThrow(/checkouts_total_check/);
    });
  });

  describe("Checkout Multi-Tenancy & Isolation Invariants", () => {
    it("rejects referencing a cart belonging to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a");
      const { storeId: storeB } = await seedTestStore(db, "store-b");

      const cartA = await seedTestCart(db, storeA);
      const checkoutId = generateUuidV7();

      // Attempting to attach Store A cart to Store B checkout
      await expect(
        db.query(
          `INSERT INTO checkouts (id, store_id, cart_id) VALUES ($1, $2, $3)`,
          [checkoutId, storeB, cartA],
        ),
      ).rejects.toThrow(/checkouts_store_cart_fkey/);
    });

    it("rejects referencing a customer belonging to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-cust");
      const { storeId: storeB } = await seedTestStore(db, "store-b-cust");

      const customerA = await seedTestCustomer(db, storeA, "cust-a@test.com");
      const cartB = await seedTestCart(db, storeB);
      const checkoutId = generateUuidV7();

      // Attempting to attach Store A customer to Store B checkout
      await expect(
        db.query(
          `INSERT INTO checkouts (id, store_id, cart_id, customer_id) VALUES ($1, $2, $3, $4)`,
          [checkoutId, storeB, cartB, customerA],
        ),
      ).rejects.toThrow(/checkouts_store_customer_fkey/);
    });
  });

  describe("Checkout Items Schema & Snapshot Invariants", () => {
    it("persists checkout items with frozen historical snapshot values", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-item-snapshot");
      const cartId = await seedTestCart(db, storeId);
      const { variantId } = await seedTestProductAndVariant(db, storeId, "TSHIRT-001", 3500);

      const checkoutId = generateUuidV7();
      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id) VALUES ($1, $2, $3)`,
        [checkoutId, storeId, cartId],
      );

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO checkout_items (
           id, checkout_id, store_id, variant_id,
           product_name_snapshot, variant_name_snapshot, sku_snapshot,
           unit_price, quantity, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          itemId,
          checkoutId,
          storeId,
          variantId,
          "Classic T-Shirt",
          "Black / M",
          "TSHIRT-001",
          3500,
          2,
          7000,
        ],
      );

      const res = await db.query<{
        product_name_snapshot: string;
        variant_name_snapshot: string;
        sku_snapshot: string;
        unit_price: string;
        quantity: number;
        line_total: string;
      }>(`SELECT * FROM checkout_items WHERE id = $1`, [itemId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0]!;
      expect(row.product_name_snapshot).toBe("Classic T-Shirt");
      expect(row.variant_name_snapshot).toBe("Black / M");
      expect(row.sku_snapshot).toBe("TSHIRT-001");
      expect(Number(row.unit_price)).toBe(3500);
      expect(row.quantity).toBe(2);
      expect(Number(row.line_total)).toBe(7000);
    });

    it("rejects non-positive quantities in checkout_items", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-item-qty");
      const cartId = await seedTestCart(db, storeId);
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const checkoutId = generateUuidV7();

      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id) VALUES ($1, $2, $3)`,
        [checkoutId, storeId, cartId],
      );

      await expect(
        db.query(
          `INSERT INTO checkout_items (
             id, checkout_id, store_id, variant_id,
             product_name_snapshot, variant_name_snapshot, unit_price, quantity, line_total
           ) VALUES ($1, $2, $3, $4, 'P', 'V', 1000, 0, 0)`,
          [generateUuidV7(), checkoutId, storeId, variantId],
        ),
      ).rejects.toThrow(/checkout_items_quantity_check/);
    });

    it("rejects duplicate variant addition to the same checkout", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-item-dup");
      const cartId = await seedTestCart(db, storeId);
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const checkoutId = generateUuidV7();

      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id) VALUES ($1, $2, $3)`,
        [checkoutId, storeId, cartId],
      );

      await db.query(
        `INSERT INTO checkout_items (
           id, checkout_id, store_id, variant_id,
           product_name_snapshot, variant_name_snapshot, unit_price, quantity, line_total
         ) VALUES ($1, $2, $3, $4, 'P', 'V', 1000, 1, 1000)`,
        [generateUuidV7(), checkoutId, storeId, variantId],
      );

      await expect(
        db.query(
          `INSERT INTO checkout_items (
             id, checkout_id, store_id, variant_id,
             product_name_snapshot, variant_name_snapshot, unit_price, quantity, line_total
           ) VALUES ($1, $2, $3, $4, 'P', 'V', 1000, 2, 2000)`,
          [generateUuidV7(), checkoutId, storeId, variantId],
        ),
      ).rejects.toThrow(/checkout_items_checkout_variant_unique/);
    });

    it("rejects attaching a product variant belonging to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-var");
      const { storeId: storeB } = await seedTestStore(db, "store-b-var");

      const { variantId: variantA } = await seedTestProductAndVariant(db, storeA);
      const cartB = await seedTestCart(db, storeB);
      const checkoutId = generateUuidV7();

      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id) VALUES ($1, $2, $3)`,
        [checkoutId, storeB, cartB],
      );

      // Attempting to attach Store A variant to Store B checkout
      await expect(
        db.query(
          `INSERT INTO checkout_items (
             id, checkout_id, store_id, variant_id,
             product_name_snapshot, variant_name_snapshot, unit_price, quantity, line_total
           ) VALUES ($1, $2, $3, $4, 'P', 'V', 1000, 1, 1000)`,
          [generateUuidV7(), checkoutId, storeB, variantA],
        ),
      ).rejects.toThrow(/checkout_items_variant_store_fkey/);
    });

    it("cascades item deletion when parent checkout is deleted", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "checkout-cascade");
      const cartId = await seedTestCart(db, storeId);
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const checkoutId = generateUuidV7();
      const itemId = generateUuidV7();

      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id) VALUES ($1, $2, $3)`,
        [checkoutId, storeId, cartId],
      );

      await db.query(
        `INSERT INTO checkout_items (
           id, checkout_id, store_id, variant_id,
           product_name_snapshot, variant_name_snapshot, unit_price, quantity, line_total
         ) VALUES ($1, $2, $3, $4, 'P', 'V', 1000, 1, 1000)`,
        [itemId, checkoutId, storeId, variantId],
      );

      await db.query(`DELETE FROM checkouts WHERE id = $1`, [checkoutId]);

      const res = await db.query(`SELECT * FROM checkout_items WHERE id = $1`, [itemId]);
      expect(res.rows).toHaveLength(0);
    });
  });
});
