import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { StoreService } from "@calcart/stores";
import {
  DuplicateSkuError,
  ProductService,
} from "@calcart/products";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Product Update Transaction & Variant Lifecycle Regression Tests", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const productService = new ProductService();

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

  async function createTestStore(db: Database) {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, `merchant-${userId}@example.com`],
    );

    const store = await storeService.createStore(db, userId, {
      name: "Acme Apparel",
      slug: `store-${userId.slice(0, 8)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    return { store, userId };
  }

  it("archives variants with references (e.g. inventory) when omitted from product update, avoiding aborted transaction", async () => {
    const db = await setupDb();
    const { store } = await createTestStore(db);

    // 1. Create a product with two variants: Variant A (Small) and Variant B (Large) with stock
    const product = await productService.createProduct(db, store.id, {
      title: "Classic Cotton Hoodie",
      slug: "classic-cotton-hoodie",
      price: 4999,
      variants: [
        {
          title: "Small",
          sku: "HOODIE-S",
          price: 4999,
          inventoryQuantity: 10,
        },
        {
          title: "Large",
          sku: "HOODIE-L",
          price: 5499,
          inventoryQuantity: 5,
        },
      ],
    });

    expect(product.variants).toHaveLength(2);
    const varA = product.variants.find((v) => v.sku === "HOODIE-S")!;
    const varB = product.variants.find((v) => v.sku === "HOODIE-L")!;
    expect(varA).toBeDefined();
    expect(varB).toBeDefined();

    // Verify inventory_items exist for both variants
    const invBefore = await db.query(
      `SELECT variant_id, available_quantity FROM inventory_items WHERE store_id = $1 ORDER BY available_quantity ASC`,
      [store.id],
    );
    expect(invBefore.rows).toHaveLength(2);

    // 2. Update the product, omitting Variant B (Large)
    const updated = await productService.updateProduct(db, store.id, product.id, {
      title: "Classic Cotton Hoodie - Updated",
      variants: [
        {
          id: varA.id,
          title: "Small",
          sku: "HOODIE-S",
          price: 5299,
          inventoryQuantity: 12,
        },
      ],
    });

    // 3. Verify product updated successfully
    expect(updated.title).toBe("Classic Cotton Hoodie - Updated");

    // 4. Verify in DB: varA is ACTIVE with updated price, varB is ARCHIVED
    const varARow = await db.query<{ status: string; price: number }>(
      `SELECT status, price FROM product_variants WHERE id = $1 AND store_id = $2`,
      [varA.id, store.id],
    );
    expect(varARow.rows[0]?.status).toBe("ACTIVE");
    expect(Number(varARow.rows[0]?.price)).toBe(5299);

    const varBRow = await db.query<{ status: string; published_as_product: boolean }>(
      `SELECT status, published_as_product FROM product_variants WHERE id = $1 AND store_id = $2`,
      [varB.id, store.id],
    );
    expect(varBRow.rows[0]?.status).toBe("ARCHIVED");
    expect(varBRow.rows[0]?.published_as_product).toBe(false);

    // 5. Verify inventory_items for varB still exists (not deleted or corrupted)
    const invVarB = await db.query(
      `SELECT available_quantity FROM inventory_items WHERE variant_id = $1 AND store_id = $2`,
      [varB.id, store.id],
    );
    expect(invVarB.rows).toHaveLength(1);
    expect(Number(invVarB.rows[0]?.available_quantity)).toBe(5);
  });

  it("cleanly hard-deletes unreferenced variants when omitted from product update", async () => {
    const db = await setupDb();
    const { store } = await createTestStore(db);

    // 1. Create a product with default variant (no inventory)
    const product = await productService.createProduct(db, store.id, {
      title: "Minimal Mug",
      slug: "minimal-mug",
      price: 1500,
    });
    expect(product.variants).toHaveLength(1);
    const defaultVar = product.variants[0]!;

    // 2. Add a second variant without inventory
    const addedVar = await productService.createVariant(db, store.id, product.id, {
      title: "Ceramic White",
      sku: "MUG-WHITE",
      price: 1800,
    });

    // Verify neither variant has references in inventory
    const invCheck = await db.query(
      `SELECT variant_id FROM inventory_items WHERE store_id = $1`,
      [store.id],
    );
    expect(invCheck.rows).toHaveLength(0);

    // 3. Update product with only defaultVar, omitting addedVar
    const updated = await productService.updateProduct(db, store.id, product.id, {
      variants: [
        {
          id: defaultVar.id,
          title: "Default Title",
          price: 1600,
        },
      ],
    });

    expect(updated.variants).toHaveLength(1);
    expect(updated.variants[0]!.id).toBe(defaultVar.id);

    // Verify addedVar was hard-deleted from product_variants
    const deletedCheck = await db.query(
      `SELECT id FROM product_variants WHERE id = $1`,
      [addedVar.id],
    );
    expect(deletedCheck.rows).toHaveLength(0);
  });

  it("rejects duplicate SKUs and preserves transaction atomicity (no partial updates)", async () => {
    const db = await setupDb();
    const { store } = await createTestStore(db);

    const product = await productService.createProduct(db, store.id, {
      title: "Runner Sneakers",
      slug: "runner-sneakers",
      price: 8999,
      variants: [
        { title: "Size 9", sku: "SNEAKER-09", price: 8999 },
        { title: "Size 10", sku: "SNEAKER-10", price: 8999 },
      ],
    });

    const [v9, v10] = product.variants;

    // Attempt to update Size 10 with Size 9's SKU
    await expect(
      productService.updateProduct(db, store.id, product.id, {
        title: "Runner Sneakers Modified Title",
        variants: [
          { id: v9!.id, title: "Size 9", sku: "SNEAKER-09", price: 8999 },
          { id: v10!.id, title: "Size 10", sku: "SNEAKER-09", price: 8999 },
        ],
      }),
    ).rejects.toThrow(DuplicateSkuError);

    // Verify atomicity: title was not updated in the database
    const checkProduct = await productService.getProductById(db, store.id, product.id);
    expect(checkProduct.title).toBe("Runner Sneakers");
    expect(checkProduct.variants.find((v) => v.id === v10!.id)?.sku).toBe("SNEAKER-10");
  });

  it("prevents subsequent queries on aborted transactions and propagates original database error", async () => {
    const db = await setupDb();
    const { store } = await createTestStore(db);

    let originalError: unknown;
    let thrownError: unknown;

    try {
      await db.withTransaction(async (tx) => {
        try {
          // Trigger a PostgreSQL CHECK constraint violation: price must be >= 0
          await tx.query(
            `INSERT INTO product_variants (id, product_id, store_id, title, price, currency)
             VALUES ($1, $2, $3, 'Invalid Variant', -500, 'USD')`,
            [generateUuidV7(), generateUuidV7(), store.id],
          );
        } catch (err) {
          originalError = err;
          // Attempt another query on the aborted transaction
          await tx.query(`SELECT 1`);
        }
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    // The error thrown must be the original check constraint failure, NOT "current transaction is aborted"
    expect(thrownError).toBe(originalError);
    expect((thrownError as Error).message).toContain("violates check constraint");
    expect((thrownError as Error).message).not.toContain("current transaction is aborted");
  });
});
