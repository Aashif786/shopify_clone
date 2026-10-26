import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import {
  CannotDeleteLastVariantError,
  DuplicateProductSlugError,
  DuplicateSkuError,
  ProductNotFoundError,
  ProductNotPublishableError,
  ProductService,
  VariantNotFoundError,
} from "@shopify-clone/products";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Products Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const productService = new ProductService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb() {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function createTestUser(db: Database, email = "merchant@example.com") {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  async function createTestStore(db: Database, userId: string, slug = "acme-store") {
    return await storeService.createStore(db, userId, {
      name: "Acme Store",
      slug,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });
  }

  describe("Product Creation (createProduct)", () => {
    it("atomically creates a product with a default variant when none specified", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      const product = await productService.createProduct(db, store.id, {
        title: "Classic Canvas Sneakers",
        description: "Comfortable casual shoes",
        slug: "classic-canvas-sneakers",
        price: 4999, // $49.99
        compareAtPrice: 5999,
        sku: "SNEAKER-001",
      });

      expect(product.id).toBeDefined();
      expect(product.storeId).toBe(store.id);
      expect(product.title).toBe("Classic Canvas Sneakers");
      expect(product.slug).toBe("classic-canvas-sneakers");
      expect(product.status).toBe("DRAFT");
      expect(product.publishedAt).toBeNull();
      expect(product.variants).toHaveLength(1);

      const variant = product.variants[0]!;
      expect(variant.title).toBe("Default Title");
      expect(variant.sku).toBe("SNEAKER-001");
      expect(variant.price).toBe(4999);
      expect(variant.compareAtPrice).toBe(5999);
      expect(variant.currency).toBe("USD");
      expect(variant.status).toBe("ACTIVE");
    });

    it("atomically creates a product with multiple explicit variants and media", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      const product = await productService.createProduct(db, store.id, {
        title: "Merino Wool Sweater",
        description: "100% fine wool",
        variants: [
          { title: "Small / Charcoal", price: 8900, sku: "SWEATER-S-CHAR", position: 0 },
          { title: "Medium / Charcoal", price: 8900, sku: "SWEATER-M-CHAR", position: 1 },
          { title: "Large / Charcoal", price: 9500, sku: "SWEATER-L-CHAR", position: 2 },
        ],
        media: [
          { url: "https://example.com/sweater-front.jpg", altText: "Front view", position: 0 },
          { url: "https://example.com/sweater-back.jpg", altText: "Back view", position: 1 },
        ],
      });

      expect(product.variants).toHaveLength(3);
      expect(product.variants[0]!.title).toBe("Small / Charcoal");
      expect(product.variants[1]!.title).toBe("Medium / Charcoal");
      expect(product.variants[2]!.title).toBe("Large / Charcoal");
      expect(product.media).toHaveLength(2);
      expect(product.media[0]!.url).toBe("https://example.com/sweater-front.jpg");
    });

    it("rejects duplicate slug within the same store with DuplicateProductSlugError", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      await productService.createProduct(db, store.id, {
        title: "Silk Scarf",
        slug: "silk-scarf",
      });

      await expect(
        productService.createProduct(db, store.id, {
          title: "Another Silk Scarf",
          slug: "silk-scarf",
        }),
      ).rejects.toThrow(DuplicateProductSlugError);
    });

    it("permits the same slug across different stores (store-scoped slug)", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const storeA = await createTestStore(db, userId, "store-a");
      const storeB = await createTestStore(db, userId, "store-b");

      const productA = await productService.createProduct(db, storeA.id, {
        title: "Shared Item",
        slug: "shared-item",
      });
      const productB = await productService.createProduct(db, storeB.id, {
        title: "Shared Item",
        slug: "shared-item",
      });

      expect(productA.slug).toBe("shared-item");
      expect(productB.slug).toBe("shared-item");
      expect(productA.storeId).not.toBe(productB.storeId);
    });

    it("rejects duplicate SKU within the same store with DuplicateSkuError", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      await productService.createProduct(db, store.id, {
        title: "Running Cap",
        sku: "CAP-001",
      });

      await expect(
        productService.createProduct(db, store.id, {
          title: "Cycling Cap",
          sku: "CAP-001",
        }),
      ).rejects.toThrow(DuplicateSkuError);
    });

    it("permits identical SKU across different stores (store-scoped SKU)", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const storeA = await createTestStore(db, userId, "store-a");
      const storeB = await createTestStore(db, userId, "store-b");

      const pA = await productService.createProduct(db, storeA.id, {
        title: "Water Bottle",
        sku: "BOTTLE-001",
      });
      const pB = await productService.createProduct(db, storeB.id, {
        title: "Water Bottle",
        sku: "BOTTLE-001",
      });

      expect(pA.variants[0]!.sku).toBe("BOTTLE-001");
      expect(pB.variants[0]!.sku).toBe("BOTTLE-001");
    });
  });

  describe("Product Retrieval & Listing", () => {
    it("retrieves product by ID and by slug with details", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      const created = await productService.createProduct(db, store.id, {
        title: "Linen Shirt",
        slug: "linen-shirt",
        price: 3500,
      });

      const byId = await productService.getProductById(db, store.id, created.id);
      expect(byId.id).toBe(created.id);
      expect(byId.title).toBe("Linen Shirt");
      expect(byId.variants).toHaveLength(1);

      const bySlug = await productService.getProductBySlug(db, store.id, "linen-shirt");
      expect(bySlug.id).toBe(created.id);

      await expect(
        productService.getProductById(db, store.id, generateUuidV7()),
      ).rejects.toThrow(ProductNotFoundError);
    });

    it("lists products with cursor pagination and status filtering", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      for (let i = 1; i <= 5; i++) {
        await productService.createProduct(db, store.id, {
          title: `Product ${i}`,
          slug: `product-${i}`,
          status: i <= 3 ? "ACTIVE" : "DRAFT",
        });
      }

      // Page 1
      const page1 = await productService.listProducts(db, store.id, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Page 2
      const page2 = await productService.listProducts(db, store.id, {
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(true);

      // Filter by ACTIVE status
      const activeProducts = await productService.listProducts(db, store.id, {
        status: "ACTIVE",
      });
      expect(activeProducts.items).toHaveLength(3);
      for (const item of activeProducts.items) {
        expect(item.status).toBe("ACTIVE");
      }
    });
  });

  describe("Product Lifecycle (Publish, Unpublish, Archive)", () => {
    it("handles full product lifecycle transitions", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      const product = await productService.createProduct(db, store.id, {
        title: "Trail Backpack",
        price: 12000,
      });
      expect(product.status).toBe("DRAFT");
      expect(product.publishedAt).toBeNull();

      // Publish: DRAFT -> ACTIVE
      const published = await productService.publishProduct(db, store.id, product.id);
      expect(published.status).toBe("ACTIVE");
      expect(published.publishedAt).toBeDefined();

      // Unpublish: ACTIVE -> DRAFT
      const unpublished = await productService.unpublishProduct(db, store.id, product.id);
      expect(unpublished.status).toBe("DRAFT");

      // Publish again: DRAFT -> ACTIVE
      await productService.publishProduct(db, store.id, product.id);

      // Archive: ACTIVE -> ARCHIVED
      const archived = await productService.archiveProduct(db, store.id, product.id);
      expect(archived.status).toBe("ARCHIVED");

      // Cannot publish archived product directly
      await expect(
        productService.publishProduct(db, store.id, product.id),
      ).rejects.toThrow();
    });

    it("rejects publishing product without active variants", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      const product = await productService.createProduct(db, store.id, {
        title: "Unpublishable Item",
        price: 1000,
      });

      // Deactivate variant
      const variant = product.variants[0]!;
      await productService.updateVariant(db, store.id, product.id, variant.id, {
        status: "INACTIVE",
      });

      // Publishing should fail with ProductNotPublishableError
      await expect(
        productService.publishProduct(db, store.id, product.id),
      ).rejects.toThrow(ProductNotPublishableError);
    });
  });

  describe("Variant Management", () => {
    it("adds, updates, and deletes variants while enforcing last-variant invariant", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      const product = await productService.createProduct(db, store.id, {
        title: "Modular Desk",
        price: 25000,
      });
      const defaultVariant = product.variants[0]!;

      // Add second variant
      const secondVariant = await productService.createVariant(db, store.id, product.id, {
        title: "Standing Desk Version",
        sku: "DESK-STAND-01",
        price: 35000,
      });
      expect(secondVariant.id).toBeDefined();
      expect(secondVariant.title).toBe("Standing Desk Version");
      expect(secondVariant.price).toBe(35000);

      // List variants
      const variants = await productService.listVariants(db, store.id, product.id);
      expect(variants).toHaveLength(2);

      // Update second variant
      const updatedVariant = await productService.updateVariant(
        db,
        store.id,
        product.id,
        secondVariant.id,
        { price: 32000, title: "Standing Desk - Pro" },
      );
      expect(updatedVariant.price).toBe(32000);
      expect(updatedVariant.title).toBe("Standing Desk - Pro");

      // Delete second variant
      await productService.deleteVariant(db, store.id, product.id, secondVariant.id);
      const remainingVariants = await productService.listVariants(db, store.id, product.id);
      expect(remainingVariants).toHaveLength(1);

      // Attempting to delete the last variant must fail
      await expect(
        productService.deleteVariant(db, store.id, product.id, defaultVariant.id),
      ).rejects.toThrow(CannotDeleteLastVariantError);

      // Attempting to update a non-existent variant must throw VariantNotFoundError
      await expect(
        productService.updateVariant(db, store.id, product.id, generateUuidV7(), {
          price: 1000,
        }),
      ).rejects.toThrow(VariantNotFoundError);
    });

    it("creates product with options, combinations, and handles batch variant updates", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId);

      // Create product with 2 options and 4 generated combinations
      const product = await productService.createProduct(db, store.id, {
        title: "Luffy Anime Hoodie",
        slug: "luffy-anime-hoodie",
        options: [
          { name: "Size", position: 0, values: ["M", "L"] },
          { name: "Color", position: 1, values: ["Red", "Black"] },
        ],
        variants: [
          {
            title: "M / Red",
            sku: "HOOD-M-RED",
            price: 4999,
            compareAtPrice: 5999,
            option1: "M",
            option2: "Red",
            inventoryQuantity: 25,
            position: 0,
          },
          {
            title: "M / Black",
            sku: "HOOD-M-BLK",
            price: 4999,
            compareAtPrice: 5999,
            option1: "M",
            option2: "Black",
            inventoryQuantity: 20,
            position: 1,
          },
          {
            title: "L / Red",
            sku: "HOOD-L-RED",
            price: 5299,
            compareAtPrice: 6299,
            option1: "L",
            option2: "Red",
            inventoryQuantity: 15,
            position: 2,
          },
          {
            title: "L / Black",
            sku: "HOOD-L-BLK",
            price: 5299,
            compareAtPrice: 6299,
            option1: "L",
            option2: "Black",
            inventoryQuantity: 30,
            position: 3,
          },
        ],
      });

      expect(product.options).toHaveLength(2);
      expect(product.options[0]?.name).toBe("Size");
      expect(product.options[0]?.values).toEqual(["M", "L"]);
      expect(product.options[1]?.name).toBe("Color");
      expect(product.options[1]?.values).toEqual(["Red", "Black"]);

      expect(product.variants).toHaveLength(4);
      expect(product.variants[0]?.title).toBe("M / Red");
      expect(product.variants[0]?.option1).toBe("M");
      expect(product.variants[0]?.option2).toBe("Red");
      expect(product.variants[0]?.inventoryQuantity).toBe(25);

      // Fetch by slug
      const fetched = await productService.getProductBySlug(db, store.id, "luffy-anime-hoodie");
      expect(fetched.options).toHaveLength(2);
      expect(fetched.variants).toHaveLength(4);

      // Batch update variants
      const v0 = product.variants[0]!;
      const v1 = product.variants[1]!;
      const updatedVariants = await productService.batchUpdateVariants(db, store.id, product.id, [
        { id: v0.id, price: 4499, sku: "HOOD-M-RED-V2" },
        { id: v1.id, price: 4799, status: "INACTIVE" },
      ]);

      expect(updatedVariants).toHaveLength(2);
      const updatedV0 = updatedVariants.find((v) => v.id === v0.id);
      expect(updatedV0?.price).toBe(4499);
      expect(updatedV0?.sku).toBe("HOOD-M-RED-V2");

      const updatedV1 = updatedVariants.find((v) => v.id === v1.id);
      expect(updatedV1?.price).toBe(4799);
      expect(updatedV1?.status).toBe("INACTIVE");
    });
  });
});
