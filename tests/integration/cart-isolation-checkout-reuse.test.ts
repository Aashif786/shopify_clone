import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { CartService } from "@calcart/carts";
import { CheckoutService } from "@calcart/checkout";
import { PaymentOrderIntegration } from "../../modules/payments/src/index.js";

describe("Cart Isolation, Checkout Session, and Order Reuse", { timeout: 35_000 }, () => {
  let close: (() => Promise<void>) | undefined;

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
    slug = "test-store",
    currency = "USD",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug, currency],
    );
    return { orgId, storeId };
  }

  async function seedCustomer(
    db: Database,
    storeId: string,
    email = "customer@example.com",
  ): Promise<{ customerId: string }> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name, status)
       VALUES ($1, $2, $3, 'John', 'Doe', 'ACTIVE')`,
      [customerId, storeId, email],
    );
    return { customerId };
  }

  async function seedProducts(
    db: Database,
    storeId: string,
  ): Promise<{ p1VariantId: string; p2VariantId: string }> {
    const prod1Id = generateUuidV7();
    const p1VariantId = generateUuidV7();
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'T-Shirt', 't-shirt', 'ACTIVE')`,
      [prod1Id, storeId],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Blue / L', 'TSHIRT-BLU-L', 2000, 'USD', 'ACTIVE')`,
      [p1VariantId, prod1Id, storeId],
    );
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 10, 0)`,
      [generateUuidV7(), storeId, p1VariantId],
    );

    const prod2Id = generateUuidV7();
    const p2VariantId = generateUuidV7();
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Jeans', 'jeans', 'ACTIVE')`,
      [prod2Id, storeId],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Slim Fit 32', 'JEANS-SLIM-32', 5000, 'USD', 'ACTIVE')`,
      [p2VariantId, prod2Id, storeId],
    );
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 10, 0)`,
      [generateUuidV7(), storeId, p2VariantId],
    );

    return { p1VariantId, p2VariantId };
  }

  it("transitions cart to CONVERTED upon order completion and gives customer a clean new cart on next visit", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { customerId } = await seedCustomer(db, storeId);
    const { p1VariantId, p2VariantId } = await seedProducts(db, storeId);

    const cartService = new CartService();
    const checkoutService = new CheckoutService();
    const paymentOrderIntegration = new PaymentOrderIntegration();

    // 1. Customer signs in and creates cart
    const cart1 = await cartService.getOrCreateCart(db, storeId, {
      customerId,
      currency: "USD",
    });

    // 2. Add product 1 to cart
    await cartService.addItem(
      db,
      storeId,
      cart1.id,
      { variantId: p1VariantId, quantity: 1 },
      { customerId },
    );

    // 3. Create checkout from cart
    const checkout1 = await checkoutService.createCheckoutFromCart(
      db,
      storeId,
      cart1.id,
      {
        customerId,
        email: "customer@example.com",
        shippingAddress: {
          firstName: "John",
          lastName: "Doe",
          addressLine1: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
      },
    );

    // Transition checkout to PAYMENT_PENDING as payment is initiated
    await db.query(
      `UPDATE checkouts SET status = 'PAYMENT_PENDING' WHERE id = $1`,
      [checkout1.id],
    );

    // Seed mock payment captured
    const paymentId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, provider, captured_amount)
       VALUES ($1, $2, $3, 2000, 'USD', 'CAPTURED', 'RAZORPAY', 2000)`,
      [paymentId, storeId, checkout1.id],
    );

    // 4. Complete purchase workflow
    const purchaseResult = await paymentOrderIntegration.completePurchaseWorkflow(db, {
      storeId,
      paymentId,
    });

    expect(purchaseResult.orderCreated).toBe(true);
    expect(purchaseResult.checkout.status).toBe("COMPLETED");

    // Check cart status in DB: MUST be CONVERTED!
    const cartAfterPurchase = await cartService.getCart(db, storeId, cart1.id, { customerId });
    expect(cartAfterPurchase.status).toBe("CONVERTED");

    // Check getActiveCartForCustomer: MUST return null/undefined because previous cart is converted!
    const activeCart = await cartService.getActiveCartForCustomer(db, storeId, customerId);
    expect(activeCart).toBeNull();

    // Next shopping session: customer returns and adds Product 2:
    const newCart = await cartService.getOrCreateCart(db, storeId, { customerId });
    expect(newCart.id).not.toBe(cart1.id);
    expect(newCart.status).toBe("ACTIVE");
    expect(newCart.items.length).toBe(0);

    await cartService.addItem(
      db,
      storeId,
      newCart.id,
      { variantId: p2VariantId, quantity: 1 },
      { customerId },
    );

    const cartWithNewItem = await cartService.getCart(db, storeId, newCart.id, { customerId });
    expect(cartWithNewItem.items.length).toBe(1);
    expect(cartWithNewItem.items[0]?.variantId).toBe(p2VariantId);
    // Product 1 must NOT be in the new cart!
    expect(cartWithNewItem.items.some((i) => i.variantId === p1VariantId)).toBe(false);

    // In step 3, customer opens checkout:
    const checkout2 = await checkoutService.createCheckoutFromCart(
      db,
      storeId,
      newCart.id,
      { customerId, email: "customer@example.com" },
    );
    expect(checkout2.id).not.toBe(checkout1.id);
    expect(checkout2.status).toBe("OPEN");
    expect(checkout2.items.length).toBe(1);
    expect(checkout2.items[0]?.variantId).toBe(p2VariantId);
    expect(checkout2.total).toBe(5000);
  });

  it("cancels stale open checkout and creates fresh checkout when cart items change", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { customerId } = await seedCustomer(db, storeId);
    const { p1VariantId, p2VariantId } = await seedProducts(db, storeId);

    const cartService = new CartService();
    const checkoutService = new CheckoutService();

    // 1. Customer creates cart and adds both Product 1 and Product 2
    const cart = await cartService.getOrCreateCart(db, storeId, {
      customerId,
      currency: "USD",
    });

    await cartService.addItem(
      db,
      storeId,
      cart.id,
      { variantId: p1VariantId, quantity: 1 },
      { customerId },
    );
    await cartService.addItem(
      db,
      storeId,
      cart.id,
      { variantId: p2VariantId, quantity: 1 },
      { customerId },
    );

    // 2. Customer creates checkout: has [p1VariantId, p2VariantId]
    const checkoutInitial = await checkoutService.createCheckoutFromCart(
      db,
      storeId,
      cart.id,
      { customerId, email: "customer@example.com" },
    );
    expect(checkoutInitial.status).toBe("OPEN");
    expect(checkoutInitial.items.length).toBe(2);
    expect(checkoutInitial.total).toBe(7000); // 2000 + 5000

    // 3. Customer goes back to cart and removes Product 1
    await cartService.removeItem(db, storeId, cart.id, p1VariantId, { customerId });
    const cartAfterRemoval = await cartService.getCart(db, storeId, cart.id, { customerId });
    expect(cartAfterRemoval.items.length).toBe(1);
    expect(cartAfterRemoval.items[0]?.variantId).toBe(p2VariantId);

    // 4. Customer proceeds to checkout again:
    const checkoutFresh = await checkoutService.createCheckoutFromCart(
      db,
      storeId,
      cart.id,
      { customerId, email: "customer@example.com" },
    );

    // The stale initial checkout must be cancelled!
    const staleCheckoutInDb = await checkoutService.getCheckout(db, storeId, checkoutInitial.id);
    expect(staleCheckoutInDb.status).toBe("CANCELLED");

    // The fresh checkout must have a new ID and contain ONLY Product 2!
    expect(checkoutFresh.id).not.toBe(checkoutInitial.id);
    expect(checkoutFresh.status).toBe("OPEN");
    expect(checkoutFresh.items.length).toBe(1);
    expect(checkoutFresh.items[0]?.variantId).toBe(p2VariantId);
    expect(checkoutFresh.total).toBe(5000);
  });

  it("reuses existing checkout when cart items and quantities have not changed", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { customerId } = await seedCustomer(db, storeId);
    const { p1VariantId } = await seedProducts(db, storeId);

    const cartService = new CartService();
    const checkoutService = new CheckoutService();

    const cart = await cartService.getOrCreateCart(db, storeId, {
      customerId,
      currency: "USD",
    });

    await cartService.addItem(
      db,
      storeId,
      cart.id,
      { variantId: p1VariantId, quantity: 2 },
      { customerId },
    );

    const checkout1 = await checkoutService.createCheckoutFromCart(
      db,
      storeId,
      cart.id,
      { customerId, email: "customer@example.com" },
    );

    // Call createCheckoutFromCart again without modifying cart items
    const checkout2 = await checkoutService.createCheckoutFromCart(
      db,
      storeId,
      cart.id,
      { customerId, email: "customer@example.com" },
    );

    expect(checkout2.id).toBe(checkout1.id);
    expect(checkout2.status).toBe("OPEN");
    expect(checkout2.items[0]?.quantity).toBe(2);
  });
});
