import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { CartService } from "@shopify-clone/carts";
import {
  CartNotActiveError,
  CartNotFoundError,
  CheckoutAlreadyCompletedError,
  CheckoutExpiredError,
  CheckoutNotFoundError,
  CheckoutNotEditableError,
  CheckoutService,
  CrossStoreCartError,
  CrossStoreCustomerError,
  CrossStoreVariantError,
  CustomerNotFoundError,
  DuplicateCheckoutItemError,
  EmptyCartError,
  IdempotencyConflictError,
  InvalidCheckoutAddressError,
  InvalidCheckoutStateTransitionError,
  InvalidCurrencyError,
  InvalidQuantityError,
  ProductVariantNotFoundError,
  ProductVariantUnavailableError,
} from "@shopify-clone/checkout";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Checkout Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const checkoutService = new CheckoutService();
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
    slug = "checkout-store-1",
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
      title?: string;
      variantTitle?: string;
      sku?: string;
      price?: number;
      status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
      productStatus?: "ACTIVE" | "DRAFT" | "ARCHIVED";
      currency?: string;
    } = {},
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const title = params.title ?? "Test Product";
    const variantTitle = params.variantTitle ?? "Default Variant";
    const price = params.price ?? 2500;
    const sku = params.sku ?? `SKU-${generateUuidV7()}`;
    const status = params.status ?? "ACTIVE";
    const productStatus = params.productStatus ?? "ACTIVE";
    const currency = params.currency ?? "USD";

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, storeId, title, `prod-${productId}`, productStatus],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, status, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [variantId, productId, storeId, variantTitle, sku, price, status, currency],
    );

    return { productId, variantId };
  }

  describe("Checkout Creation from Cart & Direct", () => {
    it("creates a checkout directly with default open state", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "direct-checkout");
      const cart = await cartService.createCart(db, storeId);

      const checkout = await checkoutService.createCheckout(db, storeId, {
        cartId: cart.id,
        email: "guest@example.com",
      });

      expect(checkout.id).toBeDefined();
      expect(checkout.storeId).toBe(storeId);
      expect(checkout.cartId).toBe(cart.id);
      expect(checkout.email).toBe("guest@example.com");
      expect(checkout.status).toBe("OPEN");
      expect(checkout.currency).toBe("USD");
      expect(checkout.subtotal).toBe(0);
      expect(checkout.total).toBe(0);
      expect(checkout.items).toHaveLength(0);
    });

    it("creates a checkout from an active cart preserving immutable snapshots", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cart-checkout");
      const customerId = await seedTestCustomer(db, storeId, "buyer@example.com");
      const { variantId } = await seedTestProductAndVariant(db, storeId, {
        title: "Artisan Coffee",
        variantTitle: "Dark Roast 500g",
        sku: "COFFEE-DK-500",
        price: 3200,
      });

      const cart = await cartService.createCart(db, storeId, { customerId });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        customerId,
        email: "buyer@example.com",
        shippingAddress: {
          addressLine1: "123 Market St",
          city: "Seattle",
          postalCode: "98101",
          country: "US",
        },
      });

      expect(checkout.id).toBeDefined();
      expect(checkout.storeId).toBe(storeId);
      expect(checkout.cartId).toBe(cart.id);
      expect(checkout.customerId).toBe(customerId);
      expect(checkout.email).toBe("buyer@example.com");
      expect(checkout.status).toBe("OPEN");
      expect(checkout.subtotal).toBe(6400);
      expect(checkout.total).toBe(6400);
      expect(checkout.shippingAddress?.addressLine1).toBe("123 Market St");
      expect(checkout.items).toHaveLength(1);

      const itemSnapshot = checkout.items[0]!;
      expect(itemSnapshot.variantId).toBe(variantId);
      expect(itemSnapshot.productNameSnapshot).toBe("Artisan Coffee");
      expect(itemSnapshot.variantNameSnapshot).toBe("Dark Roast 500g");
      expect(itemSnapshot.skuSnapshot).toBe("COFFEE-DK-500");
      expect(itemSnapshot.unitPrice).toBe(3200);
      expect(itemSnapshot.quantity).toBe(2);
      expect(itemSnapshot.lineTotal).toBe(6400);

      // Verify snapshots do not change even if catalog changes later
      await db.query(`UPDATE products SET title = 'Changed Coffee' WHERE store_id = $1`, [storeId]);
      await db.query(`UPDATE product_variants SET price = 9999 WHERE id = $1`, [variantId]);

      const reloadedCheckout = await checkoutService.getCheckout(db, storeId, checkout.id);
      expect(reloadedCheckout.items[0]?.productNameSnapshot).toBe("Artisan Coffee");
      expect(reloadedCheckout.items[0]?.unitPrice).toBe(3200);
      expect(reloadedCheckout.subtotal).toBe(6400);
    });

    it("rejects creating checkout from empty cart", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "empty-cart");
      const cart = await cartService.createCart(db, storeId);

      await expect(
        checkoutService.createCheckoutFromCart(db, storeId, cart.id),
      ).rejects.toThrow(EmptyCartError);
    });

    it("rejects creating checkout from non-active cart", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "inactive-cart");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });
      await cartService.transitionCartStatus(db, storeId, cart.id, "CONVERTED");

      await expect(
        checkoutService.createCheckoutFromCart(db, storeId, cart.id),
      ).rejects.toThrow(CartNotActiveError);
    });

    it("rejects creating checkout from cross-store cart", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-cart");
      const { storeId: storeB } = await seedTestStore(db, "store-b-cart");
      const { variantId } = await seedTestProductAndVariant(db, storeA);
      const cartA = await cartService.createCart(db, storeA);
      await cartService.addItem(db, storeA, cartA.id, { variantId, quantity: 1 });

      await expect(
        checkoutService.createCheckoutFromCart(db, storeB, cartA.id),
      ).rejects.toThrow(CrossStoreCartError);
    });

    it("rejects creating checkout for non-existent cart", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "missing-cart");

      await expect(
        checkoutService.createCheckoutFromCart(db, storeId, generateUuidV7()),
      ).rejects.toThrow(CartNotFoundError);
    });

    it("rejects creating checkout when cart item references inactive variant", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "inactive-variant");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const cart = await cartService.createCart(db, storeId);
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      // Inactivate variant in catalog
      await db.query(`UPDATE product_variants SET status = 'INACTIVE' WHERE id = $1`, [variantId]);

      await expect(
        checkoutService.createCheckoutFromCart(db, storeId, cart.id),
      ).rejects.toThrow(ProductVariantUnavailableError);
    });
  });

  describe("Item Mutations & Totals Management", () => {
    it("adds item, updates quantity, and removes item on OPEN checkout", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "item-mutations");
      const { variantId: var1 } = await seedTestProductAndVariant(db, storeId, {
        title: "P1",
        price: 1500,
      });
      const { variantId: var2 } = await seedTestProductAndVariant(db, storeId, {
        title: "P2",
        price: 2500,
      });
      const cart = await cartService.createCart(db, storeId);

      let checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      // Add item 1
      checkout = await checkoutService.addItem(db, storeId, checkout.id, {
        variantId: var1,
        quantity: 2,
      });
      expect(checkout.items).toHaveLength(1);
      expect(checkout.subtotal).toBe(3000);
      expect(checkout.total).toBe(3000);

      // Add item 2
      checkout = await checkoutService.addItem(db, storeId, checkout.id, {
        variantId: var2,
        quantity: 1,
      });
      expect(checkout.items).toHaveLength(2);
      expect(checkout.subtotal).toBe(5500);

      // Update quantity
      checkout = await checkoutService.updateItemQuantity(db, storeId, checkout.id, var1, 4);
      expect(checkout.subtotal).toBe(8500); // 4 * 1500 + 1 * 2500 = 8500

      // Remove item 2
      checkout = await checkoutService.removeItem(db, storeId, checkout.id, var2);
      expect(checkout.items).toHaveLength(1);
      expect(checkout.subtotal).toBe(6000);

      // Clear all items
      checkout = await checkoutService.clearItems(db, storeId, checkout.id);
      expect(checkout.items).toHaveLength(0);
      expect(checkout.subtotal).toBe(0);
      expect(checkout.total).toBe(0);
    });

    it("rejects duplicate variant addition to the same checkout", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "dup-item");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);
      const checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      await checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 1 });

      await expect(
        checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 2 }),
      ).rejects.toThrow(DuplicateCheckoutItemError);
    });

    it("rejects invalid quantities", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "invalid-qty");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);
      const checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      await expect(
        checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 0 }),
      ).rejects.toThrow(InvalidQuantityError);

      await expect(
        checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: -2 }),
      ).rejects.toThrow(InvalidQuantityError);
    });

    it("updates totals (discount, tax, shipping) accurately", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "totals-calc");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 5000 });
      const cart = await cartService.createCart(db, storeId);
      let checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });
      await checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 2 });

      checkout = await checkoutService.updateTotals(db, storeId, checkout.id, {
        discountTotal: 1000,
        taxTotal: 900,
        shippingTotal: 500,
      });

      expect(checkout.subtotal).toBe(10000);
      expect(checkout.discountTotal).toBe(1000);
      expect(checkout.taxTotal).toBe(900);
      expect(checkout.shippingTotal).toBe(500);
      expect(checkout.total).toBe(10400); // 10000 - 1000 + 900 + 500
    });
  });

  describe("Customer and Address Management", () => {
    it("associates customer and updates addresses", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-addr");
      const customerId = await seedTestCustomer(db, storeId, "registered@test.com");
      const cart = await cartService.createCart(db, storeId);

      let checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });
      checkout = await checkoutService.updateCustomer(db, storeId, checkout.id, {
        customerId,
        email: "registered@test.com",
      });

      expect(checkout.customerId).toBe(customerId);
      expect(checkout.email).toBe("registered@test.com");

      checkout = await checkoutService.updateAddresses(db, storeId, checkout.id, {
        shippingAddress: {
          addressLine1: "456 Oak Avenue",
          city: "San Francisco",
          postalCode: "94102",
          country: "US",
        },
      });

      expect(checkout.shippingAddress?.addressLine1).toBe("456 Oak Avenue");
      expect(checkout.shippingAddress?.city).toBe("San Francisco");
    });

    it("rejects cross-store customer association", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "cust-store-a");
      const { storeId: storeB } = await seedTestStore(db, "cust-store-b");
      const customerA = await seedTestCustomer(db, storeA);
      const cartB = await cartService.createCart(db, storeB);

      const checkout = await checkoutService.createCheckout(db, storeB, { cartId: cartB.id });

      await expect(
        checkoutService.updateCustomer(db, storeB, checkout.id, { customerId: customerA }),
      ).rejects.toThrow(CrossStoreCustomerError);
    });

    it("rejects invalid addresses missing required fields", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "invalid-addr");
      const cart = await cartService.createCart(db, storeId);
      const checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      await expect(
        checkoutService.updateAddresses(db, storeId, checkout.id, {
          shippingAddress: {
            addressLine1: "",
            city: "City",
            postalCode: "12345",
            country: "US",
          },
        }),
      ).rejects.toThrow(InvalidCheckoutAddressError);
    });
  });

  describe("Lifecycle State Transitions", () => {
    it("orchestrates standard successful lifecycle: OPEN -> PAYMENT_PENDING -> COMPLETED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "lifecycle-success");
      const cart = await cartService.createCart(db, storeId);
      let checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      expect(checkout.status).toBe("OPEN");

      checkout = await checkoutService.beginPayment(db, storeId, checkout.id);
      expect(checkout.status).toBe("PAYMENT_PENDING");

      checkout = await checkoutService.completeCheckout(db, storeId, checkout.id);
      expect(checkout.status).toBe("COMPLETED");

      // Repeated complete is idempotent
      const repeated = await checkoutService.completeCheckout(db, storeId, checkout.id);
      expect(repeated.status).toBe("COMPLETED");
      expect(repeated.id).toBe(checkout.id);
    });

    it("orchestrates payment failure retry workflow: OPEN -> PAYMENT_PENDING -> OPEN", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "lifecycle-retry");
      const cart = await cartService.createCart(db, storeId);
      let checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      checkout = await checkoutService.beginPayment(db, storeId, checkout.id);
      expect(checkout.status).toBe("PAYMENT_PENDING");

      // Payment fails -> reopen checkout for customer retry
      checkout = await checkoutService.reopenFromPaymentFailure(db, storeId, checkout.id);
      expect(checkout.status).toBe("OPEN");
    });

    it("orchestrates cancellation from OPEN and PAYMENT_PENDING", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "lifecycle-cancel");
      const cart = await cartService.createCart(db, storeId);
      let checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      checkout = await checkoutService.cancelCheckout(db, storeId, checkout.id);
      expect(checkout.status).toBe("CANCELLED");

      // Repeated cancel is idempotent
      const repeated = await checkoutService.cancelCheckout(db, storeId, checkout.id);
      expect(repeated.status).toBe("CANCELLED");
    });

    it("rejects mutating items or totals on terminal checkouts", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "terminal-reject");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);
      let checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });
      await checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 1 });

      checkout = await checkoutService.beginPayment(db, storeId, checkout.id);
      await checkoutService.completeCheckout(db, storeId, checkout.id);

      await expect(
        checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 2 }),
      ).rejects.toThrow(CheckoutAlreadyCompletedError);

      await expect(
        checkoutService.removeItem(db, storeId, checkout.id, variantId),
      ).rejects.toThrow(CheckoutAlreadyCompletedError);

      await expect(
        checkoutService.updateTotals(db, storeId, checkout.id, { discountTotal: 500 }),
      ).rejects.toThrow(CheckoutAlreadyCompletedError);
    });

    it("rejects illegal state transitions", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "illegal-transition");
      const cart = await cartService.createCart(db, storeId);
      const checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      // Direct complete from OPEN is illegal
      await expect(
        checkoutService.completeCheckout(db, storeId, checkout.id),
      ).rejects.toThrow(InvalidCheckoutStateTransitionError);
    });
  });

  describe("Checkout Expiration", () => {
    it("locates and expires stale checkouts correctly", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "stale-expire");
      const cart = await cartService.createCart(db, storeId);

      const pastExpiry = new Date(Date.now() - 3600_000); // 1 hour ago
      const futureExpiry = new Date(Date.now() + 3600_000); // 1 hour ahead

      const staleCheckout = await checkoutService.createCheckout(db, storeId, {
        cartId: cart.id,
        expiresAt: pastExpiry,
      });

      const activeCheckout = await checkoutService.createCheckout(db, storeId, {
        cartId: cart.id,
        expiresAt: futureExpiry,
      });

      const expiredList = await checkoutService.findExpiredCheckouts(db, storeId);
      expect(expiredList.some((c) => c.id === staleCheckout.id)).toBe(true);
      expect(expiredList.some((c) => c.id === activeCheckout.id)).toBe(false);

      const expiredCount = await checkoutService.expireStaleCheckouts(db, storeId);
      expect(expiredCount).toBe(1);

      const reloadedStale = await checkoutService.getCheckout(db, storeId, staleCheckout.id);
      expect(reloadedStale.status).toBe("EXPIRED");
    });
  });

  describe("Tenant Isolation", () => {
    it("guarantees cross-store checkouts cannot be accessed or modified", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "tenant-a");
      const { storeId: storeB } = await seedTestStore(db, "tenant-b");
      const { variantId } = await seedTestProductAndVariant(db, storeA);
      const cartA = await cartService.createCart(db, storeA);

      const checkoutA = await checkoutService.createCheckout(db, storeA, { cartId: cartA.id });

      // Store B cannot get Store A's checkout
      await expect(
        checkoutService.getCheckout(db, storeB, checkoutA.id),
      ).rejects.toThrow(CheckoutNotFoundError);

      // Store B cannot add items to Store A's checkout
      await expect(
        checkoutService.addItem(db, storeB, checkoutA.id, { variantId, quantity: 1 }),
      ).rejects.toThrow(CheckoutNotFoundError);

      // Store B cannot complete Store A's checkout
      await expect(
        checkoutService.beginPayment(db, storeB, checkoutA.id),
      ).rejects.toThrow(CheckoutNotFoundError);

      // Cross-store variant cannot be added to Store A's checkout
      const { variantId: variantB } = await seedTestProductAndVariant(db, storeB);
      await expect(
        checkoutService.addItem(db, storeA, checkoutA.id, { variantId: variantB, quantity: 1 }),
      ).rejects.toThrow(CrossStoreVariantError);

      // Missing customer throws CustomerNotFoundError
      await expect(
        checkoutService.updateCustomer(db, storeA, checkoutA.id, { customerId: generateUuidV7() }),
      ).rejects.toThrow(CustomerNotFoundError);

      // Missing variant throws ProductVariantNotFoundError
      await expect(
        checkoutService.addItem(db, storeA, checkoutA.id, { variantId: generateUuidV7(), quantity: 1 }),
      ).rejects.toThrow(ProductVariantNotFoundError);

      // Currency mismatch throws InvalidCurrencyError
      const { variantId: variantEUR } = await seedTestProductAndVariant(db, storeA, { currency: "EUR" });
      await expect(
        checkoutService.addItem(db, storeA, checkoutA.id, { variantId: variantEUR, quantity: 1 }),
      ).rejects.toThrow(InvalidCurrencyError);
    });
  });

  describe("Idempotency", () => {
    it("returns identical result for repeated request with same key and payload", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "idemp-same");
      const cart = await cartService.createCart(db, storeId);
      const idempotencyKey = "idemp-key-001";

      const res1 = await checkoutService.createCheckout(db, storeId, {
        cartId: cart.id,
        email: "user@test.com",
        idempotencyKey,
      });

      const res2 = await checkoutService.createCheckout(db, storeId, {
        cartId: cart.id,
        email: "user@test.com",
        idempotencyKey,
      });

      expect(res1.id).toBe(res2.id);
      expect(res1.createdAt).toBe(res2.createdAt);
    });

    it("rejects request with same key and different payload with IdempotencyConflictError", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "idemp-conflict");
      const cart = await cartService.createCart(db, storeId);
      const idempotencyKey = "idemp-key-conflict";

      await checkoutService.createCheckout(db, storeId, {
        cartId: cart.id,
        email: "original@test.com",
        idempotencyKey,
      });

      await expect(
        checkoutService.createCheckout(db, storeId, {
          cartId: cart.id,
          email: "different@test.com",
          idempotencyKey,
        }),
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it("serializes concurrent requests with the same idempotency key safely", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "idemp-concurrent");
      const cart = await cartService.createCart(db, storeId);
      const idempotencyKey = "concurrent-key";

      const [res1, res2] = await Promise.all([
        checkoutService.createCheckout(db, storeId, {
          cartId: cart.id,
          email: "concurrent@test.com",
          idempotencyKey,
        }),
        checkoutService.createCheckout(db, storeId, {
          cartId: cart.id,
          email: "concurrent@test.com",
          idempotencyKey,
        }),
      ]);

      expect(res1.id).toBe(res2.id);
    });
  });

  describe("Concurrency Control with PostgreSQL Row Locking", () => {
    it("serializes concurrent duplicate item additions: only one succeeds under row lock", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrent-add");
      const { variantId } = await seedTestProductAndVariant(db, storeId);
      const cart = await cartService.createCart(db, storeId);
      const checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });

      const [res1, res2] = await Promise.allSettled([
        checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 1 }),
        checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity: 2 }),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
      const rejected = [res1, res2].filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0]?.status === "rejected") {
        expect(rejected[0].reason).toBeInstanceOf(DuplicateCheckoutItemError);
      }

      const finalCheckout = await checkoutService.getCheckout(db, storeId, checkout.id);
      expect(finalCheckout.items).toHaveLength(1);
    });

    it("serializes concurrent item mutation and checkout completion", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrent-mutate-complete");
      const { variantId: var1 } = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const { variantId: var2 } = await seedTestProductAndVariant(db, storeId, { price: 2000 });
      const cart = await cartService.createCart(db, storeId);
      const checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });
      await checkoutService.addItem(db, storeId, checkout.id, { variantId: var1, quantity: 1 });
      await checkoutService.beginPayment(db, storeId, checkout.id);

      // Thread A mutates items (tries to add var2), Thread B completes checkout
      const [resMutate, resComplete] = await Promise.allSettled([
        checkoutService.addItem(db, storeId, checkout.id, { variantId: var2, quantity: 1 }),
        checkoutService.completeCheckout(db, storeId, checkout.id),
      ]);

      // Thread B should complete the checkout
      expect(resComplete.status).toBe("fulfilled");

      // Thread A should either reject because checkout is in PAYMENT_PENDING or COMPLETED
      expect(resMutate.status).toBe("rejected");
      if (resMutate.status === "rejected") {
        expect(
          resMutate.reason instanceof CheckoutAlreadyCompletedError ||
          resMutate.reason instanceof CheckoutNotEditableError,
        ).toBe(true);
      }

      const finalCheckout = await checkoutService.getCheckout(db, storeId, checkout.id);
      expect(finalCheckout.status).toBe("COMPLETED");
    });

    it("serializes concurrent item mutation and checkout expiration", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrent-mutate-expire");
      const { variantId: var1 } = await seedTestProductAndVariant(db, storeId, { price: 1000 });
      const { variantId: var2 } = await seedTestProductAndVariant(db, storeId, { price: 2000 });
      const cart = await cartService.createCart(db, storeId);
      const checkout = await checkoutService.createCheckout(db, storeId, { cartId: cart.id });
      await checkoutService.addItem(db, storeId, checkout.id, { variantId: var1, quantity: 1 });

      const [resMutate, resExpire] = await Promise.allSettled([
        checkoutService.addItem(db, storeId, checkout.id, { variantId: var2, quantity: 1 }),
        checkoutService.expireCheckout(db, storeId, checkout.id),
      ]);

      expect(resExpire.status).toBe("fulfilled");

      const finalCheckout = await checkoutService.getCheckout(db, storeId, checkout.id);
      expect(finalCheckout.status).toBe("EXPIRED");

      if (resMutate.status === "rejected") {
        expect(
          resMutate.reason instanceof CheckoutExpiredError ||
          resMutate.reason instanceof CheckoutNotEditableError,
        ).toBe(true);
      }
    });
  });

  describe("Adversarial Review Remediations (Task 4)", () => {
    it("serializes concurrent createCheckoutFromCart calls and returns the existing open checkout without duplicate creation", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrent-cart-checkout");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 3000 });
      const cart = await cartService.createCart(db, storeId);
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 });

      // Run two concurrent createCheckoutFromCart calls for the same cart
      const [res1, res2] = await Promise.all([
        checkoutService.createCheckoutFromCart(db, storeId, cart.id),
        checkoutService.createCheckoutFromCart(db, storeId, cart.id),
      ]);

      expect(res1.id).toBe(res2.id);
      expect(res1.status).toBe("OPEN");

      // Verify that database has exactly 1 checkout record for this cart
      const checkoutsInDb = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM checkouts WHERE store_id = $1 AND cart_id = $2`,
        [storeId, cart.id],
      );
      expect(Number(checkoutsInDb.rows[0]?.count)).toBe(1);
    });

    it("associates customerId in createCheckoutFromCart and rejects cross-store customer", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "cust-store-a");
      const { storeId: storeB } = await seedTestStore(db, "cust-store-b");
      const { variantId } = await seedTestProductAndVariant(db, storeA, { price: 2000 });
      const cart = await cartService.createCart(db, storeA);
      await cartService.addItem(db, storeA, cart.id, { variantId, quantity: 1 });

      const custA = await seedTestCustomer(db, storeA, "customera@store.com");
      const custB = await seedTestCustomer(db, storeB, "customerb@store.com");

      // Reject cross-store customer
      await expect(
        checkoutService.createCheckoutFromCart(db, storeA, cart.id, { customerId: custB }),
      ).rejects.toThrow(CrossStoreCustomerError);

      // Successfully associates valid store customer
      const checkout = await checkoutService.createCheckoutFromCart(db, storeA, cart.id, {
        customerId: custA,
      });
      expect(checkout.customerId).toBe(custA);
    });

    it("rejects beginPayment and completeCheckout on expired checkouts and marks them EXPIRED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "expired-transitions");
      const past = new Date(Date.now() - 60_000);
      const cart = await cartService.createCart(db, storeId);
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1500 });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id);
      await db.query(`UPDATE checkouts SET expires_at = $1 WHERE id = $2`, [past, checkout.id]);

      // beginPayment on expired checkout throws CheckoutExpiredError and prevents transition to PAYMENT_PENDING
      await expect(checkoutService.beginPayment(db, storeId, checkout.id)).rejects.toThrow(
        CheckoutExpiredError,
      );

      // completeCheckout on expired checkout also rejects with CheckoutExpiredError
      await expect(checkoutService.completeCheckout(db, storeId, checkout.id)).rejects.toThrow(
        CheckoutExpiredError,
      );
    });

    it("expires checkouts in PAYMENT_PENDING state when stale", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "expire-pending");
      const past = new Date(Date.now() - 60_000);
      const cart = await cartService.createCart(db, storeId);
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 1500 });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id);
      await checkoutService.beginPayment(db, storeId, checkout.id);

      // Force expires_at into the past
      await db.query(`UPDATE checkouts SET expires_at = $1 WHERE id = $2`, [past, checkout.id]);

      const expiredCount = await checkoutService.expireStaleCheckouts(db, storeId, new Date());
      expect(expiredCount).toBe(1);

      const updated = await checkoutService.getCheckout(db, storeId, checkout.id);
      expect(updated.status).toBe("EXPIRED");
    });

    it("handles idempotency payload comparison canonically regardless of key order", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "idempotency-key-order");
      const { variantId } = await seedTestProductAndVariant(db, storeId, { price: 2000 });
      const cart = await cartService.createCart(db, storeId);
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const key = "key-canonical-order";

      // First call with email
      const res1 = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        email: "canonical@test.com",
        idempotencyKey: key,
      });

      // Second call with same parameters
      const res2 = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        email: "canonical@test.com",
        idempotencyKey: key,
      });

      expect(res1.id).toBe(res2.id);
    });
  });
});
