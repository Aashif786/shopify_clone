import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { StoreService } from "@calcart/stores";
import { ProductCsvService, ProductService, type ProductDetailDTO } from "@calcart/products";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("CSV import integrity", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const stores = new StoreService();
  const products = new ProductService();
  const csv = new ProductCsvService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setup(): Promise<{ db: Database; storeId: string }> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    const userId = generateUuidV7();
    await isolated.database.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, `merchant-${userId}@example.com`],
    );
    const store = await stores.createStore(isolated.database, userId, {
      name: "Import Store",
      slug: `import-${userId.slice(0, 8)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { db: isolated.database, storeId: store.id };
  }

  async function shirt(db: Database, storeId: string): Promise<ProductDetailDTO> {
    return products.createProduct(db, storeId, {
      title: "Shirt",
      slug: "shirt",
      status: "ACTIVE",
      options: [{ name: "Color", position: 0, values: ["Red", "Blue"], isPublishable: false }],
      variants: [
        { title: "Red", sku: "RED", price: 1000, option1: "Red", inventoryQuantity: 10, status: "ACTIVE" },
        { title: "Blue", sku: "BLUE", price: 1200, option1: "Blue", inventoryQuantity: 8, status: "ACTIVE" },
      ],
    });
  }

  function row(values: Record<string, string>): string {
    const headers = Object.keys(values);
    const escape = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
    return `${headers.join(",")}\n${headers.map((header) => escape(values[header] ?? "")).join(",")}`;
  }

  async function stock(db: Database, variantId: string) {
    const result = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE variant_id = $1`,
      [variantId],
    );
    return {
      available: Number(result.rows[0]?.available_quantity),
      reserved: Number(result.rows[0]?.reserved_quantity),
    };
  }

  it("updates available stock without releasing reservations and keeps omitted variants", async () => {
    const { db, storeId } = await setup();
    const product = await shirt(db, storeId);
    const red = product.variants.find((variant) => variant.sku === "RED")!;
    const blue = product.variants.find((variant) => variant.sku === "BLUE")!;
    await db.query(
      `UPDATE inventory_items SET available_quantity = 6, reserved_quantity = 4 WHERE variant_id = $1`,
      [red.id],
    );

    const result = await csv.execute(
      db,
      storeId,
      row({
        Title: "Shirt",
        Handle: "shirt",
        "Variant ID": red.id,
        SKU: "RED",
        Price: "10.00",
        "Available Quantity": "3",
        "Option1 Name": "Color",
        "Option1 Value": "Red",
      }),
      "upsert",
    );

    expect(result.applied).toBe(true);
    expect(result.failed).toBe(0);
    expect(result.warnings.some((warning) => warning.code === "VARIANTS_OMITTED")).toBe(true);
    expect(await stock(db, red.id)).toEqual({ available: 3, reserved: 4 });
    const blueStatus = await db.query<{ status: string; option1: string }>(
      `SELECT status, option1 FROM product_variants WHERE id = $1`,
      [blue.id],
    );
    expect(blueStatus.rows[0]?.status).toBe("ACTIVE");
    expect(blueStatus.rows[0]?.option1).toBe("Blue");
  });

  it("rejects a negative available quantity and leaves stock unchanged", async () => {
    const { db, storeId } = await setup();
    const product = await shirt(db, storeId);
    const red = product.variants.find((variant) => variant.sku === "RED")!;
    await db.query(
      `UPDATE inventory_items SET available_quantity = 6, reserved_quantity = 4 WHERE variant_id = $1`,
      [red.id],
    );

    const result = await csv.execute(
      db,
      storeId,
      row({
        Title: "Shirt",
        Handle: "shirt",
        "Variant ID": red.id,
        Price: "10.00",
        "Available Quantity": "-1",
      }),
      "update",
    );

    expect(result.applied).toBe(false);
    expect(await stock(db, red.id)).toEqual({ available: 6, reserved: 4 });
  });

  it("archives a variant only when the file explicitly sets Variant Status", async () => {
    const { db, storeId } = await setup();
    const product = await shirt(db, storeId);
    const red = product.variants.find((variant) => variant.sku === "RED")!;
    const blue = product.variants.find((variant) => variant.sku === "BLUE")!;

    const result = await csv.execute(
      db,
      storeId,
      [
        "Title,Handle,Variant ID,SKU,Price,Variant Status",
        `Shirt,shirt,${red.id},RED,10.00,ACTIVE`,
        `Shirt,shirt,${blue.id},BLUE,12.00,ARCHIVED`,
      ].join("\n"),
      "update",
    );

    expect(result.applied).toBe(true);
    const statuses = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM product_variants WHERE product_id = $1`,
      [product.id],
    );
    expect(statuses.rows.find((variant) => variant.id === red.id)?.status).toBe("ACTIVE");
    expect(statuses.rows.find((variant) => variant.id === blue.id)?.status).toBe("ARCHIVED");
  });

  it("keeps existing options when option cells are blank", async () => {
    const { db, storeId } = await setup();
    const product = await shirt(db, storeId);
    const red = product.variants.find((variant) => variant.sku === "RED")!;

    const result = await csv.execute(
      db,
      storeId,
      row({
        Title: "Shirt",
        Handle: "shirt",
        "Variant ID": red.id,
        Price: "11.00",
        "Option1 Name": "",
        "Option1 Value": "",
      }),
      "update",
    );

    expect(result.applied).toBe(true);
    const option = await db.query<{ name: string }>(
      `SELECT name FROM product_options WHERE product_id = $1`,
      [product.id],
    );
    expect(option.rows.map((item) => item.name)).toContain("Color");
    const variant = await db.query<{ option1: string; price: string }>(
      `SELECT option1, price FROM product_variants WHERE id = $1`,
      [red.id],
    );
    expect(variant.rows[0]?.option1).toBe("Red");
    expect(Number(variant.rows[0]?.price)).toBe(1100);
  });

  it("rejects an illegal product status and rolls back the rest of the file", async () => {
    const { db, storeId } = await setup();
    const product = await shirt(db, storeId);
    const red = product.variants.find((variant) => variant.sku === "RED")!;
    const hat = await products.createProduct(db, storeId, {
      title: "Hat",
      slug: "hat",
      status: "ARCHIVED",
      variants: [{ title: "Default Title", sku: "HAT", price: 500, inventoryQuantity: 2, status: "ACTIVE" }],
    });
    const hatVariant = hat.variants[0]!;

    const result = await csv.execute(
      db,
      storeId,
      [
        "Title,Handle,Variant ID,Price,Available Quantity,Status",
        `Shirt,shirt,${red.id},25.00,1,ACTIVE`,
        `Hat,hat,${hatVariant.id},9.00,9,ACTIVE`,
      ].join("\n"),
      "update",
    );

    expect(result.applied).toBe(false);
    expect(result.errors.some((error) => error.code === "INVALID_STATUS" || error.code === "IMPORT_FAILED")).toBe(true);
    const shirtPrice = await db.query<{ price: string }>(
      `SELECT price FROM product_variants WHERE id = $1`,
      [red.id],
    );
    expect(Number(shirtPrice.rows[0]?.price)).toBe(1000);
    expect(await stock(db, red.id)).toEqual({ available: 10, reserved: 0 });
    const hatStatus = await db.query<{ status: string }>(
      `SELECT status FROM products WHERE id = $1`,
      [hat.id],
    );
    expect(hatStatus.rows[0]?.status).toBe("ARCHIVED");
  });

  it("imports the same stock twice without duplicating the variant", async () => {
    const { db, storeId } = await setup();
    const product = await shirt(db, storeId);
    const red = product.variants.find((variant) => variant.sku === "RED")!;
    await db.query(
      `UPDATE inventory_items SET reserved_quantity = 4 WHERE variant_id = $1`,
      [red.id],
    );
    const file = row({
      Title: "Shirt",
      Handle: "shirt",
      "Variant ID": red.id,
      SKU: "RED",
      Price: "10.00",
      "Available Quantity": "5",
    });

    const first = await csv.execute(db, storeId, file, "upsert");
    const second = await csv.execute(db, storeId, file, "upsert");

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(true);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    const count = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM product_variants WHERE product_id = $1`,
      [product.id],
    );
    expect(Number(count.rows[0]?.count)).toBe(2);
    expect(await stock(db, red.id)).toEqual({ available: 5, reserved: 4 });
  });

  it("keeps reserved stock when an import and a reservation update run together", async () => {
    const { db, storeId } = await setup();
    const product = await shirt(db, storeId);
    const red = product.variants.find((variant) => variant.sku === "RED")!;
    await db.query(
      `UPDATE inventory_items SET available_quantity = 10, reserved_quantity = 4 WHERE variant_id = $1`,
      [red.id],
    );

    await Promise.all([
      db.query(
        `UPDATE inventory_items
         SET reserved_quantity = reserved_quantity + 1,
             available_quantity = GREATEST(available_quantity - 1, 0)
         WHERE variant_id = $1 AND available_quantity >= 1`,
        [red.id],
      ),
      csv.execute(
        db,
        storeId,
        row({
          Title: "Shirt",
          Handle: "shirt",
          "Variant ID": red.id,
          Price: "10.00",
          "Available Quantity": "6",
        }),
        "update",
      ),
    ]);

    const ending = await stock(db, red.id);
    expect(ending.reserved).toBeGreaterThanOrEqual(4);
    expect(ending.available).toBeGreaterThanOrEqual(0);
  });
});
