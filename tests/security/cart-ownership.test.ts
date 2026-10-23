import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { CartAccessDeniedError, CartService } from "@shopify-clone/carts";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { assertCartOwnership } from "../../apps/web/src/lib/storefront-auth-helpers.js";
import { ApiHttpError } from "../../apps/web/src/lib/api/errors.js";

describe("Cart Ownership and Merging Security Tests", { timeout: 30_000 }, () => {
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

  async function seedStoreAndCatalog(
    db: Database,
    slug = "cart-security-store",
  ): Promise<{
    storeId: string;
    variantId1: string;
    variantId2: string;
    customerId1: string;
    customerId2: string;
  }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId1 = generateUuidV7();
    const variantId2 = generateUuidV7();
    const customerId1 = generateUuidV7();
    const customerId2 = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Cart Org', 'ACTIVE')`, [orgId]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Cart Store', $3, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, slug],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Product Alpha', 'prod-alpha', 'ACTIVE')`,
      [productId, storeId],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, position)
       VALUES ($1, $2, $3, 'Variant A', 'VAR-A', 2500, 1),
              ($4, $2, $3, 'Variant B', 'VAR-B', 4000, 2)`,
      [variantId1, productId, storeId, variantId2],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 100, 0),
              ($4, $2, $5, 100, 0)`,
      [generateUuidV7(), storeId, variantId1, generateUuidV7(), variantId2],
    );

    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'alice@cart.com', 'Alice', 'Cart'),
              ($3, $2, 'bob@cart.com', 'Bob', 'Cart')`,
      [customerId1, storeId, customerId2],
    );

    return { storeId, variantId1, variantId2, customerId1, customerId2 };
  }

  it("never authorizes cart access solely through an arbitrary client-supplied cartId", async () => {
    const db = await setupDb();
    const { storeId, variantId1, customerId1, customerId2 } = await seedStoreAndCatalog(db);

    // Alice creates cart
    const aliceCart = await cartService.getOrCreateCart(db, storeId, {
      customerId: customerId1,
      currency: "USD",
    });
    await cartService.addItem(db, storeId, aliceCart.id, { variantId: variantId1, quantity: 1 }, { customerId: customerId1 });

    // Alice can access her cart
    const aliceAccess = await cartService.getCart(db, storeId, aliceCart.id, {
      customerId: customerId1,
    });
    expect(aliceAccess.id).toBe(aliceCart.id);
    expect(() => assertCartOwnership(aliceAccess, { customerId: customerId1 })).not.toThrow();

    // Bob cannot access Alice's cart using her cartId
    await expect(
      cartService.getCart(db, storeId, aliceCart.id, { customerId: customerId2 }),
    ).rejects.toThrow(CartAccessDeniedError);

    expect(() =>
      assertCartOwnership(aliceCart, { customerId: customerId2 }),
    ).toThrow(ApiHttpError);

    // Anonymous caller cannot access Alice's customer cart
    await expect(
      cartService.getCart(db, storeId, aliceCart.id, { guestIdentifier: "anonymous_attacker" }),
    ).rejects.toThrow(CartAccessDeniedError);

    expect(() =>
      assertCartOwnership(aliceCart, { guestIdentifier: "anonymous_attacker" }),
    ).toThrow(ApiHttpError);
  });

  it("binds guest carts to verified guest session and prevents cross-guest cart mutation", async () => {
    const db = await setupDb();
    const { storeId, variantId1, variantId2 } = await seedStoreAndCatalog(db);

    const guest1 = "guest_session_aaa";
    const guest2 = "guest_session_bbb";

    const cart1 = await cartService.getOrCreateCart(db, storeId, {
      guestIdentifier: guest1,
      currency: "USD",
    });
    await cartService.addItem(db, storeId, cart1.id, { variantId: variantId1, quantity: 1 }, { guestIdentifier: guest1 });

    // Guest 1 can access cart1
    const fetched = await cartService.getCart(db, storeId, cart1.id, { guestIdentifier: guest1 });
    expect(fetched.id).toBe(cart1.id);

    // Guest 2 cannot read Guest 1's cart
    await expect(
      cartService.getCart(db, storeId, cart1.id, { guestIdentifier: guest2 }),
    ).rejects.toThrow(CartAccessDeniedError);

    // Guest 2 cannot add items to Guest 1's cart
    await expect(
      cartService.addItem(db, storeId, cart1.id, { variantId: variantId2, quantity: 1 }, { guestIdentifier: guest2 }),
    ).rejects.toThrow(CartAccessDeniedError);

    // Guest 2 cannot clear Guest 1's cart
    await expect(
      cartService.clearCart(db, storeId, cart1.id, { guestIdentifier: guest2 }),
    ).rejects.toThrow(CartAccessDeniedError);
  });

  it("merges guest cart during login without crossing customer or store boundaries", async () => {
    const db = await setupDb();
    const storeA = await seedStoreAndCatalog(db, "store-alpha");
    const storeB = await seedStoreAndCatalog(db, "store-beta");

    const guestId = "guest_returning_customer";

    // Guest creates a cart with Variant 1 in Store A
    const guestCart = await cartService.getOrCreateCart(db, storeA.storeId, {
      guestIdentifier: guestId,
      currency: "USD",
    });
    await cartService.addItem(
      db,
      storeA.storeId,
      guestCart.id,
      { variantId: storeA.variantId1, quantity: 2 },
      { guestIdentifier: guestId },
    );

    // Alice also has an existing active cart with Variant 2 in Store A
    const aliceCart = await cartService.getOrCreateCart(db, storeA.storeId, {
      customerId: storeA.customerId1,
      currency: "USD",
    });
    await cartService.addItem(
      db,
      storeA.storeId,
      aliceCart.id,
      { variantId: storeA.variantId2, quantity: 1 },
      { customerId: storeA.customerId1 },
    );

    // Alice logs in: mergeCart is invoked
    const mergedCart = await cartService.mergeCart(
      db,
      storeA.storeId,
      guestId,
      storeA.customerId1,
    );

    expect(mergedCart).not.toBeNull();
    expect(mergedCart!.customerId).toBe(storeA.customerId1);
    expect(mergedCart!.items.length).toBe(2);

    // The guest cart is now CONVERTED and no longer active
    const staleGuest = await cartService.getActiveCartForGuest(db, storeA.storeId, guestId);
    expect(staleGuest).toBeNull();

    // Verify store isolation: merging in Store B does not affect Store A or pull guest items
    const mergedStoreB = await cartService.mergeCart(
      db,
      storeB.storeId,
      guestId,
      storeB.customerId1,
    );
    expect(mergedStoreB.items.length).toBe(0);
  });
});
