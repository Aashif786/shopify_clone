import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Inventory PostgreSQL Schema Integration", { timeout: 30_000 }, () => {
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

  async function seedTestProductAndVariant(
    db: Database,
    storeId: string,
    sku = "SKU-001",
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Test Product', $3, 'ACTIVE')`,
      [productId, storeId, `product-${productId.slice(0, 8)}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, status)
       VALUES ($1, $2, $3, 'Default Variant', $4, 1000, 'ACTIVE')`,
      [variantId, productId, storeId, sku],
    );
    return { productId, variantId };
  }

  describe("Inventory Items Schema & Constraints", () => {
    it("successfully creates inventory items with default zero quantities", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-a");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-A1");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 100, 10)`,
        [itemId, storeId, variantId],
      );

      const res = await db.query<{
        id: string;
        store_id: string;
        variant_id: string;
        available_quantity: number;
        reserved_quantity: number;
      }>(`SELECT * FROM inventory_items WHERE id = $1`, [itemId]);

      expect(res.rowCount).toBe(1);
      expect(res.rows[0].available_quantity).toBe(100);
      expect(res.rows[0].reserved_quantity).toBe(10);
    });

    it("enforces tenant boundary: rejects inventory item when store_id does not match variant store_id", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-tenant-a");
      const { storeId: storeB } = await seedTestStore(db, "store-tenant-b");

      // Variant belongs to store A
      const { variantId } = await seedTestProductAndVariant(db, storeA, "SKU-TA");

      // Attempt to insert inventory for variant belonging to store A with store B
      const itemId = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
           VALUES ($1, $2, $3, 10, 0)`,
          [itemId, storeB, variantId],
        ),
      ).rejects.toThrow(/inventory_items_variant_store_fkey|violates foreign key constraint/i);
    });

    it("enforces uniqueness: only one inventory item allowed per product variant", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-uniq");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-UQ");

      const item1 = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 20, 0)`,
        [item1, storeId, variantId],
      );

      const item2 = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
           VALUES ($1, $2, $3, 30, 0)`,
          [item2, storeId, variantId],
        ),
      ).rejects.toThrow(/inventory_items_variant_id_unique|unique constraint/i);
    });

    it("enforces check constraint: available_quantity cannot be negative", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-neg-avail");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-NA");

      const itemId = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
           VALUES ($1, $2, $3, -1, 0)`,
          [itemId, storeId, variantId],
        ),
      ).rejects.toThrow(/inventory_items_available_qty_check|check constraint/i);
    });

    it("enforces check constraint: reserved_quantity cannot be negative", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-neg-res");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-NR");

      const itemId = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
           VALUES ($1, $2, $3, 10, -5)`,
          [itemId, storeId, variantId],
        ),
      ).rejects.toThrow(/inventory_items_reserved_qty_check|check constraint/i);
    });
  });

  describe("Inventory Reservations Schema & Constraints", () => {
    it("successfully creates reservations with valid fields", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-res-ok");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-ROK");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const reservationId = generateUuidV7();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.query(
        `INSERT INTO inventory_reservations (
           id, store_id, inventory_item_id, reference_type, reference_id, quantity, status, expires_at
         ) VALUES ($1, $2, $3, 'CHECKOUT', 'chk_123', 2, 'ACTIVE', $4)`,
        [reservationId, storeId, itemId, expiresAt],
      );

      const res = await db.query<{ id: string; status: string; quantity: number }>(
        `SELECT id, status, quantity FROM inventory_reservations WHERE id = $1`,
        [reservationId],
      );
      expect(res.rowCount).toBe(1);
      expect(res.rows[0].status).toBe("ACTIVE");
      expect(res.rows[0].quantity).toBe(2);
    });

    it("enforces check constraint: reservation quantity must be strictly greater than zero", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-res-qty");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-RQ");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const reservationId = generateUuidV7();
      const expiresAt = new Date(Date.now() + 1000);
      await expect(
        db.query(
          `INSERT INTO inventory_reservations (
             id, store_id, inventory_item_id, reference_type, reference_id, quantity, status, expires_at
           ) VALUES ($1, $2, $3, 'CHECKOUT', 'chk_zero', 0, 'ACTIVE', $4)`,
          [reservationId, storeId, itemId, expiresAt],
        ),
      ).rejects.toThrow(/inventory_reservations_quantity_check|check constraint/i);
    });

    it("enforces check constraint: status must be ACTIVE, RELEASED, or COMMITTED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-res-stat");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-RS");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const reservationId = generateUuidV7();
      const expiresAt = new Date(Date.now() + 1000);
      await expect(
        db.query(
          `INSERT INTO inventory_reservations (
             id, store_id, inventory_item_id, reference_type, reference_id, quantity, status, expires_at
           ) VALUES ($1, $2, $3, 'CHECKOUT', 'chk_bad', 2, 'CANCELLED', $4)`,
          [reservationId, storeId, itemId, expiresAt],
        ),
      ).rejects.toThrow(/inventory_reservations_status_check|check constraint/i);
    });

    it("enforces tenant boundary: cross-store reservation is rejected", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-res-ta");
      const { storeId: storeB } = await seedTestStore(db, "store-res-tb");
      const { variantId } = await seedTestProductAndVariant(db, storeA, "SKU-RTA");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeA, variantId],
      );

      const reservationId = generateUuidV7();
      const expiresAt = new Date(Date.now() + 1000);
      await expect(
        db.query(
          `INSERT INTO inventory_reservations (
             id, store_id, inventory_item_id, reference_type, reference_id, quantity, status, expires_at
           ) VALUES ($1, $2, $3, 'CHECKOUT', 'chk_cross', 1, 'ACTIVE', $4)`,
          [reservationId, storeB, itemId, expiresAt],
        ),
      ).rejects.toThrow(/inventory_reservations_store_item_fkey|foreign key/i);
    });

    it("enforces uniqueness: duplicate reservation reference for the same item is rejected", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-res-dup");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-RD");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const r1 = generateUuidV7();
      const expiresAt = new Date(Date.now() + 1000);
      await db.query(
        `INSERT INTO inventory_reservations (
           id, store_id, inventory_item_id, reference_type, reference_id, quantity, status, expires_at
         ) VALUES ($1, $2, $3, 'CHECKOUT', 'chk_same_ref', 1, 'ACTIVE', $4)`,
        [r1, storeId, itemId, expiresAt],
      );

      const r2 = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO inventory_reservations (
             id, store_id, inventory_item_id, reference_type, reference_id, quantity, status, expires_at
           ) VALUES ($1, $2, $3, 'CHECKOUT', 'chk_same_ref', 1, 'ACTIVE', $4)`,
          [r2, storeId, itemId, expiresAt],
        ),
      ).rejects.toThrow(/inventory_reservations_item_ref_unique|unique constraint/i);
    });
  });

  describe("Inventory Adjustments Schema & Constraints", () => {
    it("successfully records audit adjustment records", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-adj-ok");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-AOK");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 50, 0)`,
        [itemId, storeId, variantId],
      );

      const adjId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_adjustments (
           id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity, reason
         ) VALUES ($1, $2, $3, 50, 0, 50, 'INITIAL_STOCK')`,
        [adjId, storeId, itemId],
      );

      const res = await db.query<{ id: string; reason: string; quantity_delta: number }>(
        `SELECT id, reason, quantity_delta FROM inventory_adjustments WHERE id = $1`,
        [adjId],
      );
      expect(res.rowCount).toBe(1);
      expect(res.rows[0].reason).toBe("INITIAL_STOCK");
      expect(res.rows[0].quantity_delta).toBe(50);
    });

    it("enforces check constraint: delta cannot be zero", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-adj-zero");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-AZ");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const adjId = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO inventory_adjustments (
             id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity, reason
           ) VALUES ($1, $2, $3, 0, 10, 10, 'RESTOCK')`,
          [adjId, storeId, itemId],
        ),
      ).rejects.toThrow(/inventory_adjustments_delta_check|check constraint/i);
    });

    it("enforces mathematical check: new_quantity must equal previous_quantity + delta", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-adj-math");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-AM");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const adjId = generateUuidV7();
      // previous=10, delta=5, but new=20 (invalid math)
      await expect(
        db.query(
          `INSERT INTO inventory_adjustments (
             id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity, reason
           ) VALUES ($1, $2, $3, 5, 10, 20, 'RESTOCK')`,
          [adjId, storeId, itemId],
        ),
      ).rejects.toThrow(/inventory_adjustments_math_check|check constraint/i);
    });

    it("enforces check constraint: invalid reason is rejected", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-adj-reas");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-AR");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const adjId = generateUuidV7();
      await expect(
        db.query(
          `INSERT INTO inventory_adjustments (
             id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity, reason
           ) VALUES ($1, $2, $3, 5, 10, 15, 'UNAUTHORIZED_REASON')`,
          [adjId, storeId, itemId],
        ),
      ).rejects.toThrow(/inventory_adjustments_reason_check|check constraint/i);
    });
  });

  describe("Deletion Behavior (ON DELETE RESTRICT)", () => {
    it("prevents deletion of store when inventory records exist", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-del-res");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-DR");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      await expect(
        db.query(`DELETE FROM stores WHERE id = $1`, [storeId]),
      ).rejects.toThrow(/violates foreign key constraint/i);
    });

    it("prevents deletion of product variant when inventory records exist", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-del-var");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-DV");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      await expect(
        db.query(`DELETE FROM product_variants WHERE id = $1`, [variantId]),
      ).rejects.toThrow(/violates foreign key constraint/i);
    });

    it("prevents deletion of inventory item when adjustment history exists", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-del-hist");
      const { variantId } = await seedTestProductAndVariant(db, storeId, "SKU-DH");

      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, 10, 0)`,
        [itemId, storeId, variantId],
      );

      const adjId = generateUuidV7();
      await db.query(
        `INSERT INTO inventory_adjustments (
           id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity, reason
         ) VALUES ($1, $2, $3, 10, 0, 10, 'INITIAL_STOCK')`,
        [adjId, storeId, itemId],
      );

      await expect(
        db.query(`DELETE FROM inventory_items WHERE id = $1`, [itemId]),
      ).rejects.toThrow(/violates foreign key constraint/i);
    });
  });
});
