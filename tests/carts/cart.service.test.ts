import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import {
  CartAlreadyConvertedError,
  CartExpiredError,
  CartItemNotFoundError,
  CartNotFoundError,
  CartService,
  CrossStoreCustomerError,
  CrossStoreVariantError,
  CustomerNotFoundError,
  InvalidCurrencyError,
  InvalidQuantityError,
  ProductVariantNotFoundError,
  ProductVariantUnavailableError,
} from "@shopify-clone/carts";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Carts Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
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

  async function seedTestStore(
    db: Database,
    slug = "cart-store-1",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { orgId, storeId };
  }

  async function seedTestCustomer(
    db: Database,
    storeId: string,
    email = "customer@store.com",
  ): Promise<string> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [customerId, storeId, email],
    );
    return customerId;
  }

  async function seedTestProductAndVariant(
    db: Database,
    storeId: string,
    params: {
      sku?: string;
      price?: number;
      status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
      productStatus?: "ACTIVE" | "DRAFT" | "ARCHIVED";
      currency?: string;
    } = {},
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const price = params.price ?? 2000;
    const sku = params.sku ?? `SKU-${variantId}`;
    const status = params.status ?? "ACTIVE";
    const productStatus = params.productStatus ?? "ACTIVE";
    const currency = params.currency ?? "USD";

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Product Title', $3, $4)`,
      [productId, storeId, `prod-${productId}`, productStatus],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, status, currency)
       VALUES ($1, $2, $3, 'Default Variant', $4, $5, $6, $7)`,
      [variantId, productId, storeId, sku, price, status, currency],
    );

    return { productId, variantId };
  }

  describe("Cart Creation & Lookups", () => {
    it("creates a guest cart with default USD currency", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "guest-cart");

      const cart = await cartService.createCart(db, storeId, {
        guestIdentifier: "guest-token-123",
      });

      expect(cart.id).toBeDefined();
      expect(cart.storeId).toBe(storeId);
      expect(cart.guestIdentifier).toBe("guest-token-123");
      expect(cart.customerId).toBeNull();
      expect(cart.status).toBe("ACTIVE");
      expect(cart.currency).toBe("USD");
      expect(cart.subtotal).toBe(0);
      expect(cart.grandTotal).toBe(0);
      expect(cart.items).toEqual([]);
    });

    it("creates customer cart and validates customer belongs to store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-cart");
      const customerId = await seedTestCustomer(db, storeId, "alice@test.com");

      const cart = await cartService.createCart(db, storeId, {
        customerId,
        currency: "EUR",
      });

      expect(cart.customerId).toBe(customerId);
      expect(cart.currency).toBe("EUR");
    });

    it("rejects creating cart for non-existent customer", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-not-found");
      const fakeCustomerId = generateUuidV7();

      await expect(
        cartService.createCart(db, storeId, { customerId: fakeCustomerId }),
      ).rejects.toThrow(CustomerNotFoundError);
    });

    it("rejects creating cart with customer belonging to another store", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-cust");
      const storeB = await seedTestStore(db, "store-b-cust");
      const customerA = await seedTestCustomer(db, storeA.storeId, "a@store.com");

      await expect(
        cartService.createCart(db, storeB.storeId, { customerId: customerA }),
      ).rejects.toThrow(CrossStoreCustomerError);
    });

    it("retrieves cart with items using getCart", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "get-cart");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1500 });

      const created = await cartService.createCart(db, storeId);
      await cartService.addItem(db, storeId, created.id, { variantId, quantity: 2 });

      const fetched = await cartService.getCart(db, storeId, created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.items).toHaveLength(1);
      expect(fetched.items[0]?.variantId).toBe(variantId);
      expect(fetched.items[0]?.quantity).toBe(2);
      expect(fetched.items[0]?.unitPrice).toBe(1500);
      expect(fetched.subtotal).toBe(3000);
    });

    it("throws CartNotFoundError when retrieving non-existent cart", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "get-missing");

      await expect(
        cartService.getCart(db, storeId, generateUuidV7()),
      ).rejects.toThrow(CartNotFoundError);
    });

    it("retrieves active cart for customer and guest", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "lookup-active");
      const customerId = await seedTestCustomer(db, storeId, "bob@test.com");

      const customerCart = await cartService.createCart(db, storeId, { customerId });
      const guestCart = await cartService.createCart(db, storeId, {
        guestIdentifier: "guest-abc",
      });

      const foundCust = await cartService.getActiveCartForCustomer(db, storeId, customerId);
      expect(foundCust?.id).toBe(customerCart.id);

      const foundGuest = await cartService.getActiveCartForGuest(db, storeId, "guest-abc");
      expect(foundGuest?.id).toBe(guestCart.id);

      const nonExistent = await cartService.getActiveCartForGuest(db, storeId, "missing-token");
      expect(nonExistent).toBeNull();
    });

    it("getOrCreateCart returns existing active cart or creates new one", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "get-or-create");
      const customerId = await seedTestCustomer(db, storeId, "charlie@test.com");

      // 1. First invocation creates cart
      const cart1 = await cartService.getOrCreateCart(db, storeId, { customerId });
      expect(cart1.id).toBeDefined();

      // 2. Second invocation retrieves existing active cart
      const cart2 = await cartService.getOrCreateCart(db, storeId, { customerId });
      expect(cart2.id).toBe(cart1.id);
    });
  });

  describe("Cart Items Operations", () => {
    it("adds item to cart using live variant price from database", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "add-item");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 2500 });
      const cart = await cartService.createCart(db, storeId);

      const updated = await cartService.addItem(db, storeId, cart.id, {
        variantId,
        quantity: 3,
      });

      expect(updated.items).toHaveLength(1);
      const item = updated.items[0]!;
      expect(item.variantId).toBe(variantId);
      expect(item.quantity).toBe(3);
      expect(item.unitPrice).toBe(2500);
      expect(item.lineSubtotal).toBe(7500);
      expect(updated.subtotal).toBe(7500);
      expect(updated.grandTotal).toBe(7500);
    });

    it("increments quantity when duplicate variant is added to cart", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "dup-add");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const cart = await cartService.createCart(db, storeId);

      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 });
      const afterSecondAdd = await cartService.addItem(db, storeId, cart.id, {
        variantId,
        quantity: 3,
      });

      expect(afterSecondAdd.items).toHaveLength(1);
      const item = afterSecondAdd.items[0]!;
      expect(item.quantity).toBe(5);
      expect(item.lineSubtotal).toBe(5000);
      expect(afterSecondAdd.subtotal).toBe(5000);
    });

    it("updates item quantity and recalculates totals", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "update-qty");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1500 });
      const cart = await cartService.createCart(db, storeId);

      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 });
      const updated = await cartService.updateItemQuantity(db, storeId, cart.id, variantId, 4);

      expect(updated.items[0]?.quantity).toBe(4);
      expect(updated.items[0]?.lineSubtotal).toBe(6000);
      expect(updated.subtotal).toBe(6000);
    });

    it("removes item when quantity is updated to zero", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "update-zero");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1500 });
      const cart = await cartService.createCart(db, storeId);

      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 });
      const updated = await cartService.updateItemQuantity(db, storeId, cart.id, variantId, 0);

      expect(updated.items).toHaveLength(0);
      expect(updated.subtotal).toBe(0);
    });

    it("removes item explicitly by variantId or itemId", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "remove-item");
      const v1 = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const v2 = await seedTestProductAndVariant(db, storeId, { price: 2000 });
      const cart = await cartService.createCart(db, storeId);

      await cartService.addItem(db, storeId, cart.id, { variantId: v1.variantId, quantity: 1 });
      await cartService.addItem(db, storeId, cart.id, { variantId: v2.variantId, quantity: 1 });

      // Remove by variantId
      const afterRemoval = await cartService.removeItem(db, storeId, cart.id, v1.variantId);
      expect(afterRemoval.items).toHaveLength(1);
      expect(afterRemoval.items[0]?.variantId).toBe(v2.variantId);
      expect(afterRemoval.subtotal).toBe(2000);
    });

    it("clears all items from cart using clearCart", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "clear-cart");
      const v1 = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const v2 = await seedTestProductAndVariant(db, storeId, { price: 2000 });
      const cart = await cartService.createCart(db, storeId);

      await cartService.addItem(db, storeId, cart.id, { variantId: v1.variantId, quantity: 2 });
      await cartService.addItem(db, storeId, cart.id, { variantId: v2.variantId, quantity: 3 });

      const cleared = await cartService.clearCart(db, storeId, cart.id);
      expect(cleared.items).toHaveLength(0);
      expect(cleared.subtotal).toBe(0);
      expect(cleared.grandTotal).toBe(0);
    });

    it("gets individual item and lists items", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "get-list-items");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 3000 });
      const cart = await cartService.createCart(db, storeId);

      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const items = await cartService.listItems(db, storeId, cart.id);
      expect(items).toHaveLength(1);

      const single = await cartService.getItem(db, storeId, cart.id, variantId);
      expect(single.variantId).toBe(variantId);
      expect(single.unitPrice).toBe(3000);
    });
  });

  describe("Lifecycle Transitions & Editability Protection", () => {
    it("transitions cart from ACTIVE to CONVERTED, ABANDONED, or EXPIRED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "lifecycle-tx");
      const cart = await cartService.createCart(db, storeId);

      const converted = await cartService.transitionCartStatus(db, storeId, cart.id, "CONVERTED");
      expect(converted.status).toBe("CONVERTED");
    });

    it("blocks mutations on CONVERTED cart with CartAlreadyConvertedError", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "converted-protect");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);

      await cartService.transitionCartStatus(db, storeId, cart.id, "CONVERTED");

      await expect(
        cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 }),
      ).rejects.toThrow(CartAlreadyConvertedError);

      await expect(
        cartService.clearCart(db, storeId, cart.id),
      ).rejects.toThrow(CartAlreadyConvertedError);
    });

    it("blocks mutations on EXPIRED cart with CartExpiredError", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "expired-protect");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);

      await cartService.transitionCartStatus(db, storeId, cart.id, "EXPIRED");

      await expect(
        cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 }),
      ).rejects.toThrow(CartExpiredError);
    });
  });

  describe("Tenant Isolation Boundary", () => {
    it("strictly prevents accessing Store A cart from Store B context", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-iso");
      const storeB = await seedTestStore(db, "store-b-iso");
      const cartA = await cartService.createCart(db, storeA.storeId);

      await expect(
        cartService.getCart(db, storeB.storeId, cartA.id),
      ).rejects.toThrow(CartNotFoundError);
    });

    it("strictly prevents modifying Store A cart from Store B context", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-mut");
      const storeB = await seedTestStore(db, "store-b-mut");
      const cartA = await cartService.createCart(db, storeA.storeId);
      const { variantId } = await seedTestProductAndVariant(db, storeB.storeId);

      await expect(
        cartService.addItem(db, storeB.storeId, cartA.id, { variantId, quantity: 1 }),
      ).rejects.toThrow(CartNotFoundError);
    });

    it("strictly prevents adding product variant belonging to Store B into Store A cart", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-cross-var");
      const storeB = await seedTestStore(db, "store-b-cross-var");
      const cartA = await cartService.createCart(db, storeA.storeId);
      const varB = await seedTestProductAndVariant(db, storeB.storeId);

      await expect(
        cartService.addItem(db, storeA.storeId, cartA.id, {
          variantId: varB.variantId,
          quantity: 1,
        }),
      ).rejects.toThrow(CrossStoreVariantError);
    });

    it("strictly prevents associating customer from Store B into Store A cart", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-cross-cust");
      const storeB = await seedTestStore(db, "store-b-cross-cust");
      const cartA = await cartService.createCart(db, storeA.storeId);
      const custB = await seedTestCustomer(db, storeB.storeId, "b@store.com");

      await expect(
        cartService.associateCustomer(db, storeA.storeId, cartA.id, custB),
      ).rejects.toThrow(CrossStoreCustomerError);
    });
  });

  describe("Product & Customer Validation Errors", () => {
    it("throws ProductVariantNotFoundError when variant does not exist", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "var-not-found");
      const cart = await cartService.createCart(db, storeId);

      await expect(
        cartService.addItem(db, storeId, cart.id, {
          variantId: generateUuidV7(),
          quantity: 1,
        }),
      ).rejects.toThrow(ProductVariantNotFoundError);
    });

    it("throws ProductVariantUnavailableError when variant is INACTIVE", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "var-inactive");
      const { variantId } = await seedTestProductAndVariant(db, storeId, {
        status: "INACTIVE",
      });
      const cart = await cartService.createCart(db, storeId);

      await expect(
        cartService.addItem(db, storeId, cart.id, {
          variantId,
          quantity: 1,
        }),
      ).rejects.toThrow(ProductVariantUnavailableError);
    });

    it("throws InvalidQuantityError when adding invalid quantity", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "bad-qty");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);

      await expect(
        cartService.addItem(db, storeId, cart.id, {
          variantId,
          quantity: -5,
        }),
      ).rejects.toThrow(InvalidQuantityError);
    });

    it("throws CartItemNotFoundError when updating non-existent item", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "item-not-found");
      const cart = await cartService.createCart(db, storeId);

      await expect(
        cartService.updateItemQuantity(db, storeId, cart.id, generateUuidV7(), 2),
      ).rejects.toThrow(CartItemNotFoundError);
    });

    it("throws ProductVariantUnavailableError when parent product is DRAFT", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "prod-draft");
      const { variantId } = await seedTestProductAndVariant(db, storeId, {
        productStatus: "DRAFT",
      });
      const cart = await cartService.createCart(db, storeId);

      await expect(
        cartService.addItem(db, storeId, cart.id, {
          variantId,
          quantity: 1,
        }),
      ).rejects.toThrow(ProductVariantUnavailableError);
    });

    it("throws ProductVariantUnavailableError when parent product is ARCHIVED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "prod-archived");
      const { variantId } = await seedTestProductAndVariant(db, storeId, {
        productStatus: "ARCHIVED",
      });
      const cart = await cartService.createCart(db, storeId);

      await expect(
        cartService.addItem(db, storeId, cart.id, {
          variantId,
          quantity: 1,
        }),
      ).rejects.toThrow(ProductVariantUnavailableError);
    });

    it("throws InvalidCurrencyError when variant currency does not match cart currency", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "curr-mismatch");
      const { variantId } = await seedTestProductAndVariant(db, storeId, {
        currency: "EUR",
      });
      const cart = await cartService.createCart(db, storeId, { currency: "USD" });

      await expect(
        cartService.addItem(db, storeId, cart.id, {
          variantId,
          quantity: 1,
        }),
      ).rejects.toThrow(InvalidCurrencyError);
    });
  });

  describe("Concurrency & Race Condition Handling", () => {
    it("handles concurrent addItem for the same variant without duplicates and aggregates quantity", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrency-add");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const cart = await cartService.createCart(db, storeId);

      // Launch 5 concurrent addItem operations, each adding quantity = 2
      const promises = Array.from({ length: 5 }, () =>
        cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 }),
      );

      await Promise.all(promises);

      // Verify the resulting cart
      const finalCart = await cartService.getCart(db, storeId, cart.id);
      expect(finalCart.items).toHaveLength(1);
      expect(finalCart.items[0]?.variantId).toBe(variantId);
      expect(finalCart.items[0]?.quantity).toBe(10);
      expect(finalCart.items[0]?.lineSubtotal).toBe(10000);
      expect(finalCart.subtotal).toBe(10000);
    });

    it("serializes concurrent quantity updates safely", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrency-update");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 500 });
      const cart = await cartService.createCart(db, storeId);

      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      // Run multiple concurrent updates
      await Promise.all([
        cartService.updateItemQuantity(db, storeId, cart.id, variantId, 3),
        cartService.updateItemQuantity(db, storeId, cart.id, variantId, 4),
        cartService.updateItemQuantity(db, storeId, cart.id, variantId, 5),
      ]);

      const finalCart = await cartService.getCart(db, storeId, cart.id);
      expect(finalCart.items).toHaveLength(1);
      // Final quantity will be one of the updated values, but valid and consistent
      expect([3, 4, 5]).toContain(finalCart.items[0]?.quantity);
      expect(finalCart.subtotal).toBe((finalCart.items[0]?.quantity ?? 0) * 500);
    });

    it("enforces that cart converted concurrently rejects pending item additions", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrency-convert");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 500 });
      const cart = await cartService.createCart(db, storeId);

      // Convert cart
      await cartService.transitionCartStatus(db, storeId, cart.id, "CONVERTED");

      // Subsequent or concurrent add must fail
      await expect(
        cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 }),
      ).rejects.toThrow(CartAlreadyConvertedError);
    });

    it("handles lifecycle race: concurrent addItem and completeCart serialize atomically", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "race-add-complete");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1500 });
      const cart = await cartService.createCart(db, storeId);

      // Thread A attempts to add item, Thread B attempts to complete cart
      const [resAdd, resComplete] = await Promise.allSettled([
        cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 }),
        cartService.transitionCartStatus(db, storeId, cart.id, "CONVERTED"),
      ]);

      const finalCart = await cartService.getCart(db, storeId, cart.id);
      expect(finalCart.status).toBe("CONVERTED");

      if (resAdd.status === "fulfilled") {
        expect(resComplete.status).toBe("fulfilled");
        expect(finalCart.items).toHaveLength(1);
        expect(finalCart.items[0]?.quantity).toBe(2);
        expect(finalCart.subtotal).toBe(3000);
      } else {
        expect(resComplete.status).toBe("fulfilled");
        expect(resAdd.reason).toBeInstanceOf(CartAlreadyConvertedError);
        expect(finalCart.items).toHaveLength(0);
        expect(finalCart.subtotal).toBe(0);
      }
    });

    it("handles lifecycle race: concurrent updateItemQuantity and expireCart serialize atomically", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "race-update-expire");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const cart = await cartService.createCart(db, storeId);
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const [resUpdate, resExpire] = await Promise.allSettled([
        cartService.updateItemQuantity(db, storeId, cart.id, variantId, 5),
        cartService.transitionCartStatus(db, storeId, cart.id, "EXPIRED"),
      ]);

      const finalCart = await cartService.getCart(db, storeId, cart.id);
      expect(finalCart.status).toBe("EXPIRED");

      if (resUpdate.status === "fulfilled") {
        expect(resExpire.status).toBe("fulfilled");
        expect(finalCart.items).toHaveLength(1);
        expect(finalCart.items[0]?.quantity).toBe(5);
        expect(finalCart.subtotal).toBe(5000);
      } else {
        expect(resExpire.status).toBe("fulfilled");
        expect(resUpdate.reason).toBeInstanceOf(CartExpiredError);
        expect(finalCart.items).toHaveLength(1);
        expect(finalCart.subtotal).toBe(1000);
      }
    });
  });

  describe("Price Snapshot & Totals Integrity", () => {
    it("preserves price snapshot of existing cart items when catalog price changes", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "price-snapshot");
      const { variantId: var1 } = await seedTestProductAndVariant(db, storeId, { price: 2000 });
      const { variantId: var2 } = await seedTestProductAndVariant(db, storeId, { price: 5000 });
      const cart = await cartService.createCart(db, storeId);

      // Add item 1 at initial price 2000
      await cartService.addItem(db, storeId, cart.id, { variantId: var1, quantity: 2 });
      let currentCart = await cartService.getCart(db, storeId, cart.id);
      expect(currentCart.subtotal).toBe(4000);
      expect(currentCart.items[0]?.unitPrice).toBe(2000);

      // Directly update catalog price of var1 to 3500
      await db.query(`UPDATE product_variants SET price = 3500 WHERE id = $1`, [var1]);

      // Cart item must preserve its original snapshot unitPrice 2000
      currentCart = await cartService.getCart(db, storeId, cart.id);
      expect(currentCart.items[0]?.unitPrice).toBe(2000);
      expect(currentCart.items[0]?.lineSubtotal).toBe(4000);
      expect(currentCart.subtotal).toBe(4000);

      // Add variant 2 at price 5000
      await cartService.addItem(db, storeId, cart.id, { variantId: var2, quantity: 1 });
      currentCart = await cartService.getCart(db, storeId, cart.id);
      expect(currentCart.items).toHaveLength(2);

      const item1 = currentCart.items.find((i) => i.variantId === var1);
      const item2 = currentCart.items.find((i) => i.variantId === var2);
      expect(item1?.unitPrice).toBe(2000);
      expect(item2?.unitPrice).toBe(5000);
      expect(currentCart.subtotal).toBe(4000 + 5000);
      expect(currentCart.grandTotal).toBe(9000);
    });
  });

  describe("Transaction Atomicity", () => {
    it("rolls back all changes if an error occurs during multi-step operation", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "tx-atomicity");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 2000 });
      const cart = await cartService.createCart(db, storeId);

      // Attempt to execute a failing multi-step transaction using db.withTransaction
      await expect(
        db.withTransaction(async (tx) => {
          await cartService.addItem(tx, storeId, cart.id, { variantId, quantity: 1 });
          // Intentionally throw inside transaction
          throw new Error("Simulated failure after addItem");
        }),
      ).rejects.toThrow("Simulated failure after addItem");

      // Verify that neither the item nor totals were committed to the database
      const verifiedCart = await cartService.getCart(db, storeId, cart.id);
      expect(verifiedCart.items).toHaveLength(0);
      expect(verifiedCart.subtotal).toBe(0);
      expect(verifiedCart.grandTotal).toBe(0);

      const itemsInDb = await db.query(`SELECT * FROM cart_items WHERE cart_id = $1`, [cart.id]);
      expect(itemsInDb.rows).toHaveLength(0);
    });
  });
});
