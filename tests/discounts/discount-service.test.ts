import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import {
  Discount,
  DiscountService,
  DiscountRepository,
  normalizeDiscountCode,
  calculateDiscountAmount,
  evaluateDiscountPolicy,
  DiscountAlreadyExistsError,
  InvalidDiscountCodeError,
  InvalidDiscountValueError,
} from "@shopify-clone/discounts";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Discount Domain & Policy Unit Tests", () => {
  const storeId = "store_test_alpha";

  describe("Code Normalization and Validation", () => {
    it("normalizes discount code by trimming whitespace and converting to uppercase", () => {
      expect(normalizeDiscountCode("  summer2026 ")).toBe("SUMMER2026");
      expect(normalizeDiscountCode("welcome_10")).toBe("WELCOME_10");
      expect(normalizeDiscountCode("Save-50")).toBe("SAVE-50");
      expect(normalizeDiscountCode("")).toBe("");
      expect(normalizeDiscountCode(null)).toBe("");
      expect(normalizeDiscountCode(undefined)).toBe("");
    });

    it("creates domain entity with valid attributes", () => {
      const discount = Discount.create({
        storeId,
        code: " welcome10 ",
        name: "Welcome 10% Off",
        type: "PERCENTAGE",
        value: 10,
        currency: "USD",
        minimumSubtotal: 2000,
        maxDiscountAmount: 5000,
        usageLimit: 100,
      });

      expect(discount.code).toBe("WELCOME10");
      expect(discount.type).toBe("PERCENTAGE");
      expect(discount.value).toBe(10);
      expect(discount.status).toBe("ACTIVE");
      expect(discount.usageCount).toBe(0);
      expect(discount.minimumSubtotal).toBe(2000);
      expect(discount.maxDiscountAmount).toBe(5000);
      expect(discount.usageLimit).toBe(100);
    });

    it("throws InvalidDiscountCodeError for invalid codes", () => {
      expect(() =>
        Discount.create({
          storeId,
          code: "",
          name: "Test",
          type: "PERCENTAGE",
          value: 10,
        }),
      ).toThrow(InvalidDiscountCodeError);

      expect(() =>
        Discount.create({
          storeId,
          code: "INVALID CODE WITH SPACES",
          name: "Test",
          type: "PERCENTAGE",
          value: 10,
        }),
      ).toThrow(InvalidDiscountCodeError);

      expect(() =>
        Discount.create({
          storeId,
          code: "A".repeat(65),
          name: "Test",
          type: "PERCENTAGE",
          value: 10,
        }),
      ).toThrow(InvalidDiscountCodeError);
    });

    it("throws InvalidDiscountValueError for invalid values", () => {
      // Percentage <= 0
      expect(() =>
        Discount.create({
          storeId,
          code: "ZERO",
          name: "Test",
          type: "PERCENTAGE",
          value: 0,
        }),
      ).toThrow(InvalidDiscountValueError);

      // Percentage > 100
      expect(() =>
        Discount.create({
          storeId,
          code: "TOOHIGH",
          name: "Test",
          type: "PERCENTAGE",
          value: 101,
        }),
      ).toThrow(InvalidDiscountValueError);

      // Fixed amount <= 0
      expect(() =>
        Discount.create({
          storeId,
          code: "FIXEDZERO",
          name: "Test",
          type: "FIXED_AMOUNT",
          value: 0,
        }),
      ).toThrow(InvalidDiscountValueError);

      // Negative minimum spend
      expect(() =>
        Discount.create({
          storeId,
          code: "NEGMIN",
          name: "Test",
          type: "PERCENTAGE",
          value: 10,
          minimumSubtotal: -100,
        }),
      ).toThrow(InvalidDiscountValueError);

      // Negative usage limit
      expect(() =>
        Discount.create({
          storeId,
          code: "NEGLIMIT",
          name: "Test",
          type: "PERCENTAGE",
          value: 10,
          usageLimit: -5,
        }),
      ).toThrow(InvalidDiscountValueError);
    });
  });

  describe("Discount Calculation Mechanics", () => {
    it("calculates percentage discount accurately in integer cents", () => {
      // 10% on $100.00 (10000 cents) = 1000 cents
      expect(calculateDiscountAmount("PERCENTAGE", 10, 10000)).toBe(1000);
      // 15% on $50.00 (5000 cents) = 750 cents
      expect(calculateDiscountAmount("PERCENTAGE", 15, 5000)).toBe(750);
      // 33% on $99.99 (9999 cents) = 3299 cents (floored integer arithmetic)
      expect(calculateDiscountAmount("PERCENTAGE", 33, 9999)).toBe(3299);
    });

    it("respects maxDiscountAmount cap for percentage discounts", () => {
      // 50% on $100.00 would be $50.00 (5000 cents), but max cap is $25.00 (2500 cents)
      expect(calculateDiscountAmount("PERCENTAGE", 50, 10000, 2500)).toBe(2500);
    });

    it("caps discount amount at subtotal to guarantee non-negative grand total", () => {
      // $50.00 fixed discount on a $30.00 order caps at $30.00
      expect(calculateDiscountAmount("FIXED_AMOUNT", 5000, 3000)).toBe(3000);
    });

    it("returns zero discount for non-positive subtotals or values", () => {
      expect(calculateDiscountAmount("PERCENTAGE", 10, 0)).toBe(0);
      expect(calculateDiscountAmount("PERCENTAGE", 10, -500)).toBe(0);
      expect(calculateDiscountAmount("FIXED_AMOUNT", 1000, 0)).toBe(0);
      expect(calculateDiscountAmount("PERCENTAGE", 0, 1000)).toBe(0);
    });
  });

  describe("Discount Policy Evaluation Rules", () => {
    it("evaluates active valid discount successfully", () => {
      const evaluation = evaluateDiscountPolicy(
        {
          storeId,
          code: "PROMO15",
          name: "15% Off",
          type: "PERCENTAGE",
          value: 15,
          status: "ACTIVE",
          usageCount: 2,
          usageLimit: 10,
        },
        {
          targetStoreId: storeId,
          subtotal: 10000,
          currency: "USD",
        },
      );

      expect(evaluation.isValid).toBe(true);
      expect(evaluation.discount).toBeDefined();
      expect(evaluation.discount?.amount).toBe(1500);
      expect(evaluation.discount?.code).toBe("PROMO15");
    });

    it("rejects cross-store tenant access", () => {
      const evaluation = evaluateDiscountPolicy(
        {
          storeId: "store_other",
          code: "SECRET",
          name: "Secret",
          type: "PERCENTAGE",
          value: 20,
          status: "ACTIVE",
          usageCount: 0,
        },
        {
          targetStoreId: storeId,
          subtotal: 10000,
          currency: "USD",
        },
      );

      expect(evaluation.isValid).toBe(false);
      expect(evaluation.reason).toBe("DISCOUNT_NOT_FOUND");
    });

    it("rejects expired discount by date or status", () => {
      const expiredByStatus = evaluateDiscountPolicy(
        {
          storeId,
          code: "EXPIRED_STATUS",
          name: "Expired",
          type: "PERCENTAGE",
          value: 10,
          status: "EXPIRED",
          usageCount: 0,
        },
        { targetStoreId: storeId, subtotal: 5000, currency: "USD" },
      );
      expect(expiredByStatus.isValid).toBe(false);
      expect(expiredByStatus.reason).toBe("DISCOUNT_EXPIRED");

      const expiredByDate = evaluateDiscountPolicy(
        {
          storeId,
          code: "PAST_DATE",
          name: "Past Date",
          type: "PERCENTAGE",
          value: 10,
          status: "ACTIVE",
          usageCount: 0,
          endsAt: new Date(Date.now() - 60000).toISOString(),
        },
        { targetStoreId: storeId, subtotal: 5000, currency: "USD" },
      );
      expect(expiredByDate.isValid).toBe(false);
      expect(expiredByDate.reason).toBe("DISCOUNT_EXPIRED");
    });

    it("rejects discount that has not started yet", () => {
      const futureDiscount = evaluateDiscountPolicy(
        {
          storeId,
          code: "FUTURE",
          name: "Future Promo",
          type: "PERCENTAGE",
          value: 10,
          status: "ACTIVE",
          usageCount: 0,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
        },
        { targetStoreId: storeId, subtotal: 5000, currency: "USD" },
      );
      expect(futureDiscount.isValid).toBe(false);
      expect(futureDiscount.reason).toBe("DISCOUNT_INACTIVE");
    });

    it("rejects currency mismatch for fixed amount discount", () => {
      const mismatch = evaluateDiscountPolicy(
        {
          storeId,
          code: "FIXED_EUR",
          name: "10 EUR Off",
          type: "FIXED_AMOUNT",
          value: 1000,
          currency: "EUR",
          status: "ACTIVE",
          usageCount: 0,
        },
        { targetStoreId: storeId, subtotal: 5000, currency: "USD" },
      );
      expect(mismatch.isValid).toBe(false);
      expect(mismatch.reason).toBe("CURRENCY_MISMATCH");
    });

    it("rejects when subtotal does not meet minimum subtotal threshold", () => {
      const belowMinimum = evaluateDiscountPolicy(
        {
          storeId,
          code: "BIGSPEND",
          name: "$50 off $200",
          type: "FIXED_AMOUNT",
          value: 5000,
          currency: "USD",
          status: "ACTIVE",
          minimumSubtotal: 20000, // $200
          usageCount: 0,
        },
        { targetStoreId: storeId, subtotal: 15000, currency: "USD" }, // $150
      );
      expect(belowMinimum.isValid).toBe(false);
      expect(belowMinimum.reason).toBe("MINIMUM_AMOUNT_NOT_MET");
    });

    it("rejects when usage limit is reached", () => {
      const limitReached = evaluateDiscountPolicy(
        {
          storeId,
          code: "LIMITED",
          name: "First 5 Shoppers",
          type: "PERCENTAGE",
          value: 20,
          status: "ACTIVE",
          usageLimit: 5,
          usageCount: 5,
        },
        { targetStoreId: storeId, subtotal: 5000, currency: "USD" },
      );
      expect(limitReached.isValid).toBe(false);
      expect(limitReached.reason).toBe("USAGE_LIMIT_REACHED");
    });
  });
});

