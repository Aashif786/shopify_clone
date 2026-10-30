import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import {
  Discount,
  DiscountService,
  DiscountRedemptionService,
  DiscountUsageLimitExceededError,
  CrossStoreDiscountAccessError,
} from "@calcart/discounts";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Discount Domain Usage Invariants (In-Memory Unit Tests)", () => {
  it("enforces usage limit bounds on domain entity", () => {
    const discount = Discount.create({
      storeId: "store_1",
      code: "ONEUSE",
      name: "Single Use",
      type: "PERCENTAGE",
      value: 10,
      usageLimit: 1,
    });

    expect(discount.usageCount).toBe(0);
    expect(discount.hasReachedLimit()).toBe(false);

    discount.incrementUsage();
    expect(discount.usageCount).toBe(1);
    expect(discount.hasReachedLimit()).toBe(true);

    expect(() => discount.incrementUsage()).toThrow(DiscountUsageLimitExceededError);
  });

  it("decrements usage count safely without going below zero", () => {
    const discount = Discount.create({
      storeId: "store_1",
      code: "REVERT",
      name: "Revert Test",
      type: "PERCENTAGE",
      value: 10,
    });

    discount.incrementUsage();
    expect(discount.usageCount).toBe(1);

    discount.decrementUsage();
    expect(discount.usageCount).toBe(0);

    // Decrementing again stays at 0
    discount.decrementUsage();
    expect(discount.usageCount).toBe(0);
  });
});

describe("DiscountRedemptionService PostgreSQL Integration", { timeout: 30_000 }, () => {
  let isPostgresAvailable = false;
  let close: (() => Promise<void>) | undefined;
  const discountService = new DiscountService();
  const redemptionService = new DiscountRedemptionService();

  beforeAll(async () => {
    try {
      const isolated = await createIsolatedDatabase();
      await isolated.close();
      isPostgresAvailable = true;
    } catch {
      isPostgresAvailable = false;
    }
  });

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
    slug = "redemption-store",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org for ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { orgId, storeId };
  }

  it("records a redemption, updates usage count, and enforces usage limit", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "limit-store");

    const discount = await discountService.createDiscount(db, storeId, {
      code: "MAX2",
      name: "Limit 2 Redemptions",
      type: "PERCENTAGE",
      value: 10,
      usageLimit: 2,
    });

    const order1Id = generateUuidV7();
    const order2Id = generateUuidV7();
    const order3Id = generateUuidV7();

    // 1st redemption succeeds
    const red1 = await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId: order1Id,
      amountCents: 1000,
    });
    expect(red1.id).toBeDefined();
    expect(red1.orderId).toBe(order1Id);

    let updatedDiscount = await discountService.getDiscountById(db, storeId, discount.id);
    expect(updatedDiscount?.usageCount).toBe(1);

    // 2nd redemption succeeds
    const red2 = await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId: order2Id,
      amountCents: 1000,
    });
    expect(red2.orderId).toBe(order2Id);

    updatedDiscount = await discountService.getDiscountById(db, storeId, discount.id);
    expect(updatedDiscount?.usageCount).toBe(2);

    // 3rd redemption fails with DiscountUsageLimitExceededError
    await expect(
      redemptionService.recordRedemption(db, {
        discountId: discount.id,
        storeId,
        orderId: order3Id,
        amountCents: 1000,
      }),
    ).rejects.toThrow(DiscountUsageLimitExceededError);

    updatedDiscount = await discountService.getDiscountById(db, storeId, discount.id);
    expect(updatedDiscount?.usageCount).toBe(2);
  });

  it("handles concurrent redemption attempts safely without exceeding usage limit", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "concurrency-store");

    // Discount with limit = 3
    const discount = await discountService.createDiscount(db, storeId, {
      code: "FLASH3",
      name: "Flash Sale Limit 3",
      type: "PERCENTAGE",
      value: 20,
      usageLimit: 3,
    });

    // 8 concurrent redemption requests for different orders
    const attempts = Array.from({ length: 8 }, async () => {
      const orderId = generateUuidV7();
      try {
        await redemptionService.recordRedemption(db, {
          discountId: discount.id,
          storeId,
          orderId,
          amountCents: 1500,
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err };
      }
    });

    const results = await Promise.all(attempts);
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    expect(successCount).toBe(3);
    expect(failureCount).toBe(5);

    const finalDiscount = await discountService.getDiscountById(db, storeId, discount.id);
    expect(finalDiscount?.usageCount).toBe(3);
  });

  it("provides idempotent redemption for duplicate order completion events", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "idempotent-store");

    const discount = await discountService.createDiscount(db, storeId, {
      code: "IDEMPOTENT10",
      name: "Idempotent Discount",
      type: "PERCENTAGE",
      value: 10,
      usageLimit: 5,
    });

    const orderId = generateUuidV7();

    // First call
    const firstRedemption = await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId,
      amountCents: 500,
    });

    // Duplicate call for the same order
    const secondRedemption = await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId,
      amountCents: 500,
    });

    expect(secondRedemption.id).toBe(firstRedemption.id);

    // Verify usageCount was incremented only once
    const currentDiscount = await discountService.getDiscountById(db, storeId, discount.id);
    expect(currentDiscount?.usageCount).toBe(1);
  });

  it("reverts redemption and restores usage slot on order cancellation/refund", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "revert-store");

    const discount = await discountService.createDiscount(db, storeId, {
      code: "REVERT1",
      name: "Reversible Promo",
      type: "PERCENTAGE",
      value: 10,
      usageLimit: 1,
    });

    const orderId = generateUuidV7();

    // Consume the only slot
    await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId,
      amountCents: 1000,
    });

    let state = await discountService.getDiscountById(db, storeId, discount.id);
    expect(state?.usageCount).toBe(1);

    // New order fails because limit is reached
    const otherOrderId = generateUuidV7();
    await expect(
      redemptionService.recordRedemption(db, {
        discountId: discount.id,
        storeId,
        orderId: otherOrderId,
        amountCents: 1000,
      }),
    ).rejects.toThrow(DiscountUsageLimitExceededError);

    // Revert the original redemption
    const reverted = await redemptionService.revertRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId,
    });
    expect(reverted).toBe(true);

    state = await discountService.getDiscountById(db, storeId, discount.id);
    expect(state?.usageCount).toBe(0);

    // Now other order can redeem because slot was restored!
    const newRedemption = await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId: otherOrderId,
      amountCents: 1000,
    });
    expect(newRedemption.orderId).toBe(otherOrderId);
  });

  it("rejects cross-store redemption attempt", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId: storeA } = await seedTestStore(db, "store-a");
    const { storeId: storeB } = await seedTestStore(db, "store-b");

    const discount = await discountService.createDiscount(db, storeA, {
      code: "STOREA_ONLY",
      name: "Store A Only",
      type: "PERCENTAGE",
      value: 10,
    });

    const orderId = generateUuidV7();

    await expect(
      redemptionService.recordRedemption(db, {
        discountId: discount.id,
        storeId: storeB, // Attempt to redeem Store A discount under Store B
        orderId,
        amountCents: 1000,
      }),
    ).rejects.toThrow(CrossStoreDiscountAccessError);
  });
});
