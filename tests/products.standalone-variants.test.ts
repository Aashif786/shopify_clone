import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import { ProductService } from "@shopify-clone/products";
import { CartService } from "@shopify-clone/carts";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Product Standalone Variants and Media Assignment Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const productService = new ProductService();
  const cartService = new CartService();

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
      name: "Apparel Hub",
      slug: `apparel-${userId.slice(0, 8)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    return { store, userId };
  }

  it("12-step verification: manages variant titles, multi-image assignment, standalone listings, and cart integrity", async () => {
    const db = await setupDb();
    const { store } = await createTestStore(db);

    // Step 1: Create a parent product with multiple variants (Black, White, Blue) and media items
    const mediaUrls = [
      { url: "https://example.com/media/black-front.jpg", altText: "Black T-Shirt Front", position: 0 },
      { url: "https://example.com/media/black-back.jpg", altText: "Black T-Shirt Back", position: 1 },
      { url: "https://example.com/media/white-front.jpg", altText: "White T-Shirt Front", position: 2 },
      { url: "https://example.com/media/white-detail.jpg", altText: "White T-Shirt Fabric Detail", position: 3 },
      { url: "https://example.com/media/blue-front.jpg", altText: "Blue T-Shirt Front", position: 4 },
      { url: "https://example.com/media/general-lifestyle.jpg", altText: "Lifestyle Group Photo", position: 5 },
    ];

    const created = await productService.createProduct(db, store.id, {
      title: "Essential Crewneck Tee",
      description: "100% organic cotton crewneck tee in versatile colors.",
      slug: "essential-crewneck-tee",
      status: "ACTIVE",
      media: mediaUrls,
      options: [
        { name: "Color", position: 0, values: ["Black", "White", "Blue"] },
      ],
      variants: [
        {
          title: "Black",
          displayTitle: "Midnight Black Essential Tee",
          publishedAsProduct: true,
          sku: "TEE-BLK",
          price: 3200, // $32.00
          compareAtPrice: 3800,
          inventoryQuantity: 50,
          option1: "Black",
          position: 0,
          mediaIndexes: [0, 1], // Assigned black front & black back
        },
        {
          title: "White",
          displayTitle: "Crisp White Essential Tee",
          publishedAsProduct: true,
          sku: "TEE-WHT",
          price: 3200,
          compareAtPrice: null,
          inventoryQuantity: 40,
          option1: "White",
          position: 1,
          mediaIndexes: [2, 3], // Assigned white front & white detail
        },
        {
          title: "Blue",
          displayTitle: null, // Fallback title
          publishedAsProduct: false,
          sku: "TEE-BLU",
          price: 3000,
          compareAtPrice: null,
          inventoryQuantity: 25,
          option1: "Blue",
          position: 2,
          mediaIndexes: [4], // Assigned blue front
        },
      ],
    });

    expect(created.id).toBeDefined();
    expect(created.variants).toHaveLength(3);

    // Step 2 & 3: Verify persistence of variant titles, images, and publishedAsProduct status
    const fetched = await productService.getProductById(db, store.id, created.id);
    expect(fetched).not.toBeNull();

    const blackVar = fetched!.variants.find((v) => v.sku === "TEE-BLK")!;
    expect(blackVar).toBeDefined();
    expect(blackVar.displayTitle).toBe("Midnight Black Essential Tee");
    expect(blackVar.publishedAsProduct).toBe(true);
    expect(blackVar.mediaIds).toHaveLength(2);
    expect(blackVar.media).toHaveLength(2);
    expect(blackVar.media![0]?.url).toBe("https://example.com/media/black-front.jpg");
    expect(blackVar.media![1]?.url).toBe("https://example.com/media/black-back.jpg");

    const whiteVar = fetched!.variants.find((v) => v.sku === "TEE-WHT")!;
    expect(whiteVar).toBeDefined();
    expect(whiteVar.displayTitle).toBe("Crisp White Essential Tee");
    expect(whiteVar.publishedAsProduct).toBe(true);
    expect(whiteVar.mediaIds).toHaveLength(2);
    expect(whiteVar.media![0]?.url).toBe("https://example.com/media/white-front.jpg");

    const blueVar = fetched!.variants.find((v) => v.sku === "TEE-BLU")!;
    expect(blueVar).toBeDefined();
    expect(blueVar.displayTitle).toBeNull();
    expect(blueVar.publishedAsProduct).toBe(false);
    expect(blueVar.mediaIds).toHaveLength(1);
    expect(blueVar.media![0]?.url).toBe("https://example.com/media/blue-front.jpg");

    // Step 4 & 5: Storefront catalog with standalone variants (includeStandaloneVariants: true)
    // Black and White are publishedAsProduct: true; Blue is publishedAsProduct: false.
    // Expectation: Black standalone card, White standalone card, PLUS parent card for remaining Blue variant.
    const catalog = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
    });

    expect(catalog.items).toHaveLength(3);

    const blackItem = catalog.items.find((i) => i.variantId === blackVar.id);
    expect(blackItem).toBeDefined();
    expect(blackItem!.isStandaloneVariant).toBe(true);
    expect(blackItem!.title).toBe("Midnight Black Essential Tee");
    expect(blackItem!.price).toBe(3200);
    expect(blackItem!.primaryMediaUrl).toBe("https://example.com/media/black-front.jpg");

    const whiteItem = catalog.items.find((i) => i.variantId === whiteVar.id);
    expect(whiteItem).toBeDefined();
    expect(whiteItem!.isStandaloneVariant).toBe(true);
    expect(whiteItem!.title).toBe("Crisp White Essential Tee");
    expect(whiteItem!.primaryMediaUrl).toBe("https://example.com/media/white-front.jpg");

    const parentItem = catalog.items.find((i) => i.variantId === null);
    expect(parentItem).toBeDefined();
    expect(parentItem!.isStandaloneVariant).toBe(false);
    expect(parentItem!.title).toBe("Essential Crewneck Tee");

    // Search query matching standalone display titles
    const searchBlack = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Midnight",
    });
    expect(searchBlack.items).toHaveLength(1);
    expect(searchBlack.items[0]?.variantId).toBe(blackVar.id);

    const searchWhite = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Crisp",
    });
    expect(searchWhite.items).toHaveLength(1);
    expect(searchWhite.items[0]?.variantId).toBe(whiteVar.id);

    // Step 6 & 7 & 8: Verify Deduplication when ALL variants are published as standalone
    // Update Blue variant to publishedAsProduct: true
    await productService.updateVariant(db, store.id, created.id, blueVar.id, {
      publishedAsProduct: true,
      displayTitle: "Ocean Blue Essential Tee",
    });

    const catalogAllStandalone = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
    });

    // Parent product card is omitted since 100% of active variants are standalone
    expect(catalogAllStandalone.items).toHaveLength(3);
    expect(catalogAllStandalone.items.every((i) => i.isStandaloneVariant)).toBe(true);
    expect(catalogAllStandalone.items.find((i) => i.variantId === null)).toBeUndefined();

    // Step 9: Adding standalone variant to cart records correct productId, variantId, price, stock
    const cart = await cartService.createCart(db, store.id, {});
    const updatedCart = await cartService.addItem(db, store.id, cart.id, {
      variantId: blackVar.id,
      quantity: 2,
    });

    expect(updatedCart.items).toHaveLength(1);
    const cartItem = updatedCart.items[0]!;
    expect(cartItem.variantId).toBe(blackVar.id);
    expect(cartItem.unitPrice).toBe(3200);
    expect(cartItem.lineSubtotal).toBe(6400);

    // Step 10: Unpublishing White variant removes it from standalone listings
    await productService.updateVariant(db, store.id, created.id, whiteVar.id, {
      publishedAsProduct: false,
    });

    const catalogAfterUnpublish = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
    });

    // White should no longer be a standalone item
    expect(catalogAfterUnpublish.items.find((i) => i.variantId === whiteVar.id)).toBeUndefined();
    // But parent item now reappears because White is non-standalone
    expect(catalogAfterUnpublish.items.find((i) => i.variantId === null)).toBeDefined();

    // In full product fetch, White variant is still present for variant switching
    const refreshedProduct = await productService.getProductById(db, store.id, created.id);
    expect(refreshedProduct!.variants.find((v) => v.id === whiteVar.id)).toBeDefined();

    // Step 11: Unpublished (DRAFT / ARCHIVED) parent product prevents standalone variants from appearing
    await productService.updateProduct(db, store.id, created.id, {
      status: "DRAFT",
    });

    const draftCatalog = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
    });

    // None should appear for active customer storefront
    expect(draftCatalog.items).toHaveLength(0);

    // Step 12: Backward compatibility - standard product without variant titles or custom images
    const legacyProduct = await productService.createProduct(db, store.id, {
      title: "Classic Canvas Sneakers",
      slug: "classic-canvas-sneakers",
      status: "ACTIVE",
      price: 5500,
      sku: "SNK-001",
    });

    const legacyCatalog = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
    });

    expect(legacyCatalog.items).toHaveLength(1);
    expect(legacyCatalog.items[0]?.id).toBe(legacyProduct.id);
    expect(legacyCatalog.items[0]?.variantId).toBeNull();
    expect(legacyCatalog.items[0]?.isStandaloneVariant).toBe(false);
    expect(legacyCatalog.items[0]?.title).toBe("Classic Canvas Sneakers");
  });
});
