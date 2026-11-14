import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { serializeCustomerSessionCookie } from "@calcart/auth";
import { CustomerService } from "@calcart/customers";
import { GiftCardService } from "@calcart/giftcards";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { POST as balanceRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/gift-cards/balance/route.js";
import { POST as redeemRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/gift-cards/redeem/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Storefront Gift Cards: Balance Check & Redemption", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const customerService = new CustomerService();
  const giftCardService = new GiftCardService();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;
  });

  afterAll(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createStore(slug: string) {
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
    return { storeId, slug };
  }

  async function createCustomerSession(storeId: string, slug: string, name = "Test Customer") {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();
    const email = `buyer-${userId.slice(-8)}@example.com`;
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, $3, 'scrypt:hash', 'ACTIVE')`,
      [userId, email, name],
    );
    const expiresAt = new Date(Date.now() + 86_400_000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );
    const customer = await customerService.resolveStoreCustomerForUser(db, storeId, {
      userId,
      email,
      firstName: name.split(" ")[0] || "Test",
      lastName: name.split(" ")[1] || "Customer",
      emailVerified: true,
    });
    const cookie = serializeCustomerSessionCookie(sessionId, slug, { expires: expiresAt }).split(";")[0]!;
    return { customer, cookie, userId, email };
  }

  it("1. Looking up a valid gift card balance returns card details and status", async () => {
    const { storeId, slug } = await createStore(`bal-${generateUuidV7().slice(-6)}`);
    const card = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 250000,
      currency: "INR",
    });

    // Lookup with exact code
    const req = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: card.code }),
    });

    const res = await balanceRoute(req, { params: Promise.resolve({ storeSlug: slug }) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: {
        giftCard: {
          id: string;
          maskedCode: string;
          currentBalance: number;
          currency: string;
          status: string;
          isUsable: boolean;
        };
      };
    };

    expect(body.data.giftCard.id).toBe(card.id);
    expect(body.data.giftCard.currentBalance).toBe(250000);
    expect(body.data.giftCard.currency).toBe("INR");
    expect(body.data.giftCard.status).toBe("ACTIVE");
    expect(body.data.giftCard.isUsable).toBe(true);
    expect(body.data.giftCard.maskedCode).toBe(card.maskedCode);

    // Also verify case-insensitive and unhyphenated lookup
    const cleanCode = card.code.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    const reqClean = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: cleanCode }),
    });

    const resClean = await balanceRoute(reqClean, { params: Promise.resolve({ storeSlug: slug }) });
    expect(resClean.status).toBe(200);
  });

  it("2. Looking up non-existent, expired, or depleted gift cards handles responses safely", async () => {
    const { storeId, slug } = await createStore(`err-${generateUuidV7().slice(-6)}`);

    // Non-existent code
    const reqNonExistent = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "GC-NOT-REAL-9999" }),
    });
    const resNonExistent = await balanceRoute(reqNonExistent, { params: Promise.resolve({ storeSlug: slug }) });
    expect(resNonExistent.status).toBe(404);

    // Missing code
    const reqEmpty = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "" }),
    });
    const resEmpty = await balanceRoute(reqEmpty, { params: Promise.resolve({ storeSlug: slug }) });
    expect(resEmpty.status).toBe(400);

    // Expired card
    const pastDate = new Date(Date.now() - 100_000);
    const expiredCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 100000,
      currency: "INR",
      expiresAt: pastDate,
    });
    const reqExpired = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: expiredCard.code }),
    });
    const resExpired = await balanceRoute(reqExpired, { params: Promise.resolve({ storeSlug: slug }) });
    expect(resExpired.status).toBe(200);
    const expiredBody = (await resExpired.json()) as { data: { giftCard: { status: string; isUsable: boolean } } };
    expect(expiredBody.data.giftCard.status).toBe("EXPIRED");
    expect(expiredBody.data.giftCard.isUsable).toBe(false);
  });

  it("3. Redeeming gift cards requires customer authentication", async () => {
    const { storeId, slug } = await createStore(`unauth-${generateUuidV7().slice(-6)}`);
    const card = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 50000,
      currency: "INR",
    });

    const req = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: card.code }),
    });

    const res = await redeemRoute(req, { params: Promise.resolve({ storeSlug: slug }) });
    expect(res.status).toBe(401);
  });

  it("4. Authenticated customer redeems a gift card to their store credit account", async () => {
    const { storeId, slug } = await createStore(`redeem-${generateUuidV7().slice(-6)}`);
    const { customer, cookie } = await createCustomerSession(storeId, slug, "Alice Buyer");

    const card = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 150000, // 1500 INR
      currency: "INR",
    });

    // Check store credit before redemption (should be 0)
    const initialCredit = await giftCardService.getOrCreateStoreCredit(db, storeId, customer.id, "INR");
    expect(initialCredit.currentBalance).toBe(0);

    // Call redeem endpoint
    const req = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ code: card.code }),
    });

    const res = await redeemRoute(req, { params: Promise.resolve({ storeSlug: slug }) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: {
        success: boolean;
        redeemedAmount: number;
        currency: string;
        newStoreCreditBalance: number;
        giftCard: { currentBalance: number; status: string };
      };
    };

    expect(body.data.success).toBe(true);
    expect(body.data.redeemedAmount).toBe(150000);
    expect(body.data.newStoreCreditBalance).toBe(150000);
    expect(body.data.giftCard.currentBalance).toBe(0);
    expect(body.data.giftCard.status).toBe("DEPLETED");

    // Verify persisted store credit in database
    const updatedCredit = await giftCardService.getOrCreateStoreCredit(db, storeId, customer.id, "INR");
    expect(updatedCredit.currentBalance).toBe(150000);

    // Verify gift card in database is now depleted
    const updatedCard = await giftCardService.getGiftCardById(db, storeId, card.id);
    expect(updatedCard.currentBalance).toBe(0);
    expect(updatedCard.status).toBe("DEPLETED");

    // Verify attempting to redeem the depleted card again is rejected
    const reqRetry = new Request(`http://localhost/api/v1/storefront/${slug}/gift-cards/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ code: card.code }),
    });

    const resRetry = await redeemRoute(reqRetry, { params: Promise.resolve({ storeSlug: slug }) });
    expect(resRetry.status).toBe(400);
  });

  it("5. Cross-store gift card redemption is rejected (tenant isolation)", async () => {
    const storeA = await createStore(`storea-${generateUuidV7().slice(-6)}`);
    const storeB = await createStore(`storeb-${generateUuidV7().slice(-6)}`);

    const { cookie: cookieB } = await createCustomerSession(storeB.storeId, storeB.slug, "Bob StoreB");

    // Card created in Store A
    const cardA = await giftCardService.createGiftCard(db, storeA.storeId, {
      initialBalance: 50000,
      currency: "INR",
    });

    // Attempt to redeem Store A's card in Store B
    const reqCross = new Request(`http://localhost/api/v1/storefront/${storeB.slug}/gift-cards/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieB,
      },
      body: JSON.stringify({ code: cardA.code }),
    });

    const resCross = await redeemRoute(reqCross, { params: Promise.resolve({ storeSlug: storeB.slug }) });
    // Should be not found in Store B
    expect(resCross.status).toBe(404);
  });
});
