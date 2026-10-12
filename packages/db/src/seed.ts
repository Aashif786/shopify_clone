import { type Database, type DatabaseClient } from "./database.js";
import { generateUuidV7 } from "./uuid.js";
import { randomBytes, scrypt } from "node:crypto";

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`);
    });
  });
}

export interface SeedResult {
  userId: string;
  orgId: string;
  storeId: string;
  storeSlug: string;
  productIds: string[];
}

export async function seedDemo(db: Database): Promise<SeedResult> {
  // Check if artisan-store already exists
  const existingStore = await db.query<{ id: string; organization_id: string }>(
    `SELECT id, organization_id FROM stores WHERE slug = 'artisan-store' LIMIT 1`,
  );

  if (existingStore.rows.length > 0 && existingStore.rows[0]) {
    const existing = existingStore.rows[0];
    const products = await db.query<{ id: string }>(
      `SELECT id FROM products WHERE store_id = $1`,
      [existing.id],
    );
    return {
      userId: "",
      orgId: existing.organization_id,
      storeId: existing.id,
      storeSlug: "artisan-store",
      productIds: products.rows.map((p) => p.id),
    };
  }

  return db.withTransaction(async (tx: DatabaseClient) => {
    // 1. Merchant User
    const existingUser = await tx.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'merchant@example.com' LIMIT 1`,
    );
    let userId: string;
    if (existingUser.rows.length > 0 && existingUser.rows[0]) {
      userId = existingUser.rows[0].id;
    } else {
      userId = generateUuidV7();
      const passwordHash = await hashPassword("Password123!");
      await tx.query(
        `INSERT INTO users (id, email, name, password_hash, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [userId, "merchant@example.com", "Demo Merchant", passwordHash],
      );
    }

    // 2. Organization
    const orgId = generateUuidV7();
    await tx.query(
      `INSERT INTO organizations (id, name, status)
       VALUES ($1, $2, 'ACTIVE')`,
      [orgId, "Demo Merchant Org"],
    );

    // 3. Organization Membership
    await tx.query(
      `INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'ACTIVE')`,
      [generateUuidV7(), orgId, userId],
    );

    // 4. Store
    const storeId = generateUuidV7();
    await tx.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, "Demo Artisan Store", "artisan-store"],
    );

    // 5. Store Membership
    await tx.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'ACTIVE')`,
      [generateUuidV7(), storeId, userId],
    );

    // 6. Products, Variants & Inventory
    const productIds: string[] = [];

    const productsData = [
      {
        title: "Handcrafted Ceramic Teapot",
        slug: "ceramic-teapot",
        description: "Handmade artisanal stoneware teapot with heat-resistant bamboo handle and built-in strainer.",
        variantTitle: "Cobalt Blue",
        sku: "TP-BLU-01",
        price: 10000, // $100.00
        quantity: 25,
      },
      {
        title: "Ceramic Artisan Mug",
        slug: "ceramic-artisan-mug",
        description: "Durable ceramic coffee mug individually glazed by master potters.",
        variantTitle: "Earthy Stoneware",
        sku: "MUG-001",
        price: 4500, // $45.00
        quantity: 50,
      },
      {
        title: "Handmade Ceramic Plate Set",
        slug: "ceramic-plate-set",
        description: "Set of 4 rustic ceramic dinner plates with subtle speckled finish.",
        variantTitle: "Speckled White",
        sku: "PLT-WHT-04",
        price: 6500, // $65.00
        quantity: 30,
      },
    ];

    for (const prod of productsData) {
      const productId = generateUuidV7();
      productIds.push(productId);
      await tx.query(
        `INSERT INTO products (id, store_id, title, slug, description, status, published_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())`,
        [productId, storeId, prod.title, prod.slug, prod.description],
      );

      const variantId = generateUuidV7();
      await tx.query(
        `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'USD', 'ACTIVE')`,
        [variantId, productId, storeId, prod.variantTitle, prod.sku, prod.price],
      );

      const inventoryItemId = generateUuidV7();
      await tx.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
         VALUES ($1, $2, $3, $4, 0)`,
        [inventoryItemId, storeId, variantId, prod.quantity],
      );

      await tx.query(
        `INSERT INTO inventory_adjustments (id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity, reason, reference_id)
         VALUES ($1, $2, $3, $4, 0, $4, 'INITIAL_STOCK', $5)`,
        [generateUuidV7(), storeId, inventoryItemId, prod.quantity, `SEED-${prod.sku}`],
      );
    }

    // 7. Discounts
    await tx.query(
      `INSERT INTO discounts (id, store_id, code, name, description, type, value, minimum_subtotal, status)
       VALUES ($1, $2, 'WELCOME20', 'Welcome 20% Off', '20% off for first-time customers', 'PERCENTAGE', 20, 3000, 'ACTIVE')`,
      [generateUuidV7(), storeId],
    );

    await tx.query(
      `INSERT INTO discounts (id, store_id, code, name, description, type, value, minimum_subtotal, status)
       VALUES ($1, $2, 'DEMO20', 'Demo 20% Off', '20% off promotional discount', 'PERCENTAGE', 20, 5000, 'ACTIVE')`,
      [generateUuidV7(), storeId],
    );

    await tx.query(
      `INSERT INTO discounts (id, store_id, code, name, description, type, value, currency, minimum_subtotal, status)
       VALUES ($1, $2, 'SAVE10', '$10 Off Orders Over $40', '$10 flat discount', 'FIXED_AMOUNT', 1000, 'USD', 4000, 'ACTIVE')`,
      [generateUuidV7(), storeId],
    );

    return {
      userId,
      orgId,
      storeId,
      storeSlug: "artisan-store",
      productIds,
    };
  });
}
