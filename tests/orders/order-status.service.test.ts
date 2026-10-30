import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  OrderRepository,
} from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { OrderService } from "../../modules/orders/src/application/order-service.js";
import { OrderStatusService } from "../../modules/orders/src/application/order-status-service.js";
import {
  CrossStoreOrderAccessError,
  InvalidOrderStatusTransitionError,
  OrderCancellationError,
  OrderImmutableError,
  OrderNotFoundError,
  UnauthorizedPaymentStatusChangeError,
} from "../../modules/orders/src/domain/order-errors.js";
import type { TrustedCheckoutData } from "../../modules/orders/src/application/dtos.js";

describe("OrderStatusService Integration Tests", { timeout: 30_000 }, () => {
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
    slug = "store-orders-status",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { orgId, storeId };
  }

  async function createInitialOrder(
    db: Database,
    storeId: string,
  ): Promise<{ orderId: string; checkoutId: string }> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, 3000, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId],
    );

    const orderService = new OrderService();
    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      currency: "USD",
      items: [
        {
          productNameSnapshot: "Test Item",
          variantNameSnapshot: "Standard",
          unitPrice: 3000,
          quantity: 1,
        },
      ],
    };

    const order = await orderService.createOrderFromCheckout(db, {
      storeId,
      checkout: checkoutData,
    });

    return { orderId: order.id, checkoutId };
  }

  it("transitions order status forward and records status history atomically", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await createInitialOrder(db, storeId);

    const statusService = new OrderStatusService();
    const merchantId = generateUuidV7();

    // 1. PENDING -> CONFIRMED
    const confirmed = await statusService.transitionStatus(db, {
      storeId,
      orderId,
      toStatus: "CONFIRMED",
      actorType: "MERCHANT",
      actorId: merchantId,
      reason: "Payment verified",
    });

    expect(confirmed.status).toBe("CONFIRMED");

    // 2. CONFIRMED -> PROCESSING
    const processing = await statusService.transitionStatus(db, {
      storeId,
      orderId,
      toStatus: "PROCESSING",
      actorType: "SYSTEM",
      reason: "Sent to warehouse",
    });

    expect(processing.status).toBe("PROCESSING");

    // 3. PROCESSING -> SHIPPED
    const shipped = await statusService.transitionStatus(db, {
      storeId,
      orderId,
      toStatus: "SHIPPED",
      actorType: "MERCHANT",
      reason: "Carrier picked up package",
    });

    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.fulfillmentStatus).toBe("FULFILLED");

    // 4. SHIPPED -> DELIVERED
    const delivered = await statusService.transitionStatus(db, {
      storeId,
      orderId,
      toStatus: "DELIVERED",
      actorType: "SYSTEM",
      reason: "Carrier confirmed delivery",
    });

    expect(delivered.status).toBe("DELIVERED");

    // 5. DELIVERED -> COMPLETED
    const completed = await statusService.transitionStatus(db, {
      storeId,
      orderId,
      toStatus: "COMPLETED",
      actorType: "SYSTEM",
      reason: "Return window passed",
    });

    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();

    // Verify history in database (1 creation + 5 transitions = 6 records)
    const historyRes = await db.query(
      `SELECT * FROM order_status_history WHERE order_id = $1 AND store_id = $2 ORDER BY created_at ASC`,
      [orderId, storeId],
    );
    expect(historyRes.rows).toHaveLength(6);
    expect(historyRes.rows[1].from_status).toBe("PENDING");
    expect(historyRes.rows[1].to_status).toBe("CONFIRMED");
    expect(historyRes.rows[1].actor_type).toBe("MERCHANT");
    expect(historyRes.rows[1].actor_id).toBe(merchantId);
  });

  it("rejects invalid status transitions and leaves order state untouched", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await createInitialOrder(db, storeId);

    const statusService = new OrderStatusService();

    // PENDING cannot skip directly to SHIPPED or COMPLETED
    await expect(
      statusService.transitionStatus(db, {
        storeId,
        orderId,
        toStatus: "SHIPPED",
        actorType: "MERCHANT",
      }),
    ).rejects.toThrow(InvalidOrderStatusTransitionError);

    await expect(
      statusService.transitionStatus(db, {
        storeId,
        orderId,
        toStatus: "COMPLETED",
        actorType: "MERCHANT",
      }),
    ).rejects.toThrow(InvalidOrderStatusTransitionError);

    // Order status remains PENDING in DB
    const res = await db.query(
      `SELECT status FROM orders WHERE id = $1 AND store_id = $2`,
      [orderId, storeId],
    );
    expect(res.rows[0].status).toBe("PENDING");
  });

  it("handles cancelOrder and forbids cancellation after shipping", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await createInitialOrder(db, storeId);

    const statusService = new OrderStatusService();

    // Cancellation from PENDING
    const cancelled = await statusService.cancelOrder(db, {
      storeId,
      orderId,
      reason: "Customer requested cancellation",
      actorType: "CUSTOMER",
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("Customer requested cancellation");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.fulfillmentStatus).toBe("CANCELLED");

    // Once CANCELLED, any further transition throws OrderImmutableError
    await expect(
      statusService.transitionStatus(db, {
        storeId,
        orderId,
        toStatus: "CONFIRMED",
        actorType: "SYSTEM",
      }),
    ).rejects.toThrow(OrderImmutableError);

    // Create a second order, ship it, and verify cancellation is rejected
    const { orderId: order2Id } = await createInitialOrder(db, storeId);
    await statusService.transitionStatus(db, {
      storeId,
      orderId: order2Id,
      toStatus: "CONFIRMED",
      actorType: "SYSTEM",
    });
    await statusService.transitionStatus(db, {
      storeId,
      orderId: order2Id,
      toStatus: "PROCESSING",
      actorType: "SYSTEM",
    });
    await statusService.transitionStatus(db, {
      storeId,
      orderId: order2Id,
      toStatus: "SHIPPED",
      actorType: "SYSTEM",
    });

    await expect(
      statusService.cancelOrder(db, {
        storeId,
        orderId: order2Id,
        reason: "Late cancel",
      }),
    ).rejects.toThrow(OrderCancellationError);
  });

  it("is idempotent when transitioning to the current state", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await createInitialOrder(db, storeId);

    const statusService = new OrderStatusService();

    // Transitioning PENDING -> PENDING does not throw and does not create duplicate history
    const result = await statusService.transitionStatus(db, {
      storeId,
      orderId,
      toStatus: "PENDING",
      actorType: "SYSTEM",
    });

    expect(result.status).toBe("PENDING");

    const historyRes = await db.query(
      `SELECT * FROM order_status_history WHERE order_id = $1 AND store_id = $2`,
      [orderId, storeId],
    );
    // Still only initial history
    expect(historyRes.rows).toHaveLength(1);
  });

  it("enforces store isolation and rejects cross-store updates", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "store-a");
    const { storeId: storeBId } = await seedTestStore(db, "store-b");
    const { orderId } = await createInitialOrder(db, storeId);

    const statusService = new OrderStatusService();

    // Attempting to update store A's order using store B's identity
    await expect(
      statusService.transitionStatus(db, {
        storeId: storeBId,
        orderId,
        toStatus: "CONFIRMED",
        actorType: "MERCHANT",
      }),
    ).rejects.toThrow(CrossStoreOrderAccessError);

    // Non-existent order throws OrderNotFoundError
    await expect(
      statusService.transitionStatus(db, {
        storeId,
        orderId: generateUuidV7(),
        toStatus: "CONFIRMED",
        actorType: "MERCHANT",
      }),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it("protects payment status from unauthorized updates", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await createInitialOrder(db, storeId);

    const statusService = new OrderStatusService();

    // Client/unauthorized update to PAID is rejected
    await expect(
      statusService.updatePaymentStatus(db, {
        storeId,
        orderId,
        paymentStatus: "PAID",
        authorizedInternalCall: false, // Forbidden!
      }),
    ).rejects.toThrow(UnauthorizedPaymentStatusChangeError);

    // Authorized internal call succeeds and logs status history
    const updated = await statusService.updatePaymentStatus(db, {
      storeId,
      orderId,
      paymentStatus: "PAID",
      authorizedInternalCall: true,
      reason: "Razorpay webhook verified capture",
    });

    expect(updated.paymentStatus).toBe("PAID");

    const historyRes = await db.query(
      `SELECT * FROM order_status_history WHERE order_id = $1 AND to_status = 'payment:PAID'`,
      [orderId],
    );
    expect(historyRes.rows).toHaveLength(1);
    expect(historyRes.rows[0].reason).toBe("Razorpay webhook verified capture");
  });

  it("updates fulfillment status and records audit history", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await createInitialOrder(db, storeId);

    const statusService = new OrderStatusService();

    const updated = await statusService.updateFulfillmentStatus(db, {
      storeId,
      orderId,
      fulfillmentStatus: "PARTIALLY_FULFILLED",
      actorType: "MERCHANT",
      reason: "Partially packed line 1",
    });

    expect(updated.fulfillmentStatus).toBe("PARTIALLY_FULFILLED");

    const historyRes = await db.query(
      `SELECT * FROM order_status_history WHERE order_id = $1 AND to_status = 'fulfillment:PARTIALLY_FULFILLED'`,
      [orderId],
    );
    expect(historyRes.rows).toHaveLength(1);
  });

  it("rolls back atomically if status history persistence fails", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await createInitialOrder(db, storeId);

    // Mock order repo where createStatusHistory throws
    const mockRepo = new OrderRepository();
    mockRepo.createStatusHistory = async () => {
      throw new Error("Simulated audit disk failure");
    };

    const statusService = new OrderStatusService(mockRepo);

    await expect(
      statusService.transitionStatus(db, {
        storeId,
        orderId,
        toStatus: "CONFIRMED",
        actorType: "SYSTEM",
      }),
    ).rejects.toThrow("Simulated audit disk failure");

    // Order status must NOT have been updated to CONFIRMED
    const orderRes = await db.query(
      `SELECT status FROM orders WHERE id = $1 AND store_id = $2`,
      [orderId, storeId],
    );
    expect(orderRes.rows[0].status).toBe("PENDING");
  });
});