describe("DiscountService PostgreSQL Persistence", { timeout: 30_000 }, () => {
  let isPostgresAvailable = false;
  let close: (() => Promise<void>) | undefined;
  const discountService = new DiscountService();

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
    slug = "disc-store-1",
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

  it("persists a discount definition and retrieves it by ID and normalized code", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "alpha-shop");

    const created = await discountService.createDiscount(db, storeId, {
      code: "WELCOME15",
      name: "Welcome 15% Off",
      type: "PERCENTAGE",
      value: 15,
      minimumSubtotal: 3000,
      usageLimit: 50,
    });

    expect(created.id).toBeDefined();
    expect(created.storeId).toBe(storeId);
    expect(created.code).toBe("WELCOME15");
    expect(created.status).toBe("ACTIVE");

    // Lookup by ID
    const byId = await discountService.getDiscountById(db, storeId, created.id);
    expect(byId).not.toBeNull();
    expect(byId?.code).toBe("WELCOME15");

    // Lookup by Code (case-insensitive)
    const byCode = await discountService.getDiscountByCode(db, storeId, "welcome15");
    expect(byCode).not.toBeNull();
    expect(byCode?.id).toBe(created.id);
  });

  it("enforces store-scoped code uniqueness at the database level", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId: store1 } = await seedTestStore(db, "unique-1");
    const { storeId: store2 } = await seedTestStore(db, "unique-2");

    // Create code in Store 1
    await discountService.createDiscount(db, store1, {
      code: "VIP20",
      name: "Store 1 VIP",
      type: "PERCENTAGE",
      value: 20,
    });

    // Duplicate in Store 1 must fail
    await expect(
      discountService.createDiscount(db, store1, {
        code: "vip20",
        name: "Store 1 VIP Duplicate",
        type: "PERCENTAGE",
        value: 20,
      }),
    ).rejects.toThrow(DiscountAlreadyExistsError);

    // Same code in Store 2 must SUCCEED (store-scoped uniqueness)
    const store2Discount = await discountService.createDiscount(db, store2, {
      code: "VIP20",
      name: "Store 2 VIP",
      type: "PERCENTAGE",
      value: 20,
    });
    expect(store2Discount.storeId).toBe(store2);
  });

  it("updates and deactivates discount definitions", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "mgmt-shop");

    const created = await discountService.createDiscount(db, storeId, {
      code: "DEAL10",
      name: "Old Deal",
      type: "PERCENTAGE",
      value: 10,
    });

    // Update definition
    const updated = await discountService.updateDiscount(db, storeId, created.id, {
      name: "New Super Deal",
      value: 12,
      minimumSubtotal: 4000,
    });
    expect(updated.name).toBe("New Super Deal");
    expect(updated.value).toBe(12);
    expect(updated.minimumSubtotal).toBe(4000);

    // Deactivate definition
    const deactivated = await discountService.deactivateDiscount(db, storeId, created.id);
    expect(deactivated.status).toBe("DISABLED");

    const lookup = await discountService.getDiscountById(db, storeId, created.id);
    expect(lookup?.status).toBe("DISABLED");
  });

  it("evaluates discount directly from database using evaluateCode", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "eval-shop");

    await discountService.createDiscount(db, storeId, {
      code: "SAVE25",
      name: "Save $25",
      type: "FIXED_AMOUNT",
      value: 2500,
      currency: "USD",
      minimumSubtotal: 10000,
    });

    // Evaluates successfully when spend is met
    const successResult = await discountService.evaluateCode(db, storeId, "save25", {
      targetStoreId: storeId,
      subtotal: 12000,
      currency: "USD",
    });
    expect(successResult.isValid).toBe(true);
    expect(successResult.discount?.amount).toBe(2500);

    // Evaluates with failure when spend is not met
    const failResult = await discountService.evaluateCode(db, storeId, "SAVE25", {
      targetStoreId: storeId,
      subtotal: 5000,
      currency: "USD",
    });
    expect(failResult.isValid).toBe(false);
    expect(failResult.reason).toBe("MINIMUM_AMOUNT_NOT_MET");
  });

  it("maintains persistence across repository/service reinitialization", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "reinit-shop");

    const service1 = new DiscountService();
    const created = await service1.createDiscount(db, storeId, {
      code: "PERSISTENT10",
      name: "Persistent Discount",
      type: "PERCENTAGE",
      value: 10,
    });

    // Reinitialize brand new service and repository instances
    const repo2 = new DiscountRepository();
    const service2 = new DiscountService(repo2);

    const reloaded = await service2.getDiscountById(db, storeId, created.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.code).toBe("PERSISTENT10");
  });
});
