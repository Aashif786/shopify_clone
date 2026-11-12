import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import {
  GiftCardCurrencyMismatchError,
  GiftCardDepletedError,
  GiftCardDisabledError,
  GiftCardExpiredError,
  GiftCardNotFoundError,
  GiftCardService,
  InsufficientGiftCardBalanceError,
  InsufficientStoreCreditBalanceError,
  extractCodeLast4,
  generateGiftCardCode,
  hashGiftCardCode,
  maskGiftCardCode,
  normalizeGiftCardCode,
} from "@calcart/giftcards";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Stored-Value Instruments: Gift Cards & Store Credit (GAP-14)", { timeout: 120_000 }, () => {
  let db: Database;
  let close: (() => Promise<void>) | undefined;
  const giftcardService = new GiftCardService();

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

  async function seedStore(slug = `gc-${generateUuidV7().slice(-8)}`) {
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

  async function seedCustomer(storeId: string, email = "customer@example.com") {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, $3, 'Priya', 'Sharma')`,
      [customerId, storeId, email],
    );
    return customerId;
  }

  describe("Gift Card Domain Utilities", () => {
    it("generates 16-character alphanumeric codes formatted with GC prefix", () => {
      const code = generateGiftCardCode();
      expect(code).toMatch(/^GC-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      // Verify visually ambiguous characters (0, O, 1, I, L) are never generated
      expect(code).not.toMatch(/[01OIL]/);
    });

    it("normalizes gift card codes irrespective of casing, spaces, or hyphens", () => {
      expect(normalizeGiftCardCode("gc-a7k2-9mnp-4r8x")).toBe("GCA7K29MNP4R8X");
      expect(normalizeGiftCardCode("  GC A7K2 9MNP 4R8X  ")).toBe("GCA7K29MNP4R8X");
      expect(normalizeGiftCardCode("gca7k29mnp4r8x")).toBe("GCA7K29MNP4R8X");
    });

    it("hashes codes deterministically via SHA-256", () => {
      const hash1 = hashGiftCardCode("GC-A7K2-9MNP-4R8X");
      const hash2 = hashGiftCardCode("gca7k29mnp4r8x");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("masks gift card codes revealing only the last 4 characters", () => {
      const masked = maskGiftCardCode("GC-A7K2-9MNP-4R8X");
      expect(masked).toBe("••••-••••-••••-4R8X");
      expect(extractCodeLast4("GC-A7K2-9MNP-4R8X")).toBe("4R8X");
    });
  });

  describe("Gift Card Service & Ledger Integration", () => {
    it("creates a gift card with initial balance and records the initial issuance ledger transaction", async () => {
      const storeId = await seedStore();

      const card = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 50_000, // ₹500.00
        currency: "INR",
        recipientEmail: "friend@example.com",
        recipientName: "Rahul",
        message: "Happy Birthday!",
      });

      expect(card.id).toBeDefined();
      expect(card.storeId).toBe(storeId);
      expect(card.initialBalance).toBe(50_000);
      expect(card.currentBalance).toBe(50_000);
      expect(card.status).toBe("ACTIVE");
      expect(card.currency).toBe("INR");
      expect(card.recipientEmail).toBe("friend@example.com");

      // Verify immutable financial ledger transaction
      const txs = await giftcardService.listGiftCardTransactions(db, storeId, card.id);
      expect(txs).toHaveLength(1);
      expect(txs[0]!.type).toBe("ISSUANCE");
      expect(txs[0]!.amount).toBe(50_000);
      expect(txs[0]!.balanceBefore).toBe(0);
      expect(txs[0]!.balanceAfter).toBe(50_000);
    });

    it("looks up gift cards by raw code or formatted code", async () => {
      const storeId = await seedStore();

      const created = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 100_000,
        currency: "INR",
      });

      // Lookup with exact code
      const found1 = await giftcardService.getGiftCardByCode(db, storeId, created.code);
      expect(found1.id).toBe(created.id);

      // Lookup with lowercase unhyphenated code
      const unhyphenated = created.code.replace(/[\-]/g, "").toLowerCase();
      const found2 = await giftcardService.getGiftCardByCode(db, storeId, unhyphenated);
      expect(found2.id).toBe(created.id);

      // Customer-safe lookup
      const lookup = await giftcardService.lookupGiftCard(db, storeId, unhyphenated);
      expect(lookup.isUsable).toBe(true);
      expect(lookup.currentBalance).toBe(100_000);
      expect(lookup.maskedCode).toBe(created.maskedCode);
    });

    it("atomically redeems balance and maintains an append-only ledger", async () => {
      const storeId = await seedStore();

      const card = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 50_000,
      });

      const { giftCard: afterFirst, transaction: tx1 } = await giftcardService.redeemGiftCard(
        db,
        storeId,
        card.id,
        {
          amount: 20_000,
          currency: "INR",
          idempotencyKey: "idem_redeem_1",
          notes: "First redemption",
        },
      );

      expect(afterFirst.currentBalance).toBe(30_000);
      expect(afterFirst.status).toBe("ACTIVE");
      expect(tx1.type).toBe("REDEMPTION");
      expect(tx1.amount).toBe(-20_000);
      expect(tx1.balanceBefore).toBe(50_000);
      expect(tx1.balanceAfter).toBe(30_000);

      // Second redemption depleting the card
      const { giftCard: afterSecond, transaction: tx2 } = await giftcardService.redeemGiftCard(
        db,
        storeId,
        card.id,
        {
          amount: 30_000,
          currency: "INR",
          idempotencyKey: "idem_redeem_2",
          notes: "Final depletion",
        },
      );

      expect(afterSecond.currentBalance).toBe(0);
      expect(afterSecond.status).toBe("DEPLETED");
      expect(tx2.balanceBefore).toBe(30_000);
      expect(tx2.balanceAfter).toBe(0);
    });

    it("is idempotent on repeated redemption with the same idempotency key", async () => {
      const storeId = await seedStore();

      const card = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 50_000,
      });

      const res1 = await giftcardService.redeemGiftCard(db, storeId, card.id, {
        amount: 15_000,
        currency: "INR",
        idempotencyKey: "retry_key_100",
      });

      // Repeat with same key
      const res2 = await giftcardService.redeemGiftCard(db, storeId, card.id, {
        amount: 15_000,
        currency: "INR",
        idempotencyKey: "retry_key_100",
      });

      expect(res1.giftCard.currentBalance).toBe(35_000);
      expect(res2.giftCard.currentBalance).toBe(35_000);
      expect(res1.transaction.id).toBe(res2.transaction.id);

      // Ledger must only have 1 issuance + 1 redemption
      const txs = await giftcardService.listGiftCardTransactions(db, storeId, card.id);
      expect(txs).toHaveLength(2);
    });

    it("rejects redemption exceeding available balance", async () => {
      const storeId = await seedStore();

      const card = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 10_000,
      });

      await expect(
        giftcardService.redeemGiftCard(db, storeId, card.id, {
          amount: 15_000,
          currency: "INR",
          idempotencyKey: "exceed_key",
        }),
      ).rejects.toThrow(InsufficientGiftCardBalanceError);

      const fresh = await giftcardService.getGiftCardById(db, storeId, card.id);
      expect(fresh.currentBalance).toBe(10_000);
    });

    it("rejects redemption of disabled, expired, or currency-mismatched cards", async () => {
      const storeId = await seedStore();

      // Disabled card
      const card = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 20_000,
      });
      await giftcardService.disableGiftCard(db, storeId, card.id);

      await expect(
        giftcardService.redeemGiftCard(db, storeId, card.id, {
          amount: 5_000,
          currency: "INR",
          idempotencyKey: "dis_key",
        }),
      ).rejects.toThrow(GiftCardDisabledError);

      // Expired card
      const expired = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 20_000,
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      });

      await expect(
        giftcardService.redeemGiftCard(db, storeId, expired.id, {
          amount: 5_000,
          currency: "INR",
          idempotencyKey: "exp_key",
        }),
      ).rejects.toThrow(GiftCardExpiredError);

      // Currency mismatch
      const inrCard = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 20_000,
        currency: "INR",
      });

      await expect(
        giftcardService.redeemGiftCard(db, storeId, inrCard.id, {
          amount: 5_000,
          currency: "USD",
          idempotencyKey: "curr_mismatch",
        }),
      ).rejects.toThrow(GiftCardCurrencyMismatchError);
    });

    it("refunds back to a gift card, restoring DEPLETED status to ACTIVE", async () => {
      const storeId = await seedStore();

      const card = await giftcardService.createGiftCard(db, storeId, {
        initialBalance: 20_000,
      });

      // Deplete card
      await giftcardService.redeemGiftCard(db, storeId, card.id, {
        amount: 20_000,
        currency: "INR",
        idempotencyKey: "deplete_for_refund",
      });

      const depleted = await giftcardService.getGiftCardById(db, storeId, card.id);
      expect(depleted.status).toBe("DEPLETED");
      expect(depleted.currentBalance).toBe(0);

      // Refund 10_000
      const { giftCard: restored, transaction: refundTx } = await giftcardService.refundToGiftCard(
        db,
        storeId,
        card.id,
        {
          amount: 10_000,
          currency: "INR",
          idempotencyKey: "refund_tx_1",
          notes: "Returned items refund",
        },
      );

      expect(restored.currentBalance).toBe(10_000);
      expect(restored.status).toBe("ACTIVE");
      expect(refundTx.type).toBe("REFUND");
      expect(refundTx.amount).toBe(10_000);
      expect(refundTx.balanceBefore).toBe(0);
      expect(refundTx.balanceAfter).toBe(10_000);
    });
  });

  describe("Customer Store Credit Integration", () => {
    it("issues and redeems customer store credit idempotently with an immutable audit ledger", async () => {
      const storeId = await seedStore();
      const customerId = await seedCustomer(storeId);

      // 1. Issue store credit
      const { storeCredit: credited, transaction: issueTx } = await giftcardService.issueStoreCredit(
        db,
        storeId,
        customerId,
        {
          amount: 15_000,
          currency: "INR",
          idempotencyKey: "sc_issue_1",
          notes: "Return RMA refund credit",
        },
      );

      expect(credited.currentBalance).toBe(15_000);
      expect(issueTx.type).toBe("ISSUANCE");
      expect(issueTx.amount).toBe(15_000);
      expect(issueTx.balanceBefore).toBe(0);
      expect(issueTx.balanceAfter).toBe(15_000);

      // 2. Redeem partial store credit
      const { storeCredit: debited, transaction: redeemTx } = await giftcardService.redeemStoreCredit(
        db,
        storeId,
        customerId,
        {
          amount: 5_000,
          currency: "INR",
          idempotencyKey: "sc_redeem_1",
          notes: "Applied on order #1001",
        },
      );

      expect(debited.currentBalance).toBe(10_000);
      expect(redeemTx.type).toBe("REDEMPTION");
      expect(redeemTx.amount).toBe(-5_000);
      expect(redeemTx.balanceBefore).toBe(15_000);
      expect(redeemTx.balanceAfter).toBe(10_000);

      // 3. Reject over-redemption
      await expect(
        giftcardService.redeemStoreCredit(db, storeId, customerId, {
          amount: 25_000,
          currency: "INR",
          idempotencyKey: "sc_overdraw",
        }),
      ).rejects.toThrow(InsufficientStoreCreditBalanceError);
    });
  });

  describe("Tenant Isolation", () => {
    it("prevents store B from looking up, redeeming, or accessing store A's gift cards", async () => {
      const storeA = await seedStore("store-a");
      const storeB = await seedStore("store-b");

      const cardA = await giftcardService.createGiftCard(db, storeA, {
        initialBalance: 50_000,
        currency: "INR",
      });

      // Store B looking up Store A's card by ID throws 404
      await expect(giftcardService.getGiftCardById(db, storeB, cardA.id)).rejects.toThrow(
        GiftCardNotFoundError,
      );

      // Store B looking up Store A's card by code throws 404
      await expect(giftcardService.getGiftCardByCode(db, storeB, cardA.code)).rejects.toThrow(
        GiftCardNotFoundError,
      );

      // Store B attempting to redeem Store A's card throws 404
      await expect(
        giftcardService.redeemGiftCard(db, storeB, cardA.id, {
          amount: 10_000,
          currency: "INR",
          idempotencyKey: "cross_store_hack",
        }),
      ).rejects.toThrow(GiftCardNotFoundError);

      // Balance in Store A is untouched
      const freshCardA = await giftcardService.getGiftCardById(db, storeA, cardA.id);
      expect(freshCardA.currentBalance).toBe(50_000);
    });
  });
});
