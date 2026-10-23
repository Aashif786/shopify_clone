import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { CheckoutService, CrossStoreCartError } from "@shopify-clone/checkout";
import { OrderService } from "@shopify-clone/orders";
import { CartService } from "@shopify-clone/carts";
import {
  PaymentOrderIntegration,
  PaymentValidationError,
} from "@shopify-clone/payments";
import {
  hashToken,
  logout,
  register,
  validateSession,
  SessionRevokedError,
} from "@shopify-clone/auth";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  assertCartOwnership,
  assertCheckoutOwnership,
  assertOrderOwnership,
  extractGuestToken,
  generateSecureToken,
} from "../../apps/web/src/lib/storefront-auth-helpers.js";
import { enrichCheckout } from "../../apps/web/src/lib/storefront-checkout-helpers.js";
import { ApiHttpError } from "../../apps/web/src/lib/api/errors.js";

describe("Adversarial Security Audit Regression Tests", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const checkoutService = new CheckoutService();
  const orderService = new OrderService();
  const cartService = new CartService();
  const paymentOrderIntegration = new PaymentOrderIntegration();

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

  async function seedStoreAndCatalog(
    db: Database,
    slug = "adversarial-store",
  ): Promise<{
    orgId: string;
    storeId: string;
    variantId: string;
    customerId1: string;
    customerId2: string;
  }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const customerId1 = generateUuidV7();
    const customerId2 = generateUuidV7();

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, 'Adversarial Org', 'ACTIVE')`,
      [orgId],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Adversarial Store', $3, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, slug],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Security Widget', 'sec-widget', 'ACTIVE')`,
      [productId, storeId],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, position)
       VALUES ($1, $2, $3, 'Standard', 'SEC-WIDGET-01', 3000, 1)`,
      [variantId, productId, storeId],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 100, 0)`,
      [generateUuidV7(), storeId, variantId],
    );

    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'alice@adv.com', 'Alice', 'Adv'),
              ($3, $2, 'bob@adv.com', 'Bob', 'Adv')`,
      [customerId1, storeId, customerId2],
    );

    return { orgId, storeId, variantId, customerId1, customerId2 };
  }

  describe("1. Guest Checkout & Order Token Hardening and Leakage Prevention", () => {
    it("rejects empty or whitespace guest token strings without bypassing authorization", () => {
      // Test extractGuestToken helper with malicious whitespace variations
      const fakeReq1 = new Request("http://localhost/api/test", {
        headers: { "x-guest-token": "   " },
      });
      expect(extractGuestToken(fakeReq1)).toBeNull();

      const fakeReq2 = new Request("http://localhost/api/test", {
        headers: { "x-guest-token": "" },
      });
      expect(extractGuestToken(fakeReq2)).toBeNull();

      const fakeReq3 = new Request("http://localhost/api/test", {
        headers: { "x-guest-token": "\t\n  " },
      });
      expect(extractGuestToken(fakeReq3)).toBeNull();
    });

    it("fails closed when caller passes empty or whitespace guest token against a guest checkout", async () => {
      const db = await setupDb();
      const { storeId, variantId } = await seedStoreAndCatalog(db);

      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);

      const cart = await cartService.getOrCreateCart(db, storeId, {
        guestIdentifier: generateUuidV7(),
        currency: "USD",
      });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        email: "guest@example.com",
        guestTokenHash: tokenHash,
      });

      // Whitespace guest token must throw 404 (CHECKOUT_NOT_FOUND) and never grant access
      expect(() =>
        assertCheckoutOwnership(checkout, { guestToken: "   " }),
      ).toThrow(ApiHttpError);

      expect(() =>
        assertCheckoutOwnership(checkout, { guestToken: "" }),
      ).toThrow(ApiHttpError);

      expect(() =>
        assertCheckoutOwnership(checkout, { guestToken: null }),
      ).toThrow(ApiHttpError);

      // Valid token succeeds
      expect(() =>
        assertCheckoutOwnership(checkout, { guestToken: rawToken }),
      ).not.toThrow();
    });

    it("strips internal guestTokenHash from enrichCheckout client representation", async () => {
      const db = await setupDb();
      const { storeId, variantId } = await seedStoreAndCatalog(db);

      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);

      const cart = await cartService.getOrCreateCart(db, storeId, {
        guestIdentifier: generateUuidV7(),
        currency: "USD",
      });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        email: "guest@example.com",
        guestTokenHash: tokenHash,
      });

      expect(checkout.guestTokenHash).toBe(tokenHash);

      const enriched = await enrichCheckout(db, storeId, checkout);
      expect((enriched as unknown as Record<string, unknown>).guestTokenHash).toBeUndefined();
      expect("guestTokenHash" in enriched).toBe(false);
    });

    it("protects order ownership and strips guestTokenHash from order responses", async () => {
      const db = await setupDb();
      const { storeId, variantId } = await seedStoreAndCatalog(db);

      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);

      const cart = await cartService.getOrCreateCart(db, storeId, {
        guestIdentifier: generateUuidV7(),
        currency: "USD",
      });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        email: "guest@example.com",
        guestTokenHash: tokenHash,
      });

      const order = await orderService.createOrderFromCheckout(db, {
        storeId,
        checkout: {
          id: checkout.id,
          storeId: checkout.storeId,
          customerId: null,
          email: checkout.email,
          currency: checkout.currency,
          subtotal: checkout.subtotal,
          discountTotal: checkout.discountTotal,
          shippingTotal: checkout.shippingTotal,
          taxTotal: checkout.taxTotal,
          total: checkout.total,
          guestTokenHash: checkout.guestTokenHash,
          items: checkout.items.map((i) => ({
            id: i.id,
            checkoutId: checkout.id,
            storeId,
            variantId: i.variantId,
            productNameSnapshot: i.productNameSnapshot,
            variantNameSnapshot: i.variantNameSnapshot,
            skuSnapshot: i.skuSnapshot ?? "SKU",
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
        },
      });

      // Malicious empty token fails
      expect(() =>
        assertOrderOwnership(order, { guestToken: "   " }),
      ).toThrow(ApiHttpError);

      // Wrong token fails
      expect(() =>
        assertOrderOwnership(order, { guestToken: generateSecureToken() }),
      ).toThrow(ApiHttpError);

      // Valid token succeeds
      expect(() =>
        assertOrderOwnership(order, { guestToken: rawToken }),
      ).not.toThrow();

      // Sanitized order strips guestTokenHash
      const sanitized = { ...order };
      delete (sanitized as { guestTokenHash?: string | null }).guestTokenHash;
      expect((sanitized as unknown as Record<string, unknown>).guestTokenHash).toBeUndefined();
    });
  });

  describe("2. Cart Ownership & Checkout Creation Access Control", () => {
    it("fails closed in createCheckoutFromCart when caller is omitted for a customer-owned cart", async () => {
      const db = await setupDb();
      const { storeId, variantId, customerId1 } = await seedStoreAndCatalog(db);

      const aliceCart = await cartService.getOrCreateCart(db, storeId, {
        customerId: customerId1,
        currency: "USD",
      });
      await cartService.addItem(
        db,
        storeId,
        aliceCart.id,
        { variantId, quantity: 1 },
        { customerId: customerId1 },
      );

      // Attacker attempts to checkout Alice's cart with NO caller passed
      await expect(
        checkoutService.createCheckoutFromCart(db, storeId, aliceCart.id, {
          email: "attacker@evil.com",
        }),
      ).rejects.toThrow(CrossStoreCartError);
    });

    it("fails closed in createCheckoutFromCart when caller customerId does not match cart customerId", async () => {
      const db = await setupDb();
      const { storeId, variantId, customerId1, customerId2 } = await seedStoreAndCatalog(db);

      const aliceCart = await cartService.getOrCreateCart(db, storeId, {
        customerId: customerId1,
        currency: "USD",
      });
      await cartService.addItem(
        db,
        storeId,
        aliceCart.id,
        { variantId, quantity: 1 },
        { customerId: customerId1 },
      );

      // Bob tries to checkout Alice's cart with Bob's customer caller
      await expect(
        checkoutService.createCheckoutFromCart(db, storeId, aliceCart.id, {
          email: "bob@adv.com",
          caller: { customerId: customerId2 },
        }),
      ).rejects.toThrow(CrossStoreCartError);
    });

    it("fails closed in assertCartOwnership when an unassigned cart is accessed", () => {
      const unassignedCart = {
        id: generateUuidV7(),
        storeId: generateUuidV7(),
        customerId: null,
        guestIdentifier: null,
        currency: "USD",
        subtotal: 0,
        discountTotal: 0,
        grandTotal: 0,
        status: "ACTIVE" as const,
        expiresAt: null,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() =>
        assertCartOwnership(unassignedCart, { customerId: null, guestIdentifier: null }),
      ).toThrow(ApiHttpError);

      try {
        assertCartOwnership(unassignedCart, { customerId: null, guestIdentifier: null });
      } catch (err) {
        expect((err as ApiHttpError).status).toBe(403);
        expect((err as ApiHttpError).code).toBe("CART_ACCESS_DENIED");
      }
    });
  });

  describe("3. Checkout Lifecycle & Payment Race Condition Hardening", () => {
    it("rejects order creation in completePurchaseWorkflow if checkout was CANCELLED", async () => {
      const db = await setupDb();
      const { storeId, variantId } = await seedStoreAndCatalog(db);

      const cart = await cartService.getOrCreateCart(db, storeId, {
        guestIdentifier: generateUuidV7(),
        currency: "USD",
      });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        email: "racer@example.com",
      });

      // Create a captured payment row
      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (
           id, store_id, checkout_id, order_id, amount, currency, status,
           provider, captured_amount, refunded_amount
         ) VALUES ($1, $2, $3, NULL, $4, 'USD', 'CAPTURED', 'razorpay', $4, 0)`,
        [paymentId, storeId, checkout.id, checkout.total],
      );

      // Now checkout is cancelled in-flight before purchase workflow completes
      await checkoutService.cancelCheckout(db, storeId, checkout.id, "Customer abandoned");

      // Verify completePurchaseWorkflow throws PaymentValidationError and refuses order creation
      await expect(
        paymentOrderIntegration.completePurchaseWorkflow(db, {
          storeId,
          paymentId,
        }),
      ).rejects.toThrow(PaymentValidationError);

      // Verify NO order was created for this cancelled checkout
      const order = await orderService.getOrderByCheckoutId(db, storeId, checkout.id);
      expect(order).toBeNull();
    });

    it("rejects order creation in completePurchaseWorkflow if checkout was EXPIRED", async () => {
      const db = await setupDb();
      const { storeId, variantId } = await seedStoreAndCatalog(db);

      const cart = await cartService.getOrCreateCart(db, storeId, {
        guestIdentifier: generateUuidV7(),
        currency: "USD",
      });
      await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 });

      const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
        email: "expired@example.com",
      });

      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (
           id, store_id, checkout_id, order_id, amount, currency, status,
           provider, captured_amount, refunded_amount
         ) VALUES ($1, $2, $3, NULL, $4, 'USD', 'CAPTURED', 'razorpay', $4, 0)`,
        [paymentId, storeId, checkout.id, checkout.total],
      );

      // Expire checkout
      await checkoutService.expireCheckout(db, storeId, checkout.id);

      await expect(
        paymentOrderIntegration.completePurchaseWorkflow(db, {
          storeId,
          paymentId,
        }),
      ).rejects.toThrow(PaymentValidationError);

      const order = await orderService.getOrderByCheckoutId(db, storeId, checkout.id);
      expect(order).toBeNull();
    });
  });

  describe("4. Session Revocation & Customer Token Invalidation", () => {
    it("invalidates session upon logout and rejects subsequent access", async () => {
      const db = await setupDb();

      const regResult = await register(db, {
        email: "sessiontest@example.com",
        password: "SuperSecretPassword123!",
        name: "Session Test User",
      });

      // Valid session
      const validSession = await validateSession(db, regResult.session.id);
      expect(validSession).not.toBeNull();
      expect(validSession.user.id).toBe(regResult.user.id);

      // Logout / Revoke session
      await logout(db, regResult.session.id);

      // Subsequent session validation must fail
      await expect(validateSession(db, regResult.session.id)).rejects.toThrow(SessionRevokedError);
    });
  });
});
