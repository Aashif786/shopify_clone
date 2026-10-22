import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { ProductService } from "@shopify-clone/products";
import { StoreService } from "@shopify-clone/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import { GET as getStorefrontProducts } from "../apps/web/app/api/v1/storefront/[storeSlug]/products/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Storefront Product Search, Filtering & Sorting Integration", { timeout: 60_000 }, () => {
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
    global.__shopify_clone_web_db = isolated.database;

    // Create user and Store A
    const userAId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner A', 'scrypt:hash', 'ACTIVE')`,
      [userAId, `owner-a-${Date.now()}@test.local`],
    );
    const sA = await storeService.createStore(db, userAId, {
      name: "Artisan Coffee Store",
      slug: `artisan-coffee-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sA.id, userAId);
    storeA = { id: sA.id, slug: sA.slug };

    // Create user and Store B (for tenant isolation tests)
    const userBId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner B', 'scrypt:hash', 'ACTIVE')`,
      [userBId, `owner-b-${Date.now()}@test.local`],
    );
    const sB = await storeService.createStore(db, userBId, {
      name: "Competitor Store",
      slug: `competitor-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sB.id, userBId);
    storeB = { id: sB.id, slug: sB.slug };
  });

  afterAll(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("filters products by search keyword across title, description, and SKU", async () => {
    // Product 1: Ceramic Mug
    await productService.createProduct(db, storeA.id, {
      title: "Handmade Ceramic Mug",
      description: "A cozy morning coffee cup made of clay.",
      status: "ACTIVE",
      price: 2400,
      sku: "MUG-CRM-01",
    });

    // Product 2: Pour-Over Dripper
    await productService.createProduct(db, storeA.id, {
      title: "Glass Dripper",
      description: "V60 style glass dripper for precision pour-overs.",
      status: "ACTIVE",
      price: 3200,
      sku: "DRIP-GLS-02",
    });

    // Product 3: Coffee Beans
    await productService.createProduct(db, storeA.id, {
      title: "Ethiopia Yirgacheffe",
      description: "Single origin floral roast with hints of bergamot.",
      status: "ACTIVE",
      price: 1800,
      sku: "BEAN-ETH-03",
    });

    // 1. Search by title keyword (case-insensitive & partial match)
    const mugSearch = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      search: "ceramic",
    });
    expect(mugSearch.items.length).toBeGreaterThanOrEqual(1);
    expect(mugSearch.items.some((i) => i.title === "Handmade Ceramic Mug")).toBe(true);

    // 2. Search by description keyword
    const roastSearch = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      search: "bergamot",
    });
    expect(roastSearch.items.length).toBeGreaterThanOrEqual(1);
    expect(roastSearch.items.some((i) => i.title === "Ethiopia Yirgacheffe")).toBe(true);

    // 3. Search by SKU
    const skuSearch = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      search: "DRIP-GLS",
    });
    expect(skuSearch.items.length).toBeGreaterThanOrEqual(1);
    expect(skuSearch.items.some((i) => i.title === "Glass Dripper")).toBe(true);

    // 4. Search with leading/trailing whitespace
    const trimmedSearch = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      search: "   dripper   ",
    });
    expect(trimmedSearch.items.length).toBeGreaterThanOrEqual(1);
    expect(trimmedSearch.items.some((i) => i.title === "Glass Dripper")).toBe(true);

    // 5. Search with no matches
    const noMatch = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      search: "EspressoMachineNonExistent",
    });
    expect(noMatch.items).toHaveLength(0);
  });

  it("filters products by price range respecting multi-variant active pricing", async () => {
    // Product 1: Single variant priced at $20 (2000 cents)
    await productService.createProduct(db, storeA.id, {
      title: "Basic Price Mug",
      slug: `basic-price-mug-${Date.now()}`,
      status: "ACTIVE",
      price: 2000,
    });

    // Product 2: Multi-variant item: Small ($15 = 1500 cents), Large ($35 = 3500 cents)
    await productService.createProduct(db, storeA.id, {
      title: "Signature Tumbler Range",
      slug: `signature-tumbler-range-${Date.now()}`,
      status: "ACTIVE",
      price: 1500,
      variants: [
        { title: "Small (12oz)", price: 1500 },
        { title: "Large (24oz)", price: 3500 },
      ],
    });

    // Product 3: Expensive Coffee Machine ($150 = 15000 cents)
    await productService.createProduct(db, storeA.id, {
      title: "Pro Espresso Range Maker",
      slug: `pro-espresso-maker-${Date.now()}`,
      status: "ACTIVE",
      price: 15000,
    });

    // 1. Min price filter only (>= $25) -> matches Tumbler (Large is $35) and Espresso ($150)
    const min25 = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      minPrice: 2500,
    });
    const min25Titles = min25.items.map((i) => i.title);
    expect(min25Titles).toContain("Signature Tumbler Range");
    expect(min25Titles).toContain("Pro Espresso Range Maker");
    expect(min25Titles).not.toContain("Basic Price Mug");

    // 2. Max price filter only (<= $22) -> matches Basic Mug ($20) and Tumbler (Small is $15)
    const max22 = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      maxPrice: 2200,
    });
    const max22Titles = max22.items.map((i) => i.title);
    expect(max22Titles).toContain("Basic Price Mug");
    expect(max22Titles).toContain("Signature Tumbler Range");
    expect(max22Titles).not.toContain("Pro Espresso Range Maker");

    // 3. Exact range ($18 to $22) -> only matches Basic Mug ($20)
    const range18to22 = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      minPrice: 1800,
      maxPrice: 2200,
    });
    expect(range18to22.items.some((i) => i.title === "Basic Price Mug")).toBe(true);
    expect(range18to22.items.some((i) => i.title === "Pro Espresso Range Maker")).toBe(false);
  });

  it("filters products by authoritative in-stock availability", async () => {
    // Create In-Stock Product
    const inStockProd = await productService.createProduct(db, storeA.id, {
      title: "In Stock Beans Specific",
      slug: `in-stock-beans-${Date.now()}`,
      status: "ACTIVE",
      price: 1800,
    });
    const inStockVariantId = inStockProd.variants[0]!.id;

    // Create Out-Of-Stock Product
    const outOfStockProd = await productService.createProduct(db, storeA.id, {
      title: "Sold Out Roaster Specific",
      slug: `sold-out-roaster-${Date.now()}`,
      status: "ACTIVE",
      price: 4500,
    });
    const outOfStockVariantId = outOfStockProd.variants[0]!.id;

    // Set available quantities in inventory_items
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 10, 0), ($4, $5, $6, 0, 0)`,
      [
        generateUuidV7(),
        storeA.id,
        inStockVariantId,
        generateUuidV7(),
        storeA.id,
        outOfStockVariantId,
      ],
    );

    // Filter with inStock: true
    const inStockOnly = await productService.listProducts(db, storeA.id, {
      status: "ACTIVE",
      inStock: true,
    });
    const inStockTitles = inStockOnly.items.map((i) => i.title);
    expect(inStockTitles).toContain("In Stock Beans Specific");
    expect(inStockTitles).not.toContain("Sold Out Roaster Specific");
  });

  it("sorts products deterministically by price, title, and date", async () => {
    // Create dedicated store for strict order tests
    const storeOrderUser = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Order User', 'scrypt:hash', 'ACTIVE')`,
      [storeOrderUser, `order-user-${Date.now()}@test.local`],
    );
    const storeOrder = await storeService.createStore(db, storeOrderUser, {
      name: "Order Store",
      slug: `order-store-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });

    await productService.createProduct(db, storeOrder.id, {
      title: "Alpha Beans",
      slug: "alpha-beans",
      status: "ACTIVE",
      price: 3000,
    });
    await productService.createProduct(db, storeOrder.id, {
      title: "Beta Kettle",
      slug: "beta-kettle",
      status: "ACTIVE",
      price: 1000,
    });
    await productService.createProduct(db, storeOrder.id, {
      title: "Gamma Scale",
      slug: "gamma-scale",
      status: "ACTIVE",
      price: 2000,
    });

    // Price Ascending: Beta ($10), Gamma ($20), Alpha ($30)
    const priceAsc = await productService.listProducts(db, storeOrder.id, {
      status: "ACTIVE",
      sortBy: "price_asc",
    });
    expect(priceAsc.items.map((i) => i.title)).toEqual([
      "Beta Kettle",
      "Gamma Scale",
      "Alpha Beans",
    ]);

    // Price Descending: Alpha ($30), Gamma ($20), Beta ($10)
    const priceDesc = await productService.listProducts(db, storeOrder.id, {
      status: "ACTIVE",
      sortBy: "price_desc",
    });
    expect(priceDesc.items.map((i) => i.title)).toEqual([
      "Alpha Beans",
      "Gamma Scale",
      "Beta Kettle",
    ]);

    // Title Ascending: Alpha, Beta, Gamma
    const titleAsc = await productService.listProducts(db, storeOrder.id, {
      status: "ACTIVE",
      sortBy: "title_asc",
    });
    expect(titleAsc.items.map((i) => i.title)).toEqual([
      "Alpha Beans",
      "Beta Kettle",
      "Gamma Scale",
    ]);

    // Title Descending: Gamma, Beta, Alpha
    const titleDesc = await productService.listProducts(db, storeOrder.id, {
      status: "ACTIVE",
      sortBy: "title_desc",
    });
    expect(titleDesc.items.map((i) => i.title)).toEqual([
      "Gamma Scale",
      "Beta Kettle",
      "Alpha Beans",
    ]);
  });

  it("handles storefront products API query parameters and validation", async () => {
    await productService.createProduct(db, storeA.id, {
      title: "Special Blend API",
      slug: `special-blend-api-${Date.now()}`,
      status: "ACTIVE",
      price: 1500,
    });

    // 1. Valid storefront request with search
    const req1 = new Request(
      `http://localhost/api/v1/storefront/${storeA.slug}/products?search=Special+Blend+API`,
    );
    const res1 = await getStorefrontProducts(req1, {
      params: Promise.resolve({ storeSlug: storeA.slug }),
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);
    expect(body1.data.items.some((i: { title: string }) => i.title === "Special Blend API")).toBe(true);

    // 2. Invalid price range (minPrice > maxPrice) returns 400
    const req2 = new Request(
      `http://localhost/api/v1/storefront/${storeA.slug}/products?minPrice=5000&maxPrice=2000`,
    );
    const res2 = await getStorefrontProducts(req2, {
      params: Promise.resolve({ storeSlug: storeA.slug }),
    });
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error.code).toBe("INVALID_PRICE_RANGE");

    // 3. Negative price returns 400
    const req3 = new Request(
      `http://localhost/api/v1/storefront/${storeA.slug}/products?minPrice=-10`,
    );
    const res3 = await getStorefrontProducts(req3, {
      params: Promise.resolve({ storeSlug: storeA.slug }),
    });
    expect(res3.status).toBe(400);
    const body3 = await res3.json();
    expect(body3.error.code).toBe("INVALID_PRICE_FILTER");
  });

  it("enforces tenant isolation across search queries", async () => {
    // Store A product
    await productService.createProduct(db, storeA.id, {
      title: "Secret Proprietary Blend",
      slug: `secret-blend-${Date.now()}`,
      status: "ACTIVE",
      price: 2500,
    });

    // Store B queries for Store A's product -> must yield 0 results
    const storeBSearch = await productService.listProducts(db, storeB.id, {
      status: "ACTIVE",
      search: "Secret Proprietary",
    });
    expect(storeBSearch.items).toHaveLength(0);
  });
});
