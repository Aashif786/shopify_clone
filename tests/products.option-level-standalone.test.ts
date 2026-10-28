import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import { ProductService } from "@shopify-clone/products";
import { CartService } from "@shopify-clone/carts";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Option-Level Standalone Publishing and Variant-Specific Titles & Images", { timeout: 45_000 }, () => {
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
      name: "Cal Cart Apparel",
      slug: `apparel-${userId.slice(0, 8)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    return { store, userId };
  }

  it("verifies 13-scenario specification for option-level standalone publishing and media", async () => {
    const db = await setupDb();
    const { store } = await createTestStore(db);

    // Prepare 6 media items
    const mediaUrls = [
      { url: "https://example.com/media/blue-front.jpg", altText: "Blue Tee Front", position: 0 },
      { url: "https://example.com/media/blue-back.jpg", altText: "Blue Tee Back", position: 1 },
      { url: "https://example.com/media/black-front.jpg", altText: "Black Tee Front", position: 2 },
      { url: "https://example.com/media/black-back.jpg", altText: "Black Tee Back", position: 3 },
      { url: "https://example.com/media/red-front.jpg", altText: "Red Tee Front", position: 4 },
      { url: "https://example.com/media/general-lifestyle.jpg", altText: "General Lifestyle", position: 5 },
    ];

    // Scenario 1: Configure Color as publishable and Size as non-publishable
    // Scenario 2 & 3: Titles and image assignment appear at Color value scope (Blue, Black, Red), not per-combination
    // 3 colors * 3 sizes = 9 variants generated in matrix
    const created = await productService.createProduct(db, store.id, {
      title: "Spider-Man Graphic Tee",
      description: "Official Marvel comic vintage t-shirt.",
      slug: "spider-man-graphic-tee",
      status: "ACTIVE",
      media: mediaUrls,
      options: [
        {
          name: "Color",
          position: 0,
          values: ["Blue", "Black", "Red"],
          isPublishable: true,
          optionValues: [
            {
              value: "Blue",
              displayTitle: "Blue Spider-Man T-shirt",
              isPublished: true,
              mediaIndexes: [0, 1], // blue front, blue back
            },
            {
              value: "Black",
              displayTitle: "Black Spider-Man T-shirt",
              isPublished: true,
              mediaIndexes: [2, 3], // black front, black back
            },
            {
              value: "Red",
              displayTitle: "Red Spider-Man T-shirt",
              isPublished: false, // Scenario 4 & 10: Red is unpublished as standalone listing
              mediaIndexes: [4],
            },
          ],
        },
        {
          name: "Size",
          position: 1,
          values: ["S", "M", "L"],
          isPublishable: false, // Size is NOT publishable
        },
      ],
      // 9 generated combinations in the variant matrix
      variants: [
        { option1: "Blue", option2: "S", title: "Blue / S", price: 3000, sku: "TEE-BLU-S", inventoryQuantity: 15 },
        { option1: "Blue", option2: "M", title: "Blue / M", price: 3000, sku: "TEE-BLU-M", inventoryQuantity: 20 },
        { option1: "Blue", option2: "L", title: "Blue / L", price: 3200, sku: "TEE-BLU-L", inventoryQuantity: 10 },
        { option1: "Black", option2: "S", title: "Black / S", price: 3200, sku: "TEE-BLK-S", inventoryQuantity: 25 },
        { option1: "Black", option2: "M", title: "Black / M", price: 3200, sku: "TEE-BLK-M", inventoryQuantity: 30 },
        { option1: "Black", option2: "L", title: "Black / L", price: 3400, sku: "TEE-BLK-L", inventoryQuantity: 12 },
        { option1: "Red", option2: "S", title: "Red / S", price: 2800, sku: "TEE-RED-S", inventoryQuantity: 10 },
        { option1: "Red", option2: "M", title: "Red / M", price: 2800, sku: "TEE-RED-M", inventoryQuantity: 15 },
        { option1: "Red", option2: "L", title: "Red / L", price: 3000, sku: "TEE-RED-L", inventoryQuantity: 8 },
      ],
    });

    expect(created.id).toBeDefined();
    expect(created.variants).toHaveLength(9);
    expect(created.options).toHaveLength(2);

    const colorOpt = created.options!.find((o) => o.name === "Color")!;
    expect(colorOpt.isPublishable).toBe(true);
    expect(colorOpt.optionValues).toHaveLength(3);

    const sizeOpt = created.options!.find((o) => o.name === "Size")!;
    expect(sizeOpt.isPublishable).toBe(false);

    // Verify option values persistence
    const blueVal = colorOpt.optionValues!.find((v) => v.value === "Blue")!;
    expect(blueVal.displayTitle).toBe("Blue Spider-Man T-shirt");
    expect(blueVal.isPublished).toBe(true);
    expect(blueVal.mediaIds).toHaveLength(2);

    const blackVal = colorOpt.optionValues!.find((v) => v.value === "Black")!;
    expect(blackVal.displayTitle).toBe("Black Spider-Man T-shirt");
    expect(blackVal.isPublished).toBe(true);
    expect(blackVal.mediaIds).toHaveLength(2);

    const redVal = colorOpt.optionValues!.find((v) => v.value === "Red")!;
    expect(redVal.displayTitle).toBe("Red Spider-Man T-shirt");
    expect(redVal.isPublished).toBe(false);

    // Scenario 4: Storefront catalog with standalone listings
    // Blue and Black are published standalone. Red is unpublished standalone.
    // Result: Blue card, Black card, PLUS parent card (because Red variants are uncovered).
    const catalog = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
    });

    expect(catalog.items).toHaveLength(3);

    const blueListing = catalog.items.find((i) => i.title === "Blue Spider-Man T-shirt");
    expect(blueListing).toBeDefined();
    expect(blueListing!.isStandaloneVariant).toBe(true);
    expect(blueListing!.primaryMediaUrl).toBe("https://example.com/media/blue-front.jpg");
    expect(blueListing!.price).toBe(3000);

    const blackListing = catalog.items.find((i) => i.title === "Black Spider-Man T-shirt");
    expect(blackListing).toBeDefined();
    expect(blackListing!.isStandaloneVariant).toBe(true);
    expect(blackListing!.primaryMediaUrl).toBe("https://example.com/media/black-front.jpg");
    expect(blackListing!.price).toBe(3200);

    // Parent product card is present because Red is NOT published standalone
    const parentListing = catalog.items.find((i) => i.variantId === null);
    expect(parentListing).toBeDefined();
    expect(parentListing!.title).toBe("Spider-Man Graphic Tee");

    // Search query matching standalone display titles
    const searchResult = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Black Spider-Man",
    });
    expect(searchResult.items).toHaveLength(1);
    expect(searchResult.items[0]?.title).toBe("Black Spider-Man T-shirt");

    // Scenario 5, 6, 7 & 13: Product detail view resolution and cart integrity
    // Detail fetch provides full option and variant structure
    const productDetail = await productService.getProductById(db, store.id, created.id);
    expect(productDetail).not.toBeNull();

    // Opening Blue listing resolves to Blue representative variant
    const blueRepVariant = productDetail!.variants.find((v) => v.id === blueListing!.variantId)!;
    expect(blueRepVariant).toBeDefined();
    expect(blueRepVariant.option1).toBe("Blue");

    // Adding Blue/L to cart verifies size option selection and inventory accuracy
    const blueLVariant = productDetail!.variants.find(
      (v) => v.option1 === "Blue" && v.option2 === "L"
    )!;
    expect(blueLVariant).toBeDefined();
    expect(blueLVariant.price).toBe(3200);
    expect(blueLVariant.sku).toBe("TEE-BLU-L");

    const cart = await cartService.createCart(db, store.id, {});
    const updatedCart = await cartService.addItem(db, store.id, cart.id, {
      variantId: blueLVariant.id,
      quantity: 3,
    });

    expect(updatedCart.items).toHaveLength(1);
    expect(updatedCart.items[0]?.variantId).toBe(blueLVariant.id);
    expect(updatedCart.items[0]?.unitPrice).toBe(3200);
    expect(updatedCart.items[0]?.lineSubtotal).toBe(9600);

    // Scenario 8 & 9: Dual Publishable Options (Color and Fabric)
    // Add Fabric option: Color (3) + Fabric (2: Cotton, Polyester) + Size (3) = 18 Cartesian variants
    // The listing model produces 3 (Color) + 2 (Fabric) = 5 listings. NOT 18!
    const dualOptionProduct = await productService.createProduct(db, store.id, {
      title: "Performance Tech Polo",
      slug: "performance-tech-polo",
      status: "ACTIVE",
      options: [
        {
          name: "Color",
          position: 0,
          values: ["Navy", "Olive"],
          isPublishable: true,
          optionValues: [
            { value: "Navy", displayTitle: "Navy Tech Polo", isPublished: true },
            { value: "Olive", displayTitle: "Olive Tech Polo", isPublished: true },
          ],
        },
        {
          name: "Fabric",
          position: 1,
          values: ["Pique", "Jersey"],
          isPublishable: true,
          optionValues: [
            { value: "Pique", displayTitle: "Breathable Pique Polo", isPublished: true },
            { value: "Jersey", displayTitle: "Ultra-Soft Jersey Polo", isPublished: true },
          ],
        },
        {
          name: "Size",
          position: 2,
          values: ["M", "L"],
          isPublishable: false, // Size is non-publishable
        },
      ],
      // 2 colors * 2 fabrics * 2 sizes = 8 combinations
      variants: [
        { option1: "Navy", option2: "Pique", option3: "M", title: "Navy / Pique / M", price: 4500, sku: "POLO-N-P-M" },
        { option1: "Navy", option2: "Pique", option3: "L", title: "Navy / Pique / L", price: 4500, sku: "POLO-N-P-L" },
        { option1: "Navy", option2: "Jersey", option3: "M", title: "Navy / Jersey / M", price: 4800, sku: "POLO-N-J-M" },
        { option1: "Navy", option2: "Jersey", option3: "L", title: "Navy / Jersey / L", price: 4800, sku: "POLO-N-J-L" },
        { option1: "Olive", option2: "Pique", option3: "M", title: "Olive / Pique / M", price: 4500, sku: "POLO-O-P-M" },
        { option1: "Olive", option2: "Pique", option3: "L", title: "Olive / Pique / L", price: 4500, sku: "POLO-O-P-L" },
        { option1: "Olive", option2: "Jersey", option3: "M", title: "Olive / Jersey / M", price: 4800, sku: "POLO-O-J-M" },
        { option1: "Olive", option2: "Jersey", option3: "L", title: "Olive / Jersey / L", price: 4800, sku: "POLO-O-J-L" },
      ],
    });

    const dualCatalog = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Polo",
    });

    // Exactly 2 (Color: Navy, Olive) + 2 (Fabric: Pique, Jersey) = 4 standalone listings!
    // No Cartesian explosion of 8 separate listings!
    expect(dualCatalog.items).toHaveLength(4);
    const titles = dualCatalog.items.map((i) => i.title);
    expect(titles).toContain("Navy Tech Polo");
    expect(titles).toContain("Olive Tech Polo");
    expect(titles).toContain("Breathable Pique Polo");
    expect(titles).toContain("Ultra-Soft Jersey Polo");

    // Scenario 11 & 10: Toggle option publishable setting safely preserves data
    // Update dualOptionProduct so Fabric is NO LONGER publishable
    const updatedDual = await productService.updateProduct(db, store.id, dualOptionProduct.id, {
      options: [
        {
          name: "Color",
          position: 0,
          values: ["Navy", "Olive"],
          isPublishable: true,
        },
        {
          name: "Fabric",
          position: 1,
          values: ["Pique", "Jersey"],
          isPublishable: false, // Toggled off!
        },
        {
          name: "Size",
          position: 2,
          values: ["M", "L"],
          isPublishable: false,
        },
      ],
    });

    expect(updatedDual.options?.find((o) => o.name === "Fabric")?.isPublishable).toBe(false);

    // In catalog: now only Navy and Olive appear as standalone listings!
    const catalogAfterToggle = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Polo",
    });
    expect(catalogAfterToggle.items).toHaveLength(2);
    expect(catalogAfterToggle.items.map((i) => i.title)).toEqual(
      expect.arrayContaining(["Navy Tech Polo", "Olive Tech Polo"])
    );

    // Scenario 12: Backward compatibility for standard products without publishable options
    const standardProduct = await productService.createProduct(db, store.id, {
      title: "Leather Heritage Belt",
      slug: "leather-heritage-belt",
      status: "ACTIVE",
      price: 6000,
      sku: "BELT-001",
    });

    const standardCatalog = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Belt",
    });

    expect(standardCatalog.items).toHaveLength(1);
    expect(standardCatalog.items[0]?.id).toBe(standardProduct.id);
    expect(standardCatalog.items[0]?.variantId).toBeNull();
    expect(standardCatalog.items[0]?.isStandaloneVariant).toBe(false);
    expect(standardCatalog.items[0]?.title).toBe("Leather Heritage Belt");
  });

  it("verifies multi-non-publishable option resolution, cart variant accuracy, and edit persistence", async () => {
    const db = await setupDb();
    const { store } = await createTestStore(db);

    // 1. Create product with:
    // Model: Black, Blue, Red (publishable)
    // Size: S, M, L (non-publishable)
    // Fabric: Cotton, Polyester (non-publishable)
    // 3 x 3 x 2 = 18 Cartesian variants
    const models = ["Black", "Blue", "Red"];
    const sizes = ["S", "M", "L"];
    const fabrics = ["Cotton", "Polyester"];

    const variantsPayload: Array<{
      title: string;
      option1: string;
      option2: string;
      option3: string;
      price: number;
      sku: string;
      inventoryQuantity: number;
    }> = [];

    let basePrice = 3000;
    for (const m of models) {
      for (const s of sizes) {
        for (const f of fabrics) {
          variantsPayload.push({
            title: `${m} / ${s} / ${f}`,
            option1: m,
            option2: s,
            option3: f,
            price: basePrice + (s === "L" ? 200 : 0) + (f === "Polyester" ? 300 : 0),
            sku: `TEE-${m.slice(0, 3).toUpperCase()}-${s}-${f.slice(0, 3).toUpperCase()}`,
            inventoryQuantity: 20,
          });
        }
      }
    }

    const created = await productService.createProduct(db, store.id, {
      title: "Signature Heavyweight Tee",
      slug: "signature-heavyweight-tee",
      status: "ACTIVE",
      options: [
        {
          name: "Model",
          position: 0,
          values: models,
          isPublishable: true,
          optionValues: [
            { value: "Black", displayTitle: "Signature Tee - Pitch Black", isPublished: true },
            { value: "Blue", displayTitle: "Signature Tee - Cobalt Blue", isPublished: true },
            { value: "Red", displayTitle: "Signature Tee - Crimson Red", isPublished: true },
          ],
        },
        {
          name: "Size",
          position: 1,
          values: sizes,
          isPublishable: false,
        },
        {
          name: "Fabric",
          position: 2,
          values: fabrics,
          isPublishable: false,
        },
      ],
      variants: variantsPayload,
    });

    expect(created.id).toBeDefined();
    expect(created.variants).toHaveLength(18);

    // 2. Query storefront catalog: exactly 3 standalone listings, NO cartesian explosion, NO parent duplication
    const catalog = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Signature",
    });

    expect(catalog.items).toHaveLength(3);
    const catalogTitles = catalog.items.map((i) => i.title);
    expect(catalogTitles).toContain("Signature Tee - Pitch Black");
    expect(catalogTitles).toContain("Signature Tee - Cobalt Blue");
    expect(catalogTitles).toContain("Signature Tee - Crimson Red");

    // 3. Verify each standalone listing resolves to representative variant with correct Model
    const redListing = catalog.items.find((i) => i.title === "Signature Tee - Crimson Red")!;
    expect(redListing).toBeDefined();
    expect(redListing.variantId).toBeDefined();

    const productDetail = await productService.getProductById(db, store.id, created.id);
    const redRepVariant = productDetail!.variants.find((v) => v.id === redListing.variantId)!;
    expect(redRepVariant.option1).toBe("Red");

    // 4. Resolve exact combination Red / L / Polyester
    const redLPolyVariant = productDetail!.variants.find(
      (v) => v.option1 === "Red" && v.option2 === "L" && v.option3 === "Polyester"
    )!;
    expect(redLPolyVariant).toBeDefined();
    expect(redLPolyVariant.sku).toBe("TEE-RED-L-POL");
    expect(redLPolyVariant.price).toBe(3500); // 3000 + 200 (L) + 300 (Poly)

    // 5. Add Red / L / Polyester to cart
    const cart = await cartService.createCart(db, store.id, {});
    const cart1 = await cartService.addItem(db, store.id, cart.id, {
      variantId: redLPolyVariant.id,
      quantity: 2,
    });
    expect(cart1.items).toHaveLength(1);
    expect(cart1.items[0]?.variantId).toBe(redLPolyVariant.id);
    expect(cart1.items[0]?.unitPrice).toBe(3500);
    expect(cart1.items[0]?.lineSubtotal).toBe(7000);

    // 6. Add Blue / M / Cotton to same cart
    const blueMCottonVariant = productDetail!.variants.find(
      (v) => v.option1 === "Blue" && v.option2 === "M" && v.option3 === "Cotton"
    )!;
    expect(blueMCottonVariant).toBeDefined();
    expect(blueMCottonVariant.sku).toBe("TEE-BLU-M-COT");
    expect(blueMCottonVariant.price).toBe(3000);

    const cart2 = await cartService.addItem(db, store.id, cart.id, {
      variantId: blueMCottonVariant.id,
      quantity: 1,
    });
    expect(cart2.items).toHaveLength(2);
    expect(cart2.items[1]?.variantId).toBe(blueMCottonVariant.id);
    expect(cart2.items[1]?.unitPrice).toBe(3000);
    expect(cart2.subtotal).toBe(10000); // 7000 + 3000

    // 7. Edit/reload persistence: Update product title and verify publishable options persist
    const updated = await productService.updateProduct(db, store.id, created.id, {
      title: "Signature Heavyweight Tee v2",
      options: [
        {
          name: "Model",
          position: 0,
          values: models,
          isPublishable: true,
          optionValues: [
            { value: "Black", displayTitle: "Signature Tee - Pitch Black Updated", isPublished: true },
            { value: "Blue", displayTitle: "Signature Tee - Cobalt Blue Updated", isPublished: true },
            { value: "Red", displayTitle: "Signature Tee - Crimson Red", isPublished: false }, // Unpublish Red
          ],
        },
        {
          name: "Size",
          position: 1,
          values: sizes,
          isPublishable: false,
        },
        {
          name: "Fabric",
          position: 2,
          values: fabrics,
          isPublishable: false,
        },
      ],
    });

    const refetched = await productService.getProductById(db, store.id, created.id);
    const modelOpt = refetched!.options.find((o) => o.name === "Model")!;
    expect(modelOpt.isPublishable).toBe(true);
    expect(modelOpt.optionValues).toHaveLength(3);

    const blackVal = modelOpt.optionValues!.find((ov) => ov.value === "Black")!;
    expect(blackVal.displayTitle).toBe("Signature Tee - Pitch Black Updated");
    expect(blackVal.isPublished).toBe(true);

    const redVal = modelOpt.optionValues!.find((ov) => ov.value === "Red")!;
    expect(redVal.isPublished).toBe(false);

    // 8. Catalog after Red is unpublished:
    // Black card + Blue card + Parent card (representing uncovered Red variants)
    const catalogAfterEdit = await productService.listProducts(db, store.id, {
      includeStandaloneVariants: true,
      status: "ACTIVE",
      search: "Signature",
    });

    expect(catalogAfterEdit.items).toHaveLength(3);
    const afterTitles = catalogAfterEdit.items.map((i) => i.title);
    expect(afterTitles).toContain("Signature Tee - Pitch Black Updated");
    expect(afterTitles).toContain("Signature Tee - Cobalt Blue Updated");
    expect(afterTitles).toContain("Signature Heavyweight Tee v2"); // Parent product card present for Red!
  });
});
