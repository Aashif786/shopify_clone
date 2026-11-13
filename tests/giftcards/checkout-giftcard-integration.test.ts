import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { CheckoutService } from "@calcart/checkout";
import {
  GiftCardCurrencyMismatchError,
  GiftCardDepletedError,
  GiftCardExpiredError,
  GiftCardNotFoundError,
  GiftCardService,
} from "@calcart/giftcards";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Stored-Value Instruments: Checkout & Order Integration (GAP-14)", { timeout: 120_000 }, () => {
  let db: Database;
  let close: (() => Promise<void>) | undefined;
  const checkoutService = new CheckoutService();
  const giftCardService = new GiftCardService();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  }, 120_000);

  afterAll(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedStore(slug = `sc-${generateUuidV7().slice(-8)}`) {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return storeId;
  }

  async function seedCheckoutWithItems(storeId: string, itemTotal = 5000) {
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO carts (id, store_id, status, currency, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'INR', NOW(), NOW())`,
      [cartId, storeId],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status, created_at, updated_at)
       VALUES ($1, $2, 'Test Product', $3, 'ACTIVE', NOW(), NOW())`,
      [productId, storeId, `prod-${generateUuidV7().slice(-6)}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, store_id, product_id, title, sku, price, created_at, updated_at)
       VALUES ($1, $2, $3, 'Default Variant', 'SKU-TEST', $4, NOW(), NOW())`,
      [variantId, storeId, productId, itemTotal],
    );

    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, status, currency, subtotal, discount_total, tax_total, shipping_total, total, payment_status, created_at, updated_at)
       VALUES ($1, $2, $3, 'OPEN', 'INR', $4, 0, 0, 0, $4, 'PENDING', NOW(), NOW())`,
      [checkoutId, storeId, cartId, itemTotal],
    );

    await db.query(
      `INSERT INTO checkout_items (id, checkout_id, store_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Test Product', 'Default Variant', 'SKU-TEST', $5, 1, $5, NOW(), NOW())`,
      [generateUuidV7(), checkoutId, storeId, variantId, itemTotal],
    );

    return { checkoutId, cartId, variantId };
  }

  it("applies a gift card partially reducing checkout net payable total", async () => {
    const storeId = await seedStore();
    const { checkoutId } = await seedCheckoutWithItems(storeId, 5000);

    const giftCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 2000,
      currency: "INR",
    });

    const updated = await checkoutService.applyGiftCard(db, storeId, checkoutId, giftCard.code);

    expect(updated.subtotal).toBe(5000);
    expect(updated.giftCardTotal).toBe(2000);
    expect(updated.total).toBe(3000);
    expect(updated.appliedGiftCards).toHaveLength(1);
    expect(updated.appliedGiftCards![0].appliedAmount).toBe(2000);
    expect(updated.appliedGiftCards![0].codeLast4).toBe(giftCard.code.slice(-4));
  });

  it("caps applied amount when gift card balance exceeds checkout total", async () => {
    const storeId = await seedStore();
    const { checkoutId } = await seedCheckoutWithItems(storeId, 3000);

    const giftCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 10000,
      currency: "INR",
    });

    const updated = await checkoutService.applyGiftCard(db, storeId, checkoutId, giftCard.code);

    // Only 3000 needed to cover the checkout
    expect(updated.subtotal).toBe(3000);
    expect(updated.giftCardTotal).toBe(3000);
    expect(updated.total).toBe(0);
    expect(updated.appliedGiftCards![0].appliedAmount).toBe(3000);

    // Gift card balance on card remains unchanged until order completion
    const cardLookup = await giftCardService.getGiftCardById(db, storeId, giftCard.id);
    expect(cardLookup.currentBalance).toBe(10000);
  });

  it("stacks multiple gift cards on a single checkout", async () => {
    const storeId = await seedStore();
    const { checkoutId } = await seedCheckoutWithItems(storeId, 7000);

    const card1 = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 3000,
      currency: "INR",
    });
    const card2 = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 3000,
      currency: "INR",
    });

    await checkoutService.applyGiftCard(db, storeId, checkoutId, card1.code);
    const updated = await checkoutService.applyGiftCard(db, storeId, checkoutId, card2.code);

    expect(updated.giftCardTotal).toBe(6000);
    expect(updated.total).toBe(1000);
    expect(updated.appliedGiftCards).toHaveLength(2);
  });

  it("removes an applied gift card and restores checkout total", async () => {
    const storeId = await seedStore();
    const { checkoutId } = await seedCheckoutWithItems(storeId, 5000);

    const card = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 2000,
      currency: "INR",
    });

    await checkoutService.applyGiftCard(db, storeId, checkoutId, card.code);
    const afterRemoval = await checkoutService.removeGiftCard(db, storeId, checkoutId, card.id);

    expect(afterRemoval.giftCardTotal).toBe(0);
    expect(afterRemoval.total).toBe(5000);
    expect(afterRemoval.appliedGiftCards).toHaveLength(0);
  });

  it("rejects invalid, depleted, expired, or wrong currency gift cards", async () => {
    const storeId = await seedStore();
    const { checkoutId } = await seedCheckoutWithItems(storeId, 5000);

    // 1. Invalid code
    await expect(
      checkoutService.applyGiftCard(db, storeId, checkoutId, "GC-FAKE-CODE-1234"),
    ).rejects.toThrow(GiftCardNotFoundError);

    // 2. Depleted card
    const depletedCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 1000,
      currency: "INR",
    });
    await giftCardService.redeemGiftCard(db, storeId, depletedCard.id, {
      amount: 1000,
      currency: "INR",
      idempotencyKey: "deplete-tx-1",
    });
    await expect(
      checkoutService.applyGiftCard(db, storeId, checkoutId, depletedCard.code),
    ).rejects.toThrow(GiftCardDepletedError);

    // 3. Expired card
    const expiredCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 2000,
      currency: "INR",
      expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
    });
    await expect(
      checkoutService.applyGiftCard(db, storeId, checkoutId, expiredCard.code),
    ).rejects.toThrow(GiftCardExpiredError);

    // 4. Currency mismatch
    const usdCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 50,
      currency: "USD",
    });
    await expect(
      checkoutService.applyGiftCard(db, storeId, checkoutId, usdCard.code),
    ).rejects.toThrow(GiftCardCurrencyMismatchError);
  });

  it("enforces tenant isolation preventing cross-store gift card use", async () => {
    const storeA = await seedStore();
    const storeB = await seedStore();
    const { checkoutId } = await seedCheckoutWithItems(storeA, 5000);

    // Card belongs to storeB
    const cardStoreB = await giftCardService.createGiftCard(db, storeB, {
      initialBalance: 2000,
      currency: "INR",
    });

    // Attempting to apply on storeA checkout must fail
    await expect(
      checkoutService.applyGiftCard(db, storeA, checkoutId, cardStoreB.code),
    ).rejects.toThrow(GiftCardNotFoundError);
  });

  it("redeems applied gift cards into order_gift_cards and decrements balances upon order creation", async () => {
    const storeId = await seedStore();
    const { checkoutId } = await seedCheckoutWithItems(storeId, 6000);
    const orderId = generateUuidV7();

    // Create and apply gift card
    const card = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 4000,
      currency: "INR",
    });

    await checkoutService.applyGiftCard(db, storeId, checkoutId, card.code);

    // Seed order row to satisfy foreign key for order_gift_cards
    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, order_number, status, payment_status, currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at)
       VALUES ($1, $2, $3, 'ORD-GC-1', 'PENDING', 'PENDING', 'INR', 6000, 0, 0, 0, 2000, 2000, NOW(), NOW())`,
      [orderId, storeId, checkoutId],
    );

    // Redeem applied gift cards for order
    const result = await giftCardService.redeemCheckoutGiftCardsForOrder(db, {
      storeId,
      checkoutId,
      orderId,
      currency: "INR",
    });

    expect(result.totalRedeemed).toBe(4000);
    expect(result.orderGiftCards).toHaveLength(1);
    expect(result.orderGiftCards[0].amount).toBe(4000);
    expect(result.orderGiftCards[0].codeLast4).toBe(card.code.slice(-4));

    // Verify gift card balance updated in database
    const cardAfter = await giftCardService.getGiftCardById(db, storeId, card.id);
    expect(cardAfter.currentBalance).toBe(0);
    expect(cardAfter.status).toBe("DEPLETED");

    // Verify append-only ledger transactions (ISSUANCE + REDEMPTION)
    const txs = await giftCardService.listGiftCardTransactions(db, storeId, card.id);
    expect(txs).toHaveLength(2);
    expect(txs[0].type).toBe("REDEMPTION");
    expect(txs[0].amount).toBe(-4000);
    expect(txs[0].orderId).toBe(orderId);
    expect(txs[1].type).toBe("ISSUANCE");
    expect(txs[1].amount).toBe(4000);

    // Verify order_gift_cards table record
    const orderCards = await giftCardService.listOrderGiftCards(db, storeId, orderId);
    expect(orderCards).toHaveLength(1);
    expect(orderCards[0].giftCardId).toBe(card.id);
    expect(orderCards[0].amount).toBe(4000);

    // Verify checkout_gift_cards were cleaned up
    const remainingCheckoutCards = await giftCardService.getCheckoutGiftCards(db, storeId, checkoutId);
    expect(remainingCheckoutCards).toHaveLength(0);
  });
});
