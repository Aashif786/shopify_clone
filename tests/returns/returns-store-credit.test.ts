import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { GiftCardService } from "@calcart/giftcards";
import { RefundService } from "@calcart/payments";
import { ReturnService } from "@calcart/returns";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { confirmingRefundProvider } from "../helpers/refund-provider.js";

describe("Customer Returns: Store Credit Refund Workflow (GAP-14 / GAP-13)", { timeout: 120_000 }, () => {
  let db: Database;
  let close: (() => Promise<void>) | undefined;
  const returnService = new ReturnService();
  const giftCardService = new GiftCardService();
  const refundService = new RefundService(undefined, confirmingRefundProvider());

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

  async function seedStore(slug = `ret-sc-${generateUuidV7().slice(-8)}`) {
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

  async function seedReceivedReturnRequest(
    storeId: string,
    options: { requestedAmount?: number; customerId?: string | null } = {},
  ) {
    const orderId = generateUuidV7();
    const returnRequestId = generateUuidV7();
    const customerId = options.customerId !== undefined ? options.customerId : generateUuidV7();
    const requestedAmount = options.requestedAmount ?? 2500;

    if (customerId) {
      await db.query(
        `INSERT INTO customers (id, store_id, email, first_name, last_name)
         VALUES ($1, $2, $3, 'Aarav', 'Patel')
         ON CONFLICT (id) DO NOTHING`,
        [customerId, storeId, `cust-${customerId.slice(-6)}@example.com`],
      );
    }

    await db.query(
      `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'DELIVERED', 'PAID', 'FULFILLED', 'INR', $5, 0, 0, 0, $5, $5, NOW(), NOW())`,
      [orderId, storeId, customerId, `ORD-${generateUuidV7().slice(-6)}`, requestedAmount],
    );

    await db.query(
      `INSERT INTO return_requests (id, store_id, order_id, customer_id, return_number, status, reason, currency, requested_amount, requested_at, decided_at, received_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'RECEIVED', 'Item defective', 'INR', $6, NOW(), NOW(), NOW(), NOW(), NOW())`,
      [returnRequestId, storeId, orderId, customerId, `RET-${generateUuidV7().slice(-6)}`, requestedAmount],
    );

    return { orderId, returnRequestId, customerId, requestedAmount };
  }

  it("issues store credit for a received return request and closes it out", async () => {
    const storeId = await seedStore();
    const { returnRequestId, customerId } =
      await seedReceivedReturnRequest(storeId, { requestedAmount: 3500 });

    const result = await returnService.refundReturnRequest(
      db,
      refundService,
      {
        storeId,
        returnRequestId,
        refundMethod: "STORE_CREDIT",
      },
      giftCardService,
    );

    expect(result.refundStatus).toBe("SUCCEEDED");
    expect(result.returnRequest.status).toBe("REFUNDED");
    expect(result.returnRequest.refundedAmount).toBe(3500);

    // Verify customer's store credit balance in database
    const storeCredit = await giftCardService.getOrCreateStoreCredit(db, storeId, customerId!, "INR");
    expect(storeCredit.currentBalance).toBe(3500);

    // Verify append-only ledger transactions
    const txs = await giftCardService.listStoreCreditTransactions(db, storeId, storeCredit.id);
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe("REFUND");
    expect(txs[0].amount).toBe(3500);
    expect(txs[0].idempotencyKey).toBe(`return-store-credit:${returnRequestId}`);

    // Verify return request events audit log
    const events = await db.query(
      `SELECT * FROM return_request_events WHERE return_request_id = $1 ORDER BY created_at ASC`,
      [returnRequestId],
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
    const lastEvent = events.rows[events.rows.length - 1];
    expect(lastEvent.to_status).toBe("REFUNDED");
    expect(lastEvent.reason).toContain("Store credit");
  });

  it("safely and idempotently replays when store credit refund is called again", async () => {
    const storeId = await seedStore();
    const { returnRequestId, customerId } =
      await seedReceivedReturnRequest(storeId, { requestedAmount: 2000 });

    // First call
    const firstResult = await returnService.refundReturnRequest(
      db,
      refundService,
      {
        storeId,
        returnRequestId,
        refundMethod: "STORE_CREDIT",
      },
      giftCardService,
    );
    expect(firstResult.refundStatus).toBe("SUCCEEDED");

    // Second call (replay)
    const secondResult = await returnService.refundReturnRequest(
      db,
      refundService,
      {
        storeId,
        returnRequestId,
        refundMethod: "STORE_CREDIT",
      },
      giftCardService,
    );
    expect(secondResult.refundStatus).toBe("SUCCEEDED");

    // Verify balance was credited exactly once
    const storeCredit = await giftCardService.getOrCreateStoreCredit(db, storeId, customerId!, "INR");
    expect(storeCredit.currentBalance).toBe(2000);

    const txs = await giftCardService.listStoreCreditTransactions(db, storeId, storeCredit.id);
    expect(txs).toHaveLength(1);
  });

  it("rejects refund to store credit if return request has no customer account", async () => {
    const storeId = await seedStore();
    const { returnRequestId } = await seedReceivedReturnRequest(storeId, {
      customerId: null,
      requestedAmount: 1500,
    });

    await expect(
      returnService.refundReturnRequest(
        db,
        refundService,
        {
          storeId,
          returnRequestId,
          refundMethod: "STORE_CREDIT",
        },
        giftCardService,
      ),
    ).rejects.toThrow(/associated customer account/i);
  });
});
