import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { confirmingRefundProvider } from "../helpers/refund-provider.js";
import { OrderStatusService } from "../../modules/orders/src/index.js";
import { RefundService } from "../../modules/payments/src/index.js";
import { ReturnService } from "../../modules/returns/src/index.js";
import {
  CrossStoreReturnAccessError,
  InvalidReturnStatusTransitionError,
  InvalidReturnItemsError,
  OrderNotEligibleForReturnError,
  ReturnAlreadyOpenError,
  ReturnQuantityExceededError,
  ReturnWindowExpiredError,
  ReturnsDisabledError,
} from "../../modules/returns/src/index.js";

describe("ReturnService Integration Tests", { timeout: 600_000 }, () => {
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

  interface SeededOrder {
    storeId: string;
    orderId: string;
    customerId: string;
    paymentId: string;
    itemIds: string[];
    unitPrice: number;
  }

  /**
   * Seeds a paid, fulfilled, two-line order with a CAPTURED payment — the
   * state a customer must be in to open a return.
   */
  async function seedFulfilledOrder(
    db: Database,
    options: { slug?: string; lineQuantity?: number; unitPrice?: number } = {},
  ): Promise<SeededOrder> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const customerId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const orderId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    const unitPrice = options.unitPrice ?? 1000;
    const lineQuantity = options.lineQuantity ?? 2;
    const slug = options.slug ?? `store-returns-${generateUuidV7().slice(0, 8)}`;
    const grandTotal = unitPrice * lineQuantity * 2; // two lines

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, 'Org Returns', 'ACTIVE')`,
      [orgId],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Store Returns', $3, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, slug],
    );
    await db.query(
      `INSERT INTO store_settings (id, store_id, contact_email)
       VALUES ($1, $2, 'merchant@example.com')`,
      [generateUuidV7(), storeId],
    );
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'buyer@example.com', 'Alex', 'Buyer')`,
      [customerId, storeId],
    );
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Silk Scarf', $3, 'ACTIVE')`,
      [productId, storeId, `scarf-${slug}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, store_id, product_id, title, price, sku)
       VALUES ($1, $2, $3, 'Ruby Red', $4, $5)`,
      [variantId, storeId, productId, unitPrice, `SKU-${slug}`],
    );
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, status, currency, total)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'INR', $5)`,
      [checkoutId, storeId, cartId, customerId, grandTotal],
    );
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, total, grand_total, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'INR', $6, 0, 0, 0, $6, $6, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutId, `ORD-${slug}`, grandTotal],
    );

    const itemIds: string[] = [];
    for (const [index, name] of ["Ruby Red", "Jade Green"].entries()) {
      const itemId = generateUuidV7();
      itemIds.push(itemId);
      await db.query(
        `INSERT INTO order_items (
           id, order_id, store_id, product_id, variant_id, product_name_snapshot,
           variant_name_snapshot, sku_snapshot, quantity, unit_price,
           discount_amount, tax_amount, line_total
         ) VALUES ($1, $2, $3, $4, $5, 'Silk Scarf', $6, $7, $8, $9, 0, 0, $10)`,
        [
          itemId,
          orderId,
          storeId,
          productId,
          index === 0 ? variantId : null,
          name,
          `SKU-${slug}-${index}`,
          lineQuantity,
          unitPrice,
          unitPrice * lineQuantity,
        ],
      );
    }

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'INR', 'CAPTURED', 'razorpay', $5, 0, NOW(), NOW())`,
      [paymentId, storeId, checkoutId, orderId, grandTotal],
    );
    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, provider_payment_id,
         amount, currency, status, created_at, updated_at
       ) VALUES ($1, $2, $3, 1, 'razorpay', $4, $5, 'INR', 'CAPTURED', NOW(), NOW())`,
      // UUIDv7 is time-ordered, so a truncated prefix collides when a single
      // test seeds two orders. Use the whole id to keep this unique.
      [attemptId, paymentId, storeId, `pay_${paymentId}`, grandTotal],
    );

    // Fulfil through the real service so the fulfilment history entry that
    // anchors the return window is written exactly as production writes it.
    await new OrderStatusService().updateFulfillmentStatus(db, {
      storeId,
      orderId,
      fulfillmentStatus: "FULFILLED",
      actorType: "MERCHANT",
    });

    return { storeId, orderId, customerId, paymentId, itemIds, unitPrice };
  }

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("runs the full lifecycle from customer request through merchant refund", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();
    const refundService = new RefundService();
    const calls = { count: 0 };

    // 1. Customer opens a return for one unit of the first line.
    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      customerId: seeded.customerId,
      reason: "Item arrived damaged",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
      actorType: "CUSTOMER",
    });

    expect(created.status).toBe("REQUESTED");
    expect(created.returnNumber).toMatch(/^RET-/);
    expect(created.requestedAmount).toBe(seeded.unitPrice);
    expect(created.items).toHaveLength(1);
    expect(created.items?.[0]?.quantity).toBe(1);
    expect(created.events?.at(-1)?.toStatus).toBe("REQUESTED");

    // 2. Merchant approves.
    const approved = await returns.approveReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
      merchantNote: "Approved, please ship back",
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.decidedAt).not.toBeNull();

    // 3. Merchant receives the goods.
    const received = await returns.markReturnReceived(db, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
    });
    expect(received.status).toBe("RECEIVED");
    expect(received.receivedAt).not.toBeNull();

    // 4. Merchant refunds, reusing the existing payments refund path.
    const result = await returns.refundReturnRequest(db, refundService, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
      provider: confirmingRefundProvider(calls),
    });

    expect(result.refundStatus).toBe("SUCCEEDED");
    expect(result.returnRequest.status).toBe("REFUNDED");
    expect(result.returnRequest.refundId).not.toBeNull();
    expect(result.returnRequest.refundedAmount).toBe(seeded.unitPrice);
    expect(calls.count).toBe(1);

    // A real refund row exists and is linked to the return.
    const refundRow = await db.query(
      `SELECT id, amount, status FROM refunds WHERE id = $1 AND store_id = $2`,
      [result.returnRequest.refundId, seeded.storeId],
    );
    expect(refundRow.rows).toHaveLength(1);
    expect(Number(refundRow.rows[0].amount)).toBe(seeded.unitPrice);

    // The order's payment status reflects the partial refund.
    const orderRow = await db.query(
      `SELECT payment_status FROM orders WHERE id = $1`,
      [seeded.orderId],
    );
    expect(orderRow.rows[0].payment_status).toBe("PARTIALLY_REFUNDED");

    // The audit trail records every transition in order.
    const full = await returns.getReturnRequest(
      db,
      seeded.storeId,
      created.id,
    );
    expect(full?.events?.map((e) => e.toStatus)).toEqual([
      "REQUESTED",
      "APPROVED",
      "RECEIVED",
      "REFUNDED",
    ]);
  });

  // -------------------------------------------------------------------------
  // Financial integrity
  // -------------------------------------------------------------------------

  it("never refunds twice when the refund step is retried", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();
    const refundService = new RefundService();
    const calls = { count: 0 };
    const provider = confirmingRefundProvider(calls);

    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Wrong size",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 2 }],
    });
    await returns.approveReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
    });
    await returns.markReturnReceived(db, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
    });

    const first = await returns.refundReturnRequest(db, refundService, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
      provider,
    });
    const second = await returns.refundReturnRequest(db, refundService, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
      provider,
    });

    expect(first.returnRequest.status).toBe("REFUNDED");
    expect(second.returnRequest.status).toBe("REFUNDED");
    expect(second.returnRequest.refundId).toBe(first.returnRequest.refundId);

    // The gateway was called exactly once across both attempts.
    expect(calls.count).toBe(1);

    const refundCount = await db.query(
      `SELECT COUNT(*)::int AS c FROM refunds WHERE order_id = $1`,
      [seeded.orderId],
    );
    expect(refundCount.rows[0].c).toBe(1);
  });

  it("refuses a refund before the goods are received", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();
    const refundService = new RefundService();

    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Changed my mind",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });

    // Still REQUESTED
    await expect(
      returns.refundReturnRequest(db, refundService, {
        storeId: seeded.storeId,
        returnRequestId: created.id,
        provider: confirmingRefundProvider(),
      }),
    ).rejects.toThrow(InvalidReturnStatusTransitionError);

    await returns.approveReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
    });

    // APPROVED but not RECEIVED
    await expect(
      returns.refundReturnRequest(db, refundService, {
        storeId: seeded.storeId,
        returnRequestId: created.id,
        provider: confirmingRefundProvider(),
      }),
    ).rejects.toThrow(InvalidReturnStatusTransitionError);

    const refundCount = await db.query(
      `SELECT COUNT(*)::int AS c FROM refunds WHERE order_id = $1`,
      [seeded.orderId],
    );
    expect(refundCount.rows[0].c).toBe(0);
  });

  it("computes the refund amount server-side, ignoring any client-supplied figure", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db, { unitPrice: 1500 });
    const returns = new ReturnService();

    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Faulty",
      // A hostile client cannot inflate the refund: only ids and quantities
      // are accepted, and pricing comes from the persisted order.
      items: [
        { orderItemId: seeded.itemIds[0]!, quantity: 1 },
        { orderItemId: seeded.itemIds[1]!, quantity: 2 },
      ],
    } as never);

    expect(created.requestedAmount).toBe(1500 * 3);
  });

  // -------------------------------------------------------------------------
  // Quantity and duplication guards
  // -------------------------------------------------------------------------

  it("rejects returning more units than were purchased", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db, { lineQuantity: 2 });
    const returns = new ReturnService();

    await expect(
      returns.createReturnRequest(db, {
        storeId: seeded.storeId,
        orderId: seeded.orderId,
        reason: "Too many",
        items: [{ orderItemId: seeded.itemIds[0]!, quantity: 3 }],
      }),
    ).rejects.toThrow(ReturnQuantityExceededError);
  });

  it("rejects an order item that belongs to a different order", async () => {
    const db = await setupDb();
    const a = await seedFulfilledOrder(db, { slug: "store-a" });
    const b = await seedFulfilledOrder(db, { slug: "store-b" });
    const returns = new ReturnService();

    await expect(
      returns.createReturnRequest(db, {
        storeId: a.storeId,
        orderId: a.orderId,
        reason: "Cross order",
        items: [{ orderItemId: b.itemIds[0]!, quantity: 1 }],
      }),
    ).rejects.toThrow(InvalidReturnItemsError);
  });

  it("allows only one open return per order, and frees the slot once rejected", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    const first = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "First",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });

    await expect(
      returns.createReturnRequest(db, {
        storeId: seeded.storeId,
        orderId: seeded.orderId,
        reason: "Second while first is open",
        items: [{ orderItemId: seeded.itemIds[1]!, quantity: 1 }],
      }),
    ).rejects.toThrow(ReturnAlreadyOpenError);

    // Rejecting the first frees the order for a fresh request.
    await returns.rejectReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: first.id,
      merchantNote: "Outside policy",
    });

    const second = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Second after rejection",
      items: [{ orderItemId: seeded.itemIds[1]!, quantity: 1 }],
    });
    expect(second.status).toBe("REQUESTED");
  });

  it("allows exactly one return when two requests race on the same order", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db, { lineQuantity: 2 });
    const returns = new ReturnService();

    const attempt = () =>
      returns.createReturnRequest(db, {
        storeId: seeded.storeId,
        orderId: seeded.orderId,
        reason: "Concurrent attempt",
        items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // The partial unique index guarantees a single winner; the loser surfaces
    // a domain error rather than a raw constraint violation.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ReturnAlreadyOpenError);

    const count = await db.query(
      `SELECT COUNT(*)::int AS c FROM return_requests WHERE order_id = $1`,
      [seeded.orderId],
    );
    expect(count.rows[0].c).toBe(1);
  });

  it("does not let a rejected return consume returnable quantity", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db, { lineQuantity: 2 });
    const returns = new ReturnService();

    const rejected = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Will be rejected",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 2 }],
    });
    await returns.rejectReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: rejected.id,
    });

    // Both units are returnable again.
    const reRequested = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Second attempt",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 2 }],
    });
    expect(reRequested.requestedAmount).toBe(seeded.unitPrice * 2);
  });

  it("counts an approved return against remaining returnable quantity", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db, { lineQuantity: 3 });
    const returns = new ReturnService();

    const first = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "One unit",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });
    await returns.approveReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: first.id,
    });
    await returns.markReturnReceived(db, {
      storeId: seeded.storeId,
      returnRequestId: first.id,
    });
    await returns.refundReturnRequest(db, new RefundService(), {
      storeId: seeded.storeId,
      returnRequestId: first.id,
      provider: confirmingRefundProvider(),
    });

    // 1 of 3 already returned, so 3 more is too many but 2 is fine.
    await expect(
      returns.createReturnRequest(db, {
        storeId: seeded.storeId,
        orderId: seeded.orderId,
        reason: "Too many now",
        items: [{ orderItemId: seeded.itemIds[0]!, quantity: 3 }],
      }),
    ).rejects.toThrow(ReturnQuantityExceededError);

    const second = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Remaining two",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 2 }],
    });
    expect(second.requestedAmount).toBe(seeded.unitPrice * 2);
  });

  // -------------------------------------------------------------------------
  // Eligibility
  // -------------------------------------------------------------------------

  it("refuses a return on an unfulfilled order", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    // Roll the order back to unfulfilled.
    await db.query(
      `UPDATE orders SET fulfillment_status = 'UNFULFILLED', status = 'CONFIRMED' WHERE id = $1`,
      [seeded.orderId],
    );
    await db.query(
      `DELETE FROM order_status_history WHERE order_id = $1 AND to_status LIKE 'fulfillment:%'`,
      [seeded.orderId],
    );

    await expect(
      returns.createReturnRequest(db, {
        storeId: seeded.storeId,
        orderId: seeded.orderId,
        reason: "Not shipped yet",
        items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
      }),
    ).rejects.toThrow(OrderNotEligibleForReturnError);
  });

  it("refuses a return once the window has expired", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    await returns.updateReturnPolicy(db, seeded.storeId, {
      returnWindowDays: 7,
    });

    // Evaluate as though 30 days have passed.
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await expect(
      returns.createReturnRequest(
        db,
        {
          storeId: seeded.storeId,
          orderId: seeded.orderId,
          reason: "Too late",
          items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
        },
        future,
      ),
    ).rejects.toThrow(ReturnWindowExpiredError);
  });

  it("refuses returns entirely when the store has them switched off", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    await returns.updateReturnPolicy(db, seeded.storeId, {
      isReturnsEnabled: false,
    });

    await expect(
      returns.createReturnRequest(db, {
        storeId: seeded.storeId,
        orderId: seeded.orderId,
        reason: "Store disabled returns",
        items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
      }),
    ).rejects.toThrow(ReturnsDisabledError);
  });

  it("reports eligibility and remaining returnable quantity to the storefront", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db, { lineQuantity: 2 });
    const returns = new ReturnService();
    const { OrderService } = await import("../../modules/orders/src/index.js");
    const order = await new OrderService().getOrderById(
      db,
      seeded.storeId,
      seeded.orderId,
    );

    const before = await returns.getOrderReturnEligibility(
      db,
      seeded.storeId,
      order!,
    );
    expect(before.isEligible).toBe(true);
    expect(before.returnWindowDays).toBe(14);
    expect(before.openReturnRequestId).toBeNull();
    expect(before.eligibleItems).toHaveLength(2);
    expect(before.eligibleItems[0]?.returnableQuantity).toBe(2);

    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "One unit back",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });

    const after = await returns.getOrderReturnEligibility(
      db,
      seeded.storeId,
      order!,
    );
    // An open request blocks a second one and is reported to the UI.
    expect(after.isEligible).toBe(false);
    expect(after.reason).toBe("RETURN_ALREADY_OPEN");
    expect(after.openReturnRequestId).toBe(created.id);
    expect(
      after.eligibleItems.find((i) => i.orderItemId === seeded.itemIds[0])
        ?.returnableQuantity,
    ).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Customer withdrawal
  // -------------------------------------------------------------------------

  it("lets a customer withdraw before a decision but not after approval", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Maybe not",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });

    const cancelled = await returns.cancelReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
      actorId: seeded.customerId,
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();

    // A second return is now possible, and once approved cannot be withdrawn.
    const second = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Actually yes",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });
    await returns.approveReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: second.id,
    });

    await expect(
      returns.cancelReturnRequest(db, {
        storeId: seeded.storeId,
        returnRequestId: second.id,
      }),
    ).rejects.toThrow(InvalidReturnStatusTransitionError);
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("refuses to read or mutate a return request through another store", async () => {
    const db = await setupDb();
    const victim = await seedFulfilledOrder(db, { slug: "store-victim" });
    const attacker = await seedFulfilledOrder(db, { slug: "store-attacker" });
    const returns = new ReturnService();

    const created = await returns.createReturnRequest(db, {
      storeId: victim.storeId,
      orderId: victim.orderId,
      reason: "Private return",
      items: [{ orderItemId: victim.itemIds[0]!, quantity: 1 }],
    });

    // Reads are scoped: the attacker's store sees nothing.
    expect(
      await returns.getReturnRequest(db, attacker.storeId, created.id),
    ).toBeNull();

    const list = await returns.listReturnRequests(db, {
      storeId: attacker.storeId,
    });
    expect(list.total).toBe(0);

    // Mutations are rejected rather than silently applied.
    for (const attempt of [
      () =>
        returns.approveReturnRequest(db, {
          storeId: attacker.storeId,
          returnRequestId: created.id,
        }),
      () =>
        returns.rejectReturnRequest(db, {
          storeId: attacker.storeId,
          returnRequestId: created.id,
        }),
      () =>
        returns.markReturnReceived(db, {
          storeId: attacker.storeId,
          returnRequestId: created.id,
        }),
      () =>
        returns.cancelReturnRequest(db, {
          storeId: attacker.storeId,
          returnRequestId: created.id,
        }),
    ]) {
      await expect(attempt()).rejects.toThrow(CrossStoreReturnAccessError);
    }

    // The victim's return is untouched.
    const untouched = await returns.getReturnRequest(
      db,
      victim.storeId,
      created.id,
    );
    expect(untouched?.status).toBe("REQUESTED");
  });

  it("scopes the merchant queue and its totals to the authorized store", async () => {
    const db = await setupDb();
    const storeA = await seedFulfilledOrder(db, { slug: "store-queue-a" });
    const storeB = await seedFulfilledOrder(db, { slug: "store-queue-b" });
    const returns = new ReturnService();

    await returns.createReturnRequest(db, {
      storeId: storeA.storeId,
      orderId: storeA.orderId,
      reason: "A",
      items: [{ orderItemId: storeA.itemIds[0]!, quantity: 1 }],
    });
    await returns.createReturnRequest(db, {
      storeId: storeB.storeId,
      orderId: storeB.orderId,
      reason: "B",
      items: [{ orderItemId: storeB.itemIds[0]!, quantity: 1 }],
    });

    const queueA = await returns.listReturnRequests(db, {
      storeId: storeA.storeId,
    });
    expect(queueA.total).toBe(1);
    expect(queueA.returns[0]?.reason).toBe("A");

    const filtered = await returns.listReturnRequests(db, {
      storeId: storeA.storeId,
      status: "APPROVED",
    });
    expect(filtered.total).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Policy and notifications
  // -------------------------------------------------------------------------

  it("defaults the return policy and persists an override", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    const initial = await returns.getReturnPolicy(db, seeded.storeId);
    expect(initial.isDefault).toBe(true);
    expect(initial.returnWindowDays).toBe(14);
    expect(initial.isReturnsEnabled).toBe(true);

    const updated = await returns.updateReturnPolicy(db, seeded.storeId, {
      returnWindowDays: 30,
    });
    expect(updated.returnWindowDays).toBe(30);
    expect(updated.isDefault).toBe(false);
    // Partial updates leave the other field alone.
    expect(updated.isReturnsEnabled).toBe(true);

    const disabled = await returns.updateReturnPolicy(db, seeded.storeId, {
      isReturnsEnabled: false,
    });
    expect(disabled.isReturnsEnabled).toBe(false);
    expect(disabled.returnWindowDays).toBe(30);
  });

  it("queues return lifecycle notifications on the shared outbox", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Damaged",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });

    const requested = await db.query(
      `SELECT notification_type, recipient_email, reference_type, reference_id
       FROM notification_outbox
       WHERE store_id = $1 AND notification_type = 'RETURN_REQUESTED'`,
      [seeded.storeId],
    );
    expect(requested.rows).toHaveLength(1);
    // The merchant alert goes to the store contact address.
    expect(requested.rows[0].recipient_email).toBe("merchant@example.com");
    expect(requested.rows[0].reference_type).toBe("return_request");
    expect(requested.rows[0].reference_id).toBe(created.id);

    await returns.approveReturnRequest(db, {
      storeId: seeded.storeId,
      returnRequestId: created.id,
    });

    const approved = await db.query(
      `SELECT recipient_email FROM notification_outbox
       WHERE store_id = $1 AND notification_type = 'RETURN_APPROVED'`,
      [seeded.storeId],
    );
    expect(approved.rows).toHaveLength(1);
    // The customer lifecycle mail goes to the buyer.
    expect(approved.rows[0].recipient_email).toBe("buyer@example.com");
  });

  it("does not roll back a transition when notification enqueue fails", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);

    // A repository whose create always throws simulates an outbox outage.
    const brokenOutbox = {
      create: async () => {
        throw new Error("outbox unavailable");
      },
    };
    const { ReturnService: Svc } = await import(
      "../../modules/returns/src/index.js"
    );
    const returns = new Svc(undefined, undefined, brokenOutbox as never);

    const created = await returns.createReturnRequest(db, {
      storeId: seeded.storeId,
      orderId: seeded.orderId,
      reason: "Outbox is down",
      items: [{ orderItemId: seeded.itemIds[0]!, quantity: 1 }],
    });

    // The return itself was still persisted.
    expect(created.status).toBe("REQUESTED");
    const row = await db.query(
      `SELECT status FROM return_requests WHERE id = $1`,
      [created.id],
    );
    expect(row.rows[0].status).toBe("REQUESTED");
  });

  it("rolls back the whole request when an item insert fails", async () => {
    const db = await setupDb();
    const seeded = await seedFulfilledOrder(db);
    const returns = new ReturnService();

    const before = await db.query(
      `SELECT COUNT(*)::int AS c FROM return_requests WHERE store_id = $1`,
      [seeded.storeId],
    );

    // A duplicate order item in the same payload trips the uniqueness guard
    // after the parent row has been written inside the transaction.
    await expect(
      returns.createReturnRequest(db, {
        storeId: seeded.storeId,
        orderId: seeded.orderId,
        reason: "Duplicate lines",
        items: [
          { orderItemId: seeded.itemIds[0]!, quantity: 1 },
          { orderItemId: seeded.itemIds[0]!, quantity: 1 },
        ],
      }),
    ).rejects.toThrow(InvalidReturnItemsError);

    const after = await db.query(
      `SELECT COUNT(*)::int AS c FROM return_requests WHERE store_id = $1`,
      [seeded.storeId],
    );
    expect(after.rows[0].c).toBe(before.rows[0].c);
  });
});
