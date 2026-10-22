import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import { ProductService } from "@shopify-clone/products";
import {
  InventoryService,
  InsufficientStockError,
  CrossStoreInventoryAccessError,
} from "@shopify-clone/inventory";
import {
  CartService,
  InsufficientCartStockError,
  CartItemQuantityExceedsLimitError,
  CrossStoreVariantError,
} from "@shopify-clone/carts";
import {
  CheckoutService,
  InsufficientStockError as CheckoutInsufficientStockError,
  QuantityLimitExceededError,
} from "@shopify-clone/checkout";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import { GET as getStorefrontProductDetail } from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Inventory Availability, Low-Stock Indicators & Purchase Limits Integration", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const productService = new ProductService();
  const inventoryService = new InventoryService();
  const cartService = new CartService();
  const checkoutService = new CheckoutService();

  let storeA: { id: string; slug: string };
  let storeB: { id: string; slug: string };

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;

    // Create Store A
    const userAId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner A', 'scrypt:hash', 'ACTIVE')`,
      [userAId, `owner-a-${Date.now()}@test.local`],
    );
    const sA = await storeService.createStore(db, userAId, {
      name: "Artisan Roasters",
      slug: `artisan-roasters-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sA.id, userAId);
    storeA = { id: sA.id, slug: sA.slug };

    // Create Store B
    const userBId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner B', 'scrypt:hash', 'ACTIVE')`,
      [userBId, `owner-b-${Date.now()}@test.local`],
    );
    const sB = await storeService.createStore(db, userBId, {
      name: "Competitor Market",
      slug: `competitor-market-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sB.id, userBId);
    storeB = { id: sB.id, slug: sB.slug };
  });

  afterAll(async () => {
    if (close) {
      await close();
    }
  });

  async function createProductWithInventory(
    storeId: string,
    options: {
      title: string;
      slug: string;
      price?: number;
      stock?: number;
      lowStockThreshold?: number;
      maxOrderQuantity?: number | null;
      variants?: Array<{
        title: string;
        sku?: string;
        price?: number;
        stock?: number;
        lowStockThreshold?: number | null;
        maxOrderQuantity?: number | null;
      }>;
    },
  ) {
    const product = await productService.createProduct(db, storeId, {
      title: options.title,
      slug: options.slug,
      status: "ACTIVE",
      price: options.price ?? 2000,
      lowStockThreshold: options.lowStockThreshold ?? 5,
      maxOrderQuantity: options.maxOrderQuantity ?? null,
      variants: options.variants?.map((v) => ({
        title: v.title,
        sku: v.sku ?? `SKU-${generateUuidV7()}`,
        price: v.price ?? options.price ?? 2000,
        lowStockThreshold: v.lowStockThreshold,
        maxOrderQuantity: v.maxOrderQuantity,
      })),
    });

    // Initialize inventory for variants
    if (options.variants && options.variants.length > 0) {
      for (let i = 0; i < options.variants.length; i++) {
        const v = product.variants[i]!;
        const vStock = options.variants[i]!.stock ?? 0;
        if (vStock > 0) {
          await inventoryService.adjustStock(db, storeId, v.id, {
            quantityDelta: vStock,
            reason: "INITIAL_STOCK",
          });
        }
      }
    } else {
      const defaultVariant = product.variants[0]!;
      const stock = options.stock ?? 0;
      if (stock > 0) {
        await inventoryService.adjustStock(db, storeId, defaultVariant.id, {
          quantityDelta: stock,
          reason: "INITIAL_STOCK",
        });
      }
    }

    return await productService.getProductById(db, storeId, product.id);
  }

  // 1. Available stock calculation: Stock 10, reserved 5 -> Available is 5
  it("calculates available stock correctly when reservations exist (stock=10, reserved=5 -> available=5)", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Espresso Beans 500g",
      slug: `espresso-beans-${Date.now()}`,
      stock: 10,
    });
    const variantId = prod.variants[0]!.id;

    // Create reservation for 5 units
    const res = await inventoryService.reserve(db, storeA.id, {
      referenceType: "checkout",
      referenceId: generateUuidV7(),
      variantId,
      quantity: 5,
    });
    expect(res.status).toBe("ACTIVE");
    expect(res.quantity).toBe(5);

    // Verify availability
    const avail = await inventoryService.getAvailability(db, storeA.id, variantId);
    expect(avail.totalQuantity).toBe(10);
    expect(avail.reservedQuantity).toBe(5);
    expect(avail.availableQuantity).toBe(5);
    expect(avail.isAvailable).toBe(true);
  });

  // 2. Low-stock indicators: display 'Only 5 left' when available quantity is 5 and threshold is 5
  it("marks low stock when available quantity is less than or equal to low_stock_threshold", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Rare Geisha Roast",
      slug: `rare-geisha-${Date.now()}`,
      stock: 5,
      lowStockThreshold: 5,
    });

    // Check storefront detail endpoint
    const req = new Request(`https://test.local/api/v1/storefront/${storeA.slug}/products/${prod.slug}`);
    const res = await getStorefrontProductDetail(req, {
      params: Promise.resolve({ storeSlug: storeA.slug, productSlug: prod.slug }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const productData = body.data.product;

    expect(productData.inventory.isLowStock).toBe(true);
    expect(productData.inventory.isOutOfStock).toBe(false);
    expect(productData.inventory.totalAvailableQuantity).toBe(5);

    const variantInventory = productData.variants[0]!.inventory;
    expect(variantInventory.isLowStock).toBe(true);
    expect(variantInventory.isOutOfStock).toBe(false);
    expect(variantInventory.availableQuantity).toBe(5);
    expect(variantInventory.lowStockThreshold).toBe(5);
  });

  // 2b. Variant threshold override: variant with threshold 2 overrides product threshold 5
  it("honors variant-level low_stock_threshold override over product-level setting", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Batch Brew Varietals",
      slug: `batch-varietals-${Date.now()}`,
      lowStockThreshold: 5,
      variants: [
        { title: "Standard 250g", stock: 3, lowStockThreshold: null }, // Inherits 5 -> Low Stock
        { title: "Sample 50g", stock: 3, lowStockThreshold: 2 },       // Overrides with 2 -> In Stock (3 > 2)
      ],
    });

    const req = new Request(`https://test.local/api/v1/storefront/${storeA.slug}/products/${prod.slug}`);
    const res = await getStorefrontProductDetail(req, {
      params: Promise.resolve({ storeSlug: storeA.slug, productSlug: prod.slug }),
    });
    const body = await res.json();
    const variants = body.data.product.variants;

    // Standard variant: stock 3, threshold 5 => isLowStock = true
    expect(variants[0].inventory.availableQuantity).toBe(3);
    expect(variants[0].inventory.lowStockThreshold).toBe(5);
    expect(variants[0].inventory.isLowStock).toBe(true);

    // Sample variant: stock 3, threshold 2 => isLowStock = false
    expect(variants[1].inventory.availableQuantity).toBe(3);
    expect(variants[1].inventory.lowStockThreshold).toBe(2);
    expect(variants[1].inventory.isLowStock).toBe(false);
  });

  // 3. Available stock 1: allow quantity 1, reject quantity 2 on add to cart
  it("allows quantity 1 but rejects quantity 2 on add to cart when available stock is 1", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Last Coffee Cup",
      slug: `last-coffee-cup-${Date.now()}`,
      stock: 1,
    });
    const variantId = prod.variants[0]!.id;
    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });

    // Adding 1 unit succeeds
    const cartAfterAdd = await cartService.addItem(db, storeA.id, cart.id, {
      variantId,
      quantity: 1,
    });
    const item = cartAfterAdd.items.find((i) => i.variantId === variantId);
    expect(item?.quantity).toBe(1);

    // Creating another cart and attempting to add 2 units fails
    const cart2 = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });
    await expect(
      cartService.addItem(db, storeA.id, cart2.id, { variantId, quantity: 2 }),
    ).rejects.toThrow(InsufficientCartStockError);
  });

  // 4. Available stock 0: show out of stock and reject adding to cart
  it("rejects adding to cart when available stock is 0 and marks as out of stock", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Sold Out Mug",
      slug: `sold-out-mug-${Date.now()}`,
      stock: 0,
    });
    const variantId = prod.variants[0]!.id;
    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });

    await expect(
      cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 1 }),
    ).rejects.toThrow(InsufficientCartStockError);

    // Verify storefront API marks out of stock
    const req = new Request(`https://test.local/api/v1/storefront/${storeA.slug}/products/${prod.slug}`);
    const res = await getStorefrontProductDetail(req, {
      params: Promise.resolve({ storeSlug: storeA.slug, productSlug: prod.slug }),
    });
    const body = await res.json();
    const productData = body.data.product;
    expect(productData.inventory.isOutOfStock).toBe(true);
    expect(productData.inventory.totalAvailableQuantity).toBe(0);
    expect(productData.variants[0].inventory.isOutOfStock).toBe(true);
    expect(productData.variants[0].inventory.availableQuantity).toBe(0);
  });

  // 5. Available stock 20, max order quantity 5: reject quantity 6 with QUANTITY_LIMIT_EXCEEDED
  it("rejects quantity 6 when stock is 20 and max_order_quantity is 5", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Limited Cold Brew",
      slug: `limited-cold-brew-${Date.now()}`,
      stock: 20,
      maxOrderQuantity: 5,
    });
    const variantId = prod.variants[0]!.id;
    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });

    // Attempting to add 6 units fails with CartItemQuantityExceedsLimitError
    await expect(
      cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 6 }),
    ).rejects.toThrow(CartItemQuantityExceedsLimitError);

    // Adding 5 units succeeds
    const cartAfterAdd = await cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 5 });
    const item = cartAfterAdd.items.find((i) => i.variantId === variantId);
    expect(item?.quantity).toBe(5);
  });

  // 6. Available stock 3, max order quantity 5: permits at most 3, rejects 4
  it("permits at most available stock when available stock (3) is less than max order limit (5)", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Scare Beans",
      slug: `scarce-beans-${Date.now()}`,
      stock: 3,
      maxOrderQuantity: 5,
    });
    const variantId = prod.variants[0]!.id;
    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });

    // Effective maximum is min(3, 5) = 3
    await expect(
      cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 4 }),
    ).rejects.toThrow(InsufficientCartStockError);

    // Adding 3 succeeds
    const cartAfterAdd = await cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 3 });
    const item = cartAfterAdd.items.find((i) => i.variantId === variantId);
    expect(item?.quantity).toBe(3);
  });

  // 7. Aggregated check across repeated cart additions: prevent bypassing limit via line splitting
  it("enforces aggregated limit across repeated cart additions for the same variant", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Single Origin Yirgacheffe",
      slug: `yirgacheffe-${Date.now()}`,
      stock: 20,
      maxOrderQuantity: 5,
    });
    const variantId = prod.variants[0]!.id;
    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });

    // First addition: add 3
    await cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 3 });

    // Second addition: adding 3 more would bring total to 6 > 5 => Reject
    await expect(
      cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 3 }),
    ).rejects.toThrow(CartItemQuantityExceedsLimitError);

    // Second addition: adding 2 brings total to 5 => Succeeded
    const updated = await cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 2 });
    const item = updated.items.find((i) => i.variantId === variantId);
    expect(item?.quantity).toBe(5);
  });

  // 8. Cart item update beyond available stock or max order limit is rejected
  it("rejects updating cart item quantity beyond available stock or max order quantity", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Pour Over Dripper",
      slug: `dripper-${Date.now()}`,
      stock: 10,
      maxOrderQuantity: 4,
    });
    const variantId = prod.variants[0]!.id;
    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });

    const cartAfterAdd = await cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 2 });
    const item = cartAfterAdd.items.find((i) => i.variantId === variantId)!;
    expect(item.quantity).toBe(2);

    // Updating beyond max order quantity (5 > 4) fails
    await expect(
      cartService.updateItemQuantity(db, storeA.id, cart.id, item.id, 5),
    ).rejects.toThrow(CartItemQuantityExceedsLimitError);

    // Updating to valid quantity (4) succeeds
    const updated = await cartService.updateItemQuantity(db, storeA.id, cart.id, item.id, 4);
    const updatedItem = updated.items.find((i) => i.variantId === variantId)!;
    expect(updatedItem.quantity).toBe(4);
  });

  // 9. Stock decrease between add to cart and checkout: createCheckoutFromCart revalidates and fails
  it("revalidates stock at checkout creation and rejects if stock decreased while item was in cart", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Handmade Ceramic Cup",
      slug: `ceramic-cup-${Date.now()}`,
      stock: 5,
    });
    const variantId = prod.variants[0]!.id;

    // Customer adds 4 units to cart
    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });
    await cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 4 });

    // Stock suddenly decreases to 2 (e.g. stock adjustment or external sale)
    await inventoryService.adjustStock(db, storeA.id, variantId, {
      quantityDelta: -3,
      reason: "DAMAGED",
    });

    // Checkout creation must detect the shortfall and reject
    await expect(
      checkoutService.createCheckoutFromCart(db, storeA.id, cart.id, {
        email: "shopper@example.com",
      }),
    ).rejects.toThrow(CheckoutInsufficientStockError);
  });

  // 9b. Max order quantity reduction between add to cart and checkout
  it("revalidates max order quantity at checkout creation and rejects if limit was lowered", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Aeropress Filters Pack",
      slug: `aeropress-filters-${Date.now()}`,
      stock: 20,
      maxOrderQuantity: 10,
    });
    const variantId = prod.variants[0]!.id;

    const cart = await cartService.createCart(db, storeA.id, { guestIdentifier: generateUuidV7() });
    await cartService.addItem(db, storeA.id, cart.id, { variantId, quantity: 8 });

    // Merchant lowers product max order quantity to 5
    await productService.updateProduct(db, storeA.id, prod.id, {
      maxOrderQuantity: 5,
    });

    // Checkout creation must reject with QuantityLimitExceededError
    await expect(
      checkoutService.createCheckoutFromCart(db, storeA.id, cart.id, {
        email: "filter-lover@example.com",
      }),
    ).rejects.toThrow(QuantityLimitExceededError);
  });

  // 10. Concurrent checkout reservations competing for final stock: PostgreSQL FOR UPDATE prevents overselling
  it("prevents overselling under concurrent checkout reservations using PostgreSQL row locking", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Antique Grinder",
      slug: `antique-grinder-${Date.now()}`,
      stock: 3,
    });
    const variantId = prod.variants[0]!.id;

    // Two users simultaneously attempt to reserve 3 units each
    const attempt1 = inventoryService.reserve(db, storeA.id, {
      referenceType: "checkout",
      referenceId: generateUuidV7(),
      variantId,
      quantity: 3,
    });
    const attempt2 = inventoryService.reserve(db, storeA.id, {
      referenceType: "checkout",
      referenceId: generateUuidV7(),
      variantId,
      quantity: 3,
    });

    const results = await Promise.allSettled([attempt1, attempt2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly 1 must succeed and 1 must fail with InsufficientStockError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    // Verify remaining available stock is 0 and reserved is 3
    const avail = await inventoryService.getAvailability(db, storeA.id, variantId);
    expect(avail.availableQuantity).toBe(0);
    expect(avail.reservedQuantity).toBe(3);
    expect(avail.totalQuantity).toBe(3);
  });

  // 11. Reservation expiry, release, and successful finalization
  it("correctly handles reservation release and finalization lifecycle", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "French Press 1L",
      slug: `french-press-${Date.now()}`,
      stock: 10,
    });
    const variantId = prod.variants[0]!.id;

    // 1. Reserve 4 units
    const res = await inventoryService.reserve(db, storeA.id, {
      referenceType: "checkout",
      referenceId: generateUuidV7(),
      variantId,
      quantity: 4,
    });
    let avail = await inventoryService.getAvailability(db, storeA.id, variantId);
    expect(avail.availableQuantity).toBe(6);
    expect(avail.reservedQuantity).toBe(4);

    // 2. Release reservation (e.g. checkout abandoned or expired)
    await inventoryService.releaseReservation(db, storeA.id, res.id);
    avail = await inventoryService.getAvailability(db, storeA.id, variantId);
    expect(avail.availableQuantity).toBe(10);
    expect(avail.reservedQuantity).toBe(0);

    // 3. New reservation of 3 units
    const res2 = await inventoryService.reserve(db, storeA.id, {
      referenceType: "checkout",
      referenceId: generateUuidV7(),
      variantId,
      quantity: 3,
    });
    avail = await inventoryService.getAvailability(db, storeA.id, variantId);
    expect(avail.availableQuantity).toBe(7);
    expect(avail.reservedQuantity).toBe(3);

    // 4. Finalize reservation (order placed and payment confirmed)
    await inventoryService.finalizeReservation(db, storeA.id, res2.id);
    avail = await inventoryService.getAvailability(db, storeA.id, variantId);
    expect(avail.availableQuantity).toBe(7);
    expect(avail.reservedQuantity).toBe(0);
    expect(avail.totalQuantity).toBe(7);
  });

  // 12. Multi-tenant isolation: Store B cannot read, alter, or checkout Store A's inventory
  it("strictly isolates inventory and catalog across tenants", async () => {
    const prodA = await createProductWithInventory(storeA.id, {
      title: "Store A Exclusive Roast",
      slug: `exclusive-a-${Date.now()}`,
      stock: 10,
      maxOrderQuantity: 5,
    });
    const variantAId = prodA.variants[0]!.id;

    // Store B tries to add Store A variant to Store B cart
    const cartB = await cartService.createCart(db, storeB.id, { guestIdentifier: generateUuidV7() });
    await expect(
      cartService.addItem(db, storeB.id, cartB.id, { variantId: variantAId, quantity: 1 }),
    ).rejects.toThrow(CrossStoreVariantError);

    // Store B tries to reserve Store A inventory
    await expect(
      inventoryService.reserve(db, storeB.id, {
        referenceType: "checkout",
        referenceId: generateUuidV7(),
        variantId: variantAId,
        quantity: 1,
      }),
    ).rejects.toThrow(CrossStoreInventoryAccessError);
  });

  // 13. Guest cart merge respects effective max quantity limit
  it("clamps merged quantities to effective maximum when merging guest cart into customer cart", async () => {
    const prod = await createProductWithInventory(storeA.id, {
      title: "Limited Cold Brew Concentrate",
      slug: `concentrate-${Date.now()}`,
      stock: 10,
      maxOrderQuantity: 4,
    });
    const variantId = prod.variants[0]!.id;

    // Create customer in Store A
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, status) VALUES ($1, $2, 'buyer@test.com', 'ACTIVE')`,
      [customerId, storeA.id],
    );

    // Customer cart already has 3 units
    const customerCart = await cartService.createCart(db, storeA.id, { customerId });
    await cartService.addItem(db, storeA.id, customerCart.id, { variantId, quantity: 3 });

    // Guest cart has 3 units
    const guestIdentifier = generateUuidV7();
    const guestCart = await cartService.createCart(db, storeA.id, { guestIdentifier });
    await cartService.addItem(db, storeA.id, guestCart.id, { variantId, quantity: 3 });

    // Merging guest cart into customer cart clamps to maxOrderQuantity (4)
    const merged = await cartService.mergeCart(db, storeA.id, guestIdentifier, customerId);
    const item = merged.items.find((i) => i.variantId === variantId);
    expect(item).toBeDefined();
    expect(item!.quantity).toBe(4); // Clamped from 3 + 3 = 6 down to limit 4
  });
});
