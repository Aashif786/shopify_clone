import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createDiscountValidator,
  updateDiscountValidator,
} from "@/lib/api/validation";
import {
  Discount,
  DiscountService,
  evaluateDiscountPolicy,
  DiscountNotFoundError,
} from "@shopify-clone/discounts";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Merchant Discount Workflow: Request Validation Contracts", () => {
  it("validates and normalizes valid percentage discount payload", () => {
    const result = createDiscountValidator.validate({
      code: "  summer25 ",
      name: "Summer 25% Off",
      type: "PERCENTAGE",
      value: 25,
      minimumSubtotal: 5000,
      maxDiscountAmount: 2500,
      usageLimit: 100,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeDefined();
      expect(result.data?.code).toBe("SUMMER25");
      expect(result.data?.type).toBe("PERCENTAGE");
      expect(result.data?.value).toBe(25);
      expect(result.data?.currency).toBeNull();
      expect(result.data?.status).toBe("ACTIVE");
      expect(result.data?.minimumSubtotal).toBe(5000);
      expect(result.data?.maxDiscountAmount).toBe(2500);
      expect(result.data?.usageLimit).toBe(100);
    }
  });

  it("validates and normalizes valid fixed amount discount payload", () => {
    const result = createDiscountValidator.validate({
      code: "save20",
      name: "$20 Off Order",
      type: "FIXED_AMOUNT",
      value: 2000,
      currency: "usd",
      minimumSubtotal: 6000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeDefined();
      expect(result.data?.code).toBe("SAVE20");
      expect(result.data?.type).toBe("FIXED_AMOUNT");
      expect(result.data?.value).toBe(2000);
      expect(result.data?.currency).toBe("USD");
    }
  });

  it("rejects fixed amount discount when currency is missing or invalid", () => {
    const missingCurrency = createDiscountValidator.validate({
      code: "FIXED",
      name: "Fixed No Currency",
      type: "FIXED_AMOUNT",
      value: 1000,
    });
    expect(missingCurrency.success).toBe(false);
    if (!missingCurrency.success) {
      expect(missingCurrency.errors?.some((e) => e.field === "currency")).toBe(true);
    }

    const invalidCurrency = createDiscountValidator.validate({
      code: "FIXED",
      name: "Fixed Invalid Currency",
      type: "FIXED_AMOUNT",
      value: 1000,
      currency: "US", // only 2 letters
    });
    expect(invalidCurrency.success).toBe(false);
    if (!invalidCurrency.success) {
      expect(invalidCurrency.errors?.some((e) => e.field === "currency")).toBe(true);
    }
  });

  it("rejects invalid percentage values (<= 0 or > 100)", () => {
    const zeroPercent = createDiscountValidator.validate({
      code: "ZERO",
      name: "Zero",
      type: "PERCENTAGE",
      value: 0,
    });
    expect(zeroPercent.success).toBe(false);

    const overHundred = createDiscountValidator.validate({
      code: "OVER",
      name: "Over 100",
      type: "PERCENTAGE",
      value: 105,
    });
    expect(overHundred.success).toBe(false);
    if (!overHundred.success) {
      expect(overHundred.errors?.some((e) => e.field === "value")).toBe(true);
    }
  });

  it("rejects malformed discount codes", () => {
    const spaces = createDiscountValidator.validate({
      code: "CODE WITH SPACES",
      name: "Code",
      type: "PERCENTAGE",
      value: 10,
    });
    expect(spaces.success).toBe(false);
    if (!spaces.success) {
      expect(spaces.errors?.some((e) => e.field === "code")).toBe(true);
    }

    const empty = createDiscountValidator.validate({
      code: "",
      name: "Code",
      type: "PERCENTAGE",
      value: 10,
    });
    expect(empty.success).toBe(false);
  });

  it("validates date range ordering (endsAt must be after startsAt)", () => {
    const invalidDates = createDiscountValidator.validate({
      code: "DATES",
      name: "Dates",
      type: "PERCENTAGE",
      value: 10,
      startsAt: "2026-12-01T00:00:00Z",
      endsAt: "2026-11-01T00:00:00Z",
    });
    expect(invalidDates.success).toBe(false);
    if (!invalidDates.success) {
      expect(invalidDates.errors?.some((e) => e.field === "endsAt")).toBe(true);
    }
  });

  it("validates update discount payload", () => {
    const validUpdate = updateDiscountValidator.validate({
      name: "Updated Campaign Name",
      status: "DISABLED",
      minimumSubtotal: 8000,
      usageLimit: 200,
    });
    expect(validUpdate.success).toBe(true);
    if (validUpdate.success) {
      expect(validUpdate.data?.name).toBe("Updated Campaign Name");
      expect(validUpdate.data?.status).toBe("DISABLED");
      expect(validUpdate.data?.minimumSubtotal).toBe(8000);
      expect(validUpdate.data?.usageLimit).toBe(200);
    }
  });
});

