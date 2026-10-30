import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { CheckoutService } from "@calcart/checkout";
import { OrderService } from "@calcart/orders";
import { CartService } from "@calcart/carts";
import { hashToken } from "@calcart/auth";
import type { CustomerDTO } from "@calcart/customers";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  assertCheckoutOwnership,
  assertOrderOwnership,
  generateSecureToken,
} from "../../apps/web/src/lib/storefront-auth-helpers.js";
import { ApiHttpError } from "../../apps/web/src/lib/api/errors.js";

function makeMockCustomer(id: string, storeId: string, email: string): CustomerDTO {
  return {
    id,
    storeId,
    userId: null,
    email,
    firstName: null,
    lastName: null,
    phone: null,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Checkout and Order Authorization Security Tests", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const checkoutService = new CheckoutService();
  const orderService = new OrderService();
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

  async function seedStoreAndCatalog(
    db: Database,
    slug = "auth-store",
  ): Promise<{
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

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Security Org', 'ACTIVE')`, [orgId]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Security Store', $3, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, slug],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Security Item', 'sec-item', 'ACTIVE')`,
      [productId, storeId],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, position)
       VALUES ($1, $2, $3, 'Default Variant', 'SEC-01', 5000, 1)`,
      [variantId, productId, storeId],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 100, 0)`,
      [generateUuidV7(), storeId, variantId],
    );

    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'alice@example.com', 'Alice', 'Smith'),
              ($3, $2, 'bob@example.com', 'Bob', 'Jones')`,
      [customerId1, storeId, customerId2],
    );

    return { storeId, variantId, customerId1, customerId2 };
  }

  it("blocks unauthorized access to another customer's checkout UUID (never treats UUID as auth proof)", async () => {
    const db = await setupDb();
    const { storeId, variantId, customerId1, customerId2 } = await seedStoreAndCatalog(db);

    // Customer 1 creates a cart and checkout
    const cart = await cartService.getOrCreateCart(db, storeId, { customerId: customerId1, currency: "USD" });
    await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 }, { customerId: customerId1 });

    const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
      customerId: customerId1,
      email: "alice@example.com",
      caller: { customerId: customerId1 },
    });

    // Customer 1 accessing their own checkout succeeds
    expect(() =>
      assertCheckoutOwnership(checkout, {
        customer: makeMockCustomer(customerId1, storeId, "alice@example.com"),
      }),
    ).not.toThrow();

    // Customer 2 (or an attacker guessing checkout UUID) is rejected with 404 (ID enumeration prevention)
    expect(() =>
      assertCheckoutOwnership(checkout, {
        customer: makeMockCustomer(customerId2, storeId, "bob@example.com"),
      }),
    ).toThrow(ApiHttpError);

    try {
      assertCheckoutOwnership(checkout, {
        customer: makeMockCustomer(customerId2, storeId, "bob@example.com"),
      });
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        expect(err.status).toBe(404);
        expect(err.code).toBe("CHECKOUT_NOT_FOUND");
      } else {
        throw err;
      }
    }

    // Anonymous caller without guest token is rejected with 404
    expect(() =>
      assertCheckoutOwnership(checkout, {
        customer: null,
        guestToken: null,
      }),
    ).toThrow(ApiHttpError);
  });

  it("protects guest checkout access via high-entropy token and rejects missing or invalid tokens", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await seedStoreAndCatalog(db);

    const guestId = "guest_session_12345";
    const cart = await cartService.getOrCreateCart(db, storeId, { guestIdentifier: guestId, currency: "USD" });
    await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 2 }, { guestIdentifier: guestId });

    // Generate high-entropy guest ownership token
    const rawGuestToken = generateSecureToken();
    const guestTokenHash = hashToken(rawGuestToken);

    const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
      customerId: null,
      email: "guest@example.com",
      guestTokenHash,
      caller: { guestIdentifier: guestId },
    });

    expect(checkout.guestTokenHash).toBe(guestTokenHash);

    // Guest with correct raw token matches the stored token hash and succeeds
    expect(() =>
      assertCheckoutOwnership(checkout, {
        customer: null,
        guestToken: rawGuestToken,
      }),
    ).not.toThrow();

    // Guest with missing token is rejected
    expect(() =>
      assertCheckoutOwnership(checkout, {
        customer: null,
        guestToken: null,
      }),
    ).toThrow(ApiHttpError);

    // Guest with invalid / forged token is rejected
    expect(() =>
      assertCheckoutOwnership(checkout, {
        customer: null,
        guestToken: "wrong-fake-token-12345",
      }),
    ).toThrow(ApiHttpError);
  });

  it("blocks cross-store checkout access and prevents cross-customer cart checkout creation", async () => {
    const db = await setupDb();
    const storeA = await seedStoreAndCatalog(db, "store-a");
    const storeB = await seedStoreAndCatalog(db, "store-b");

    // Alice creates cart in Store A
    const cartA = await cartService.getOrCreateCart(db, storeA.storeId, {
      customerId: storeA.customerId1,
      currency: "USD",
    });
    await cartService.addItem(db, storeA.storeId, cartA.id, { variantId: storeA.variantId, quantity: 1 }, { customerId: storeA.customerId1 });

    // Store B cannot create checkout from Store A's cart
    await expect(
      checkoutService.createCheckoutFromCart(db, storeB.storeId, cartA.id, {
        customerId: storeB.customerId1,
        caller: { customerId: storeB.customerId1 },
      }),
    ).rejects.toThrow();

    // Bob cannot checkout Alice's cart in Store A
    await expect(
      checkoutService.createCheckoutFromCart(db, storeA.storeId, cartA.id, {
        customerId: storeA.customerId2,
        caller: { customerId: storeA.customerId2 },
      }),
    ).rejects.toThrow();
  });

  it("enforces order ownership and prevents unauthorized access to customer PII and totals", async () => {
    const db = await setupDb();
    const { storeId, variantId, customerId1, customerId2 } = await seedStoreAndCatalog(db);

    const rawGuestToken = generateSecureToken();
    const guestTokenHash = hashToken(rawGuestToken);

    // Create a cart and checkout first to satisfy foreign key constraint
    const cart = await cartService.getOrCreateCart(db, storeId, { customerId: customerId1, currency: "USD" });
    await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 }, { customerId: customerId1 });

    const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
      customerId: customerId1,
      email: "alice@example.com",
      guestTokenHash,
      caller: { customerId: customerId1 },
    });

    // Create an order for Customer 1
    const orderRow = await orderService.createOrderFromCheckout(db, {
      storeId,
      checkout: {
        id: checkout.id,
        storeId,
        customerId: customerId1,
        email: "alice@example.com",
        currency: "USD",
        subtotal: checkout.subtotal,
        discountTotal: checkout.discountTotal,
        shippingTotal: checkout.shippingTotal,
        taxTotal: checkout.taxTotal,
        total: checkout.total,
        guestTokenHash,
        items: [
          {
            id: generateUuidV7(),
            checkoutId: checkout.id,
            storeId,
            variantId,
            productNameSnapshot: "Security Item",
            variantNameSnapshot: "Default Variant",
            skuSnapshot: "SEC-01",
            unitPrice: 5000,
            quantity: 1,
            lineTotal: 5000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });

    const orderDTO = await orderService.getOrderById(db, storeId, orderRow.id);
    expect(orderDTO).not.toBeNull();
    expect(orderDTO!.guestTokenHash).toBe(guestTokenHash);

    // Customer 1 can read their order
    expect(() =>
      assertOrderOwnership(orderDTO!, {
        customer: makeMockCustomer(customerId1, storeId, "alice@example.com"),
      }),
    ).not.toThrow();

    // Customer 2 cannot read Customer 1's order (throws 404 to protect customer PII)
    expect(() =>
      assertOrderOwnership(orderDTO!, {
        customer: makeMockCustomer(customerId2, storeId, "bob@example.com"),
      }),
    ).toThrow(ApiHttpError);

    // Guest with valid guestToken can read guest order
    expect(() =>
      assertOrderOwnership(orderDTO!, {
        guestToken: rawGuestToken,
      }),
    ).not.toThrow();

    // Guest with forged token is blocked
    expect(() =>
      assertOrderOwnership(orderDTO!, {
        guestToken: "wrong-guest-token",
      }),
    ).toThrow(ApiHttpError);
  });

  it("prevents mutation of completed or cancelled checkouts", async () => {
    const db = await setupDb();
    const { storeId, variantId, customerId1 } = await seedStoreAndCatalog(db);

    const cart = await cartService.getOrCreateCart(db, storeId, { customerId: customerId1, currency: "USD" });
    await cartService.addItem(db, storeId, cart.id, { variantId, quantity: 1 }, { customerId: customerId1 });

    const checkout = await checkoutService.createCheckoutFromCart(db, storeId, cart.id, {
      customerId: customerId1,
      caller: { customerId: customerId1 },
    });

    // Cancel the checkout
    await checkoutService.cancelCheckout(db, storeId, checkout.id);

    const cancelledCheckout = await checkoutService.getCheckout(db, storeId, checkout.id);
    expect(cancelledCheckout.status).toBe("CANCELLED");

    // Address updates on cancelled checkout are rejected
    await expect(
      checkoutService.updateAddresses(db, storeId, checkout.id, {
        shippingAddress: {
          addressLine1: "123 Main St",
          city: "Metropolis",
          postalCode: "10001",
          country: "US",
        },
        billingAddress: {
          addressLine1: "123 Main St",
          city: "Metropolis",
          postalCode: "10001",
          country: "US",
        },
      }),
    ).rejects.toThrow();
  });
});
