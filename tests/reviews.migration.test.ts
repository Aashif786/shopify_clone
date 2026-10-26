import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, type Database } from "@shopify-clone/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import fs from "node:fs/promises";
import path from "node:path";

describe("Product Reviews Migration 0023 Safety & Uniqueness", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb() {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    return isolated.database;
  }

  async function applyMigrationsUpTo(db: Database, maxMigrationNumber: number) {
    const migrationsDir = path.resolve(process.cwd(), "packages/db/migrations");
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const match = file.match(/^(\d+)_/);
      if (!match) continue;
      const num = parseInt(match[1]!, 10);
      if (num <= maxMigrationNumber) {
        const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
        await db.query(sql);
      }
    }
  }

  it("applies migration 0023 safely onto database with existing review data and allows multi-product reviews per order", async () => {
    const db = await setupDb();

    // 1. Run migrations up to 0022
    await applyMigrationsUpTo(db, 22);

    // 2. Seed organization, store, user, customer, order, and products
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const customerId = generateUuidV7();
    const orderId = generateUuidV7();
    const productAId = generateUuidV7();
    const productBId = generateUuidV7();

    await db.query(
      `INSERT INTO organizations (id, name, status)
       VALUES ($1, 'Test Org', 'ACTIVE')`,
      [orgId],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Test Store', 'mig-test-store', 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId],
    );
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'cust@test.com', 'Test', 'Customer')`,
      [customerId, storeId],
    );
    await db.query(
      `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, fulfillment_status, currency, total)
       VALUES ($1, $2, $3, 'ORD-MIG-1', 'CONFIRMED', 'PAID', 'FULFILLED', 'USD', 20000)`,
      [orderId, storeId, customerId],
    );
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Prod A', 'prod-a', 'ACTIVE'),
              ($3, $2, 'Prod B', 'prod-b', 'ACTIVE')`,
      [productAId, storeId, productBId],
    );

    // 3. Seed an existing review for Product A under Order 1
    const reviewAId = generateUuidV7();
    await db.query(
      `INSERT INTO product_reviews (
        id, store_id, product_id, customer_id, order_id, rating, title, content,
        status, is_verified_purchase, customer_name_snapshot, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 5, 'Great Prod A', 'Review before migration',
                'PUBLISHED', TRUE, 'Test Customer', NOW(), NOW())`,
      [reviewAId, storeId, productAId, customerId, orderId],
    );

    // 4. Apply migration 0023
    const migration0023Sql = await fs.readFile(
      path.resolve(process.cwd(), "packages/db/migrations/0023_fix_product_review_order_uniqueness.sql"),
      "utf8",
    );
    await db.query(migration0023Sql);

    // 5. Verify existing review data survived migration 0023
    const existingReview = await db.query<{ id: string; title: string }>(
      `SELECT id, title FROM product_reviews WHERE id = $1`,
      [reviewAId],
    );
    expect(existingReview.rows).toHaveLength(1);
    expect(existingReview.rows[0]?.title).toBe("Great Prod A");

    // 6. Verify customer can now insert a review for Product B in the SAME order
    const reviewBId = generateUuidV7();
    await db.query(
      `INSERT INTO product_reviews (
        id, store_id, product_id, customer_id, order_id, rating, title, content,
        status, is_verified_purchase, customer_name_snapshot, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 4, 'Great Prod B', 'Review after migration for same order',
                'PENDING', TRUE, 'Test Customer', NOW(), NOW())`,
      [reviewBId, storeId, productBId, customerId, orderId],
    );

    const reviewsInOrder = await db.query<{ product_id: string }>(
      `SELECT product_id FROM product_reviews WHERE order_id = $1 ORDER BY title ASC`,
      [orderId],
    );
    expect(reviewsInOrder.rows).toHaveLength(2);
    expect(reviewsInOrder.rows.map((r) => r.product_id)).toEqual(
      expect.arrayContaining([productAId, productBId]),
    );

    // 7. Verify attempting a duplicate review for Product A in the SAME order is rejected by the unique index
    const duplicateReviewAId = generateUuidV7();
    await expect(
      db.query(
        `INSERT INTO product_reviews (
          id, store_id, product_id, customer_id, order_id, rating, title, content,
          status, is_verified_purchase, customer_name_snapshot, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 3, 'Duplicate Prod A', 'Should fail unique constraint',
                  'PENDING', TRUE, 'Test Customer', NOW(), NOW())`,
        [duplicateReviewAId, storeId, productAId, customerId, orderId],
      ),
    ).rejects.toThrow();

    // 8. Verify the index definition matches the required partial unique index
    const indexCheck = await db.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'product_reviews' AND indexname = 'product_reviews_verified_order_unique_idx'`,
    );
    expect(indexCheck.rows[0]?.indexdef).toContain("store_id, customer_id, order_id, product_id");
  });

  it("aborts migration 0023 if duplicate reviews already exist for the same customer, order, and product", async () => {
    const db = await setupDb();
    await applyMigrationsUpTo(db, 22);

    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const customerId = generateUuidV7();
    const orderId = generateUuidV7();
    const productId = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Org', 'ACTIVE')`, [orgId]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Test Store', 'dup-store', 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId],
    );
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'dup@test.com', 'D', 'C')`,
      [customerId, storeId],
    );
    await db.query(
      `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, fulfillment_status, currency, total)
       VALUES ($1, $2, $3, 'ORD-DUP', 'CONFIRMED', 'PAID', 'FULFILLED', 'USD', 10000)`,
      [orderId, storeId, customerId],
    );
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Prod', 'prod', 'ACTIVE')`,
      [productId, storeId],
    );

    // Drop index temporarily to simulate existing duplicates in database
    await db.query(`DROP INDEX IF EXISTS product_reviews_verified_order_unique_idx`);
    await db.query(
      `INSERT INTO product_reviews (
        id, store_id, product_id, customer_id, order_id, rating, title, content,
        status, is_verified_purchase, customer_name_snapshot, created_at, updated_at
      ) VALUES
        ($1, $2, $3, $4, $5, 5, 'R1', 'C1', 'PUBLISHED', TRUE, 'DC', NOW(), NOW()),
        ($6, $2, $3, $4, $5, 4, 'R2', 'C2', 'PUBLISHED', TRUE, 'DC', NOW(), NOW())`,
      [generateUuidV7(), storeId, productId, customerId, orderId, generateUuidV7()],
    );

    const migration0023Sql = await fs.readFile(
      path.resolve(process.cwd(), "packages/db/migrations/0023_fix_product_review_order_uniqueness.sql"),
      "utf8",
    );

    await expect(db.query(migration0023Sql)).rejects.toThrow(
      "Cannot apply unique index: duplicate reviews exist for the same customer, order, and product",
    );
  });
});