describe("Merchant Discount Workflow: Storefront Lifecycle Synchronization", () => {
  const storeA = "store_alpha";
  const storeB = "store_beta";

  it("merchant active discount can be redeemed in store storefront", () => {
    const discount = Discount.create({
      storeId: storeA,
      code: "STOREVIP20",
      name: "Store A VIP 20%",
      type: "PERCENTAGE",
      value: 20,
      status: "ACTIVE",
    });

    // Store A customer applies code -> SUCCESS
    const evaluationStoreA = evaluateDiscountPolicy(discount.toData(), {
      targetStoreId: storeA,
      subtotal: 10000, // $100
      currency: "USD",
    });
    expect(evaluationStoreA.isValid).toBe(true);
    expect(evaluationStoreA.discount?.amount).toBe(2000); // $20 off
  });

  it("merchant deactivation immediately prevents storefront redemption", () => {
    const discount = Discount.create({
      storeId: storeA,
      code: "PAUSED10",
      name: "Temporarily Paused Promo",
      type: "PERCENTAGE",
      value: 10,
      status: "ACTIVE",
    });

    // Merchant deactivates discount
    discount.deactivate();
    expect(discount.status).toBe("DISABLED");

    // Storefront customer attempts to redeem -> REJECTED
    const evaluation = evaluateDiscountPolicy(discount.toData(), {
      targetStoreId: storeA,
      subtotal: 10000,
      currency: "USD",
    });
    expect(evaluation.isValid).toBe(false);
    expect(evaluation.reason).toBe("DISCOUNT_INACTIVE");
  });

  it("enforces tenant boundary: Store B cannot redeem Store A discount", () => {
    const discountStoreA = Discount.create({
      storeId: storeA,
      code: "ALPHA_EXCLUSIVE",
      name: "Alpha Only",
      type: "PERCENTAGE",
      value: 15,
      status: "ACTIVE",
    });

    // Customer in Store B attempts to use Store A code
    const evaluationStoreB = evaluateDiscountPolicy(discountStoreA.toData(), {
      targetStoreId: storeB,
      subtotal: 10000,
      currency: "USD",
    });
    expect(evaluationStoreB.isValid).toBe(false);
    expect(evaluationStoreB.reason).toBe("DISCOUNT_NOT_FOUND");
  });
});

describe("Merchant Discount Workflow: Database Persistence & Administration", { timeout: 30_000 }, () => {
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

  async function seedStore(db: Database, slug = "m-store"): Promise<string> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return storeId;
  }

  it("supports full merchant discount administration workflow: create, list, edit, deactivate, and activate", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const storeId = await seedStore(db, "admin-workflow");

    // 1. Create Discount
    const created = await discountService.createDiscount(db, storeId, {
      code: "LAUNCH20",
      name: "Grand Launch 20% Off",
      type: "PERCENTAGE",
      value: 20,
      minimumSubtotal: 4000,
      usageLimit: 50,
    });
    expect(created.id).toBeDefined();
    expect(created.status).toBe("ACTIVE");

    // 2. List Discounts
    const list = await discountService.listDiscounts(db, storeId);
    expect(list.length).toBe(1);
    expect(list[0]?.code).toBe("LAUNCH20");

    // 3. Edit Discount
    const updated = await discountService.updateDiscount(db, storeId, created.id, {
      name: "Grand Launch Special 20%",
      minimumSubtotal: 5000,
      usageLimit: 100,
    });
    expect(updated.name).toBe("Grand Launch Special 20%");
    expect(updated.minimumSubtotal).toBe(5000);
    expect(updated.usageLimit).toBe(100);

    // 4. Deactivate Discount
    const deactivated = await discountService.deactivateDiscount(db, storeId, created.id);
    expect(deactivated.status).toBe("DISABLED");

    let retrieved = await discountService.getDiscountById(db, storeId, created.id);
    expect(retrieved?.status).toBe("DISABLED");

    // 5. Activate Discount
    const activated = await discountService.activateDiscount(db, storeId, created.id);
    expect(activated.status).toBe("ACTIVE");

    retrieved = await discountService.getDiscountById(db, storeId, created.id);
    expect(retrieved?.status).toBe("ACTIVE");
  });

  it("enforces store isolation: merchant in Store 1 cannot view or modify Store 2 discounts", async (ctx) => {
    if (!isPostgresAvailable) {
      ctx.skip();
      return;
    }

    const db = await setupDb();
    const store1 = await seedStore(db, "store-1");
    const store2 = await seedStore(db, "store-2");

    const discount1 = await discountService.createDiscount(db, store1, {
      code: "PROMO1",
      name: "Store 1 Promo",
      type: "PERCENTAGE",
      value: 10,
    });

    // Lookup with wrong storeId returns null
    const crossStoreLookup = await discountService.getDiscountById(db, store2, discount1.id);
    expect(crossStoreLookup).toBeNull();

    // Modification with wrong storeId throws DiscountNotFoundError
    await expect(
      discountService.updateDiscount(db, store2, discount1.id, {
        name: "Hacked Discount",
      }),
    ).rejects.toThrow(DiscountNotFoundError);

    // Deactivation with wrong storeId throws DiscountNotFoundError
    await expect(
      discountService.deactivateDiscount(db, store2, discount1.id),
    ).rejects.toThrow(DiscountNotFoundError);
  });
});
