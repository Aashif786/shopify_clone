import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Carts PostgreSQL Schema Integration", { timeout: 30_000 }, () => {
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

  describe("Carts Table Schema & Invariants", () => {
    it("creates a valid cart with default values", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cart-insert");
      const cartId = generateUuidV7();

      await db.query(
        `INSERT INTO carts (id, store_id) VALUES ($1, $2)`,
        [cartId, storeId],
      );

      const res = await db.query<{
        id: string;
        store_id: string;
        customer_id: string | null;
        guest_identifier: string | null;
        status: string;
        currency: string;
        subtotal: string;
        grand_total: string;
      }>(`SELECT * FROM carts WHERE id = $1`, [cartId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0]!;
      expect(row.id).toBe(cartId);
      expect(row.store_id).toBe(storeId);
      expect(row.customer_id).toBeNull();
      expect(row.guest_identifier).toBeNull();
      expect(row.status).toBe("ACTIVE");
      expect(row.currency).toBe("USD");
      expect(Number(row.subtotal)).toBe(0);
      expect(Number(row.grand_total)).toBe(0);
    });

    it("associates cart with customer belonging to the same store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cart-cust");
      const customerId = await seedTestCustomer(db, storeId, "shopper@store.com");
      const cartId = generateUuidV7();

      await db.query(
        `INSERT INTO carts (id, store_id, customer_id) VALUES ($1, $2, $3)`,
        [cartId, storeId, customerId],
      );

      const res = await db.query<{ customer_id: string }>(
        `SELECT customer_id FROM carts WHERE id = $1`,
        [cartId],
      );
      expect(res.rows[0]!.customer_id).toBe(customerId);
    });

    it("rejects cross-store customer association via composite foreign key", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a");
      const storeB = await seedTestStore(db, "store-b");

      // Customer belongs to Store A
      const customerId = await seedTestCustomer(db, storeA.storeId, "a@store.com");

      // Cart belongs to Store B, but points to Customer from Store A -> MUST FAIL
      const cartId = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, customer_id) VALUES ($1, $2, $3)`,
          [cartId, storeB.storeId, customerId],
        ),
      ).rejects.toThrow();
    });

    it("rejects invalid foreign key to non-existent store", async () => {
      const db = await setupDb();
      const nonExistentStoreId = generateUuidV7();
      const cartId = generateUuidV7();

      await expect(
        db.query(
          `INSERT INTO carts (id, store_id) VALUES ($1, $2)`,
          [cartId, nonExistentStoreId],
        ),
      ).rejects.toThrow();
    });

    it("enforces status check constraint (rejects invalid status values)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cart-status-check");

      // Invalid status values
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'DRAFT')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'DELETED')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Valid statuses must succeed
      for (const validStatus of ["ACTIVE", "CONVERTED", "ABANDONED", "EXPIRED"]) {
        await expect(
          db.query(
            `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, $3)`,
            [generateUuidV7(), storeId, validStatus],
          ),
        ).resolves.toBeDefined();
      }
    });

    it("enforces currency check constraint (rejects lowercase or invalid lengths)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cart-currency-check");

      // Lowercase rejected
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, currency) VALUES ($1, $2, 'usd')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Untrimmed rejected
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, currency) VALUES ($1, $2, ' USD')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Length != 3 rejected
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, currency) VALUES ($1, $2, 'US')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Valid 3-char uppercase succeeds
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, currency) VALUES ($1, $2, 'EUR')`,
          [generateUuidV7(), storeId],
        ),
      ).resolves.toBeDefined();
    });

    it("enforces non-negative monetary totals check constraints", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cart-totals-check");

      // Negative subtotal rejected
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, subtotal) VALUES ($1, $2, -100)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Negative grand_total rejected
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, grand_total) VALUES ($1, $2, -500)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Negative discount rejected
      await expect(
        db.query(
          `INSERT INTO carts (id, store_id, discount_total) VALUES ($1, $2, -1)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();
    });
  });

  describe("Cart Items Schema & Tenant Constraints", () => {
    it("creates cart item successfully with valid variant and store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "item-insert");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-1", 1500);

      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeId,
      ]);

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
         VALUES ($1, $2, $3, $4, 2, 1500, 3000)`,
        [itemId, cartId, storeId, variantId],
      );

      const res = await db.query<{
        id: string;
        cart_id: string;
        variant_id: string;
        quantity: number;
        unit_price: string;
        line_subtotal: string;
      }>(`SELECT * FROM cart_items WHERE id = $1`, [itemId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0]!;
      expect(row.id).toBe(itemId);
      expect(row.cart_id).toBe(cartId);
      expect(row.variant_id).toBe(variantId);
      expect(row.quantity).toBe(2);
      expect(Number(row.unit_price)).toBe(1500);
      expect(Number(row.line_subtotal)).toBe(3000);
    });

    it("strictly prevents cross-store variant insertion via composite foreign key", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-var");
      const storeB = await seedTestStore(db, "store-b-var");

      // Variant belongs to Store A
      const { variantId } = await seedTestProductAndVariant(db, storeA.storeId, "SKU-A");

      // Cart belongs to Store B
      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeB.storeId,
      ]);

      // Attempt inserting Store A's variant into Store B's cart -> MUST FAIL
      await expect(
        db.query(
          `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
           VALUES ($1, $2, $3, $4, 1, 1000, 1000)`,
          [generateUuidV7(), cartId, storeB.storeId, variantId],
        ),
      ).rejects.toThrow();
    });

    it("strictly prevents cart item store_id mismatch with cart store_id", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-mismatch");
      const storeB = await seedTestStore(db, "store-b-mismatch");

      const { variantId } = await seedTestProductAndVariant(db, storeA.storeId, "SKU-A");
      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeA.storeId,
      ]);

      // Attempt inserting item with cart_id from Store A but store_id of Store B -> MUST FAIL
      await expect(
        db.query(
          `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
           VALUES ($1, $2, $3, $4, 1, 1000, 1000)`,
          [generateUuidV7(), cartId, storeB.storeId, variantId],
        ),
      ).rejects.toThrow();
    });

    it("enforces uniqueness of (cart_id, variant_id) to prevent duplicate item rows", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "item-uniq");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-U");

      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeId,
      ]);

      // First item succeeds
      await db.query(
        `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
         VALUES ($1, $2, $3, $4, 1, 1000, 1000)`,
        [generateUuidV7(), cartId, storeId, variantId],
      );

      // Second item with same (cart_id, variant_id) MUST FAIL
      await expect(
        db.query(
          `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
           VALUES ($1, $2, $3, $4, 2, 1000, 2000)`,
          [generateUuidV7(), cartId, storeId, variantId],
        ),
      ).rejects.toThrow();
    });

    it("enforces quantity > 0 check constraint", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "item-qty-check");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-Q");

      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeId,
      ]);

      // quantity = 0 rejected
      await expect(
        db.query(
          `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
           VALUES ($1, $2, $3, $4, 0, 1000, 0)`,
          [generateUuidV7(), cartId, storeId, variantId],
        ),
      ).rejects.toThrow();

      // quantity < 0 rejected
      await expect(
        db.query(
          `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
           VALUES ($1, $2, $3, $4, -2, 1000, -2000)`,
          [generateUuidV7(), cartId, storeId, variantId],
        ),
      ).rejects.toThrow();
    });

    it("enforces non-negative unit_price and line_subtotal check constraints", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "item-price-check");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-P");

      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeId,
      ]);

      // Negative unit_price rejected
      await expect(
        db.query(
          `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
           VALUES ($1, $2, $3, $4, 1, -500, 0)`,
          [generateUuidV7(), cartId, storeId, variantId],
        ),
      ).rejects.toThrow();

      // Negative line_subtotal rejected
      await expect(
        db.query(
          `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
           VALUES ($1, $2, $3, $4, 1, 500, -500)`,
          [generateUuidV7(), cartId, storeId, variantId],
        ),
      ).rejects.toThrow();
    });
  });

  describe("Cascades & Referential Integrity", () => {
    it("cascade deletes cart items when parent cart is deleted", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cart-cascade");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-C");

      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeId,
      ]);

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
         VALUES ($1, $2, $3, $4, 1, 1000, 1000)`,
        [itemId, cartId, storeId, variantId],
      );

      // Delete cart
      await db.query(`DELETE FROM carts WHERE id = $1`, [cartId]);

      // Items must be cascade-deleted
      const res = await db.query(`SELECT id FROM cart_items WHERE id = $1`, [itemId]);
      expect(res.rows).toHaveLength(0);
    });

    it("sets customer_id to NULL when associated customer is deleted", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-nullify");
      const customerId = await seedTestCustomer(db, storeId, "delete-me@test.com");

      const cartId = generateUuidV7();
      await db.query(
        `INSERT INTO carts (id, store_id, customer_id) VALUES ($1, $2, $3)`,
        [cartId, storeId, customerId],
      );

      // Delete customer
      await db.query(`DELETE FROM customers WHERE id = $1`, [customerId]);

      // Cart customer_id must become NULL
      const res = await db.query<{ customer_id: string | null }>(
        `SELECT customer_id FROM carts WHERE id = $1`,
        [cartId],
      );
      expect(res.rows[0]!.customer_id).toBeNull();
    });

    it("restricts store deletion when carts exist", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-restrict");
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        generateUuidV7(),
        storeId,
      ]);

      // Attempting to delete store must fail due to ON DELETE RESTRICT
      await expect(
        db.query(`DELETE FROM stores WHERE id = $1`, [storeId]),
      ).rejects.toThrow();
    });

    it("restricts product variant deletion when referenced by cart items", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "var-restrict");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-R");

      const cartId = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id) VALUES ($1, $2)`, [
        cartId,
        storeId,
      ]);

      await db.query(
        `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
         VALUES ($1, $2, $3, $4, 1, 1000, 1000)`,
        [generateUuidV7(), cartId, storeId, variantId],
      );

      // Attempting to delete product_variant must fail due to ON DELETE RESTRICT
      await expect(
        db.query(`DELETE FROM product_variants WHERE id = $1`, [variantId]),
      ).rejects.toThrow();
    });
  });
});
