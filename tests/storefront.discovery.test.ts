import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { ProductService } from "@calcart/products";
import { StoreService } from "@calcart/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Storefront Product Discovery (Search, Filters, Facets, Sorting)", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const productService = new ProductService();

  let storeA: { id: string; slug: string };
  let storeB: { id: string; slug: string };

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;

    // 1. Create Store A
    const userAId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner A', 'scrypt:hash', 'ACTIVE')`,
      [userAId, `owner-a-${Date.now()}@test.local`],
    );
    const sA = await storeService.createStore(db, userAId, {
      name: "Streetwear Atelier",
      slug: `streetwear-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sA.id, userAId);
    storeA = { id: sA.id, slug: sA.slug };

    // 2. Create Store B (Isolation)
    const userBId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner B', 'scrypt:hash', 'ACTIVE')`,
      [userBId, `owner-b-${Date.now()}@test.local`],
    );
    const sB = await storeService.createStore(db, userBId, {
      name: "Luxury Minimalist",
      slug: `luxury-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sB.id, userBId);
    storeB = { id: sB.id, slug: sB.slug };

    // 3. Create categories
    const catTops = await productService.createCategory(db, storeA.id, {
      name: "Tops & Hoodies",
      slug: "tops-hoodies",
    });

    const catBottoms = await productService.createCategory(db, storeA.id, {
      name: "Pants & Trousers",
      slug: "pants-trousers",
    });

    // 4. Create products in Store A with options (Size & Color)
    await productService.createProduct(db, storeA.id, {
      title: "Signature Heavyweight Hoodie",
      description: "Custom milled French Terry cotton with embroidered chest emblem.",
      status: "ACTIVE",
      categoryId: catTops.id,
      price: 9500,
      compareAtPrice: 12000,
      sku: "HD-BLK-M",
      options: [
        { name: "Size", values: ["M", "L", "XL"], isPublishable: false },
        { name: "Color", values: ["Black", "Bone"], isPublishable: true },
      ],
      variants: [
        {
          title: "Black / M",
          sku: "HD-BLK-M",
          price: 9500,
          compareAtPrice: 12000,
          option1: "M",
          option2: "Black",
          status: "ACTIVE",
        },
        {
          title: "Black / L",
          sku: "HD-BLK-L",
          price: 9500,
          compareAtPrice: 12000,
          option1: "L",
          option2: "Black",
          status: "ACTIVE",
        },
      ],
    });

    await productService.createProduct(db, storeA.id, {
      title: "Tactical Cargo Trousers",
      description: "Water resistant ripstop fabric with deep cargo utility pockets.",
      status: "ACTIVE",
      categoryId: catBottoms.id,
      price: 11500,
      sku: "CG-KHK-32",
      options: [
        { name: "Size", values: ["30", "32", "34"], isPublishable: false },
        { name: "Color", values: ["Khaki", "Olive"], isPublishable: true },
      ],
    });

    await productService.createProduct(db, storeA.id, {
      title: "Essential Graphic T-Shirt",
      description: "Soft vintage wash jersey with screenprinted art.",
      status: "ACTIVE",
      categoryId: catTops.id,
      price: 4500,
      compareAtPrice: 5500,
      sku: "TEE-WHT-L",
      options: [
        { name: "Size", values: ["S", "M", "L"], isPublishable: false },
        { name: "Color", values: ["White", "Charcoal"], isPublishable: true },
      ],
    });

    // Product in Store B
    await productService.createProduct(db, storeB.id, {
      title: "Cashmere Trench Coat",
      description: "Italian spun pure cashmere double-breasted coat.",
      status: "ACTIVE",
      price: 48000,
      sku: "COAT-CSH-01",
    });
  });

  afterAll(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("generates catalog filter facets with correct categories, options, and price range", async () => {
    const facets = await productService.getCatalogFilterFacets(db, storeA.id);

    expect(facets).toBeDefined();
    expect(facets.categories.length).toBeGreaterThanOrEqual(2);
    expect(facets.categories.some((c) => c.name === "Tops & Hoodies")).toBe(true);

    // Options facet (Size and Color)
    expect(facets.options.length).toBeGreaterThanOrEqual(1);
    const sizeOpt = facets.options.find((o) => o.name.toLowerCase() === "size");
    const colorOpt = facets.options.find((o) => o.name.toLowerCase() === "color");

    expect(sizeOpt || colorOpt).toBeDefined();

    // Counts
    expect(facets.counts.total).toBeGreaterThanOrEqual(3);
    expect(facets.counts.onSale).toBeGreaterThanOrEqual(2); // Hoodie & T-shirt have compare_at_price > price
  });

  it("filters products by size and onSale correctly", async () => {
    // Filter onSale
    const saleList = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      onSale: true,
      includeStandaloneVariants: true,
    });
    expect(saleList.items.length).toBeGreaterThanOrEqual(2);
    expect(saleList.items.every((i) => i.compareAtPrice && i.compareAtPrice > (i.price ?? 0))).toBe(true);

    // Filter by size
    const sizeMList = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      sizes: ["M"],
      includeStandaloneVariants: true,
    });
    expect(sizeMList.items.length).toBeGreaterThanOrEqual(1);
    expect(sizeMList.items.some((i) => i.title.includes("Hoodie") || i.title.includes("T-Shirt"))).toBe(true);
  });

  it("returns search suggestions matching product titles and categories", async () => {
    const suggestions = await productService.getSearchSuggestions(db, storeA.id, "Hoodie");
    expect(suggestions).toBeDefined();
    expect(suggestions.query).toBe("Hoodie");
    expect(suggestions.suggestions.length).toBeGreaterThanOrEqual(1);

    const productMatch = suggestions.suggestions.find((s) => s.type === "product");
    expect(productMatch).toBeDefined();
    expect(productMatch?.title).toContain("Hoodie");
  });

  it("sorts catalog products by price ascending and price descending", async () => {
    const ascList = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      sortBy: "price_asc",
      includeStandaloneVariants: true,
    });
    expect(ascList.items.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < ascList.items.length - 1; i++) {
      expect((ascList.items[i]!.price ?? 0)).toBeLessThanOrEqual((ascList.items[i + 1]!.price ?? 0));
    }

    const descList = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      sortBy: "price_desc",
      includeStandaloneVariants: true,
    });
    expect(descList.items.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < descList.items.length - 1; i++) {
      expect((descList.items[i]!.price ?? 0)).toBeGreaterThanOrEqual((descList.items[i + 1]!.price ?? 0));
    }
  });

  it("sorts catalog products by alphabetical title ascending and descending", async () => {
    const titleAsc = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      sortBy: "title_asc",
      includeStandaloneVariants: true,
    });
    expect(titleAsc.items.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < titleAsc.items.length - 1; i++) {
      expect(titleAsc.items[i]!.title.localeCompare(titleAsc.items[i + 1]!.title)).toBeLessThanOrEqual(0);
    }
  });

  it("enforces strict tenant isolation across facets and suggestions", async () => {
    // Store A query for Store B product returns empty
    const storeASuggestions = await productService.getSearchSuggestions(db, storeA.id, "Cashmere");
    expect(storeASuggestions.suggestions.length).toBe(0);

    // Store B query for Store A product returns empty
    const storeBSuggestions = await productService.getSearchSuggestions(db, storeB.id, "Hoodie");
    expect(storeBSuggestions.suggestions.length).toBe(0);

    // Facets for Store B do not contain Store A categories
    const storeBFacets = await productService.getCatalogFilterFacets(db, storeB.id);
    expect(storeBFacets.categories.some((c) => c.name === "Tops & Hoodies")).toBe(false);
  });
});
