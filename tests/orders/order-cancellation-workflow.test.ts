import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  OrderCancellationCoordinator,
  type InventoryReleaseCoordinator,
  type CancellationRefundCoordinator,
} from "../../modules/orders/src/application/order-cancellation-coordinator.js";
import {
  CrossStoreOrderAccessError,
  OrderCancellationError,
  OrderImmutableError,
  OrderNotFoundError,
} from "../../modules/orders/src/domain/order-errors.js";

describe("OrderCancellationCoordinator Unit & Integration Tests", { timeout: 30_000 }, () => {
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

  async function seedStoreAndOrder(
    db: Database,
    options: {
      status?: string;
      slug?: string;
    } = {},
  ): Promise<{ orgId: string; storeId: string; orderId: string; customerId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const orderId = generateUuidV7();
    const customerId = generateUuidV7();
    const slug = options.slug ?? "store-cancel-coord";

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, `Store ${slug}`, `${slug}-${Date.now()}`],
    );
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'cust@example.com', 'Test', 'Customer')`,
      [customerId, storeId],
    );
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, grand_total, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'PAID', 'UNFULFILLED', 'INR', 5000, 0, 0, 0, 5000, NOW(), NOW())`,
      [orderId, storeId, customerId, `ORD-${Date.now()}`, options.status ?? "CONFIRMED"],
    );

    return { orgId, storeId, orderId, customerId };
  }

  it("successfully coordinates order cancellation, inventory release, and refund", async () => {
    const db = await setupDb();
    const { storeId, orderId } = await seedStoreAndOrder(db, { status: "CONFIRMED" });

    let inventoryReleaseCalled = false;
    const mockInventoryService: InventoryReleaseCoordinator = {
      releaseOrderReservations: async (_client, input) => {
        inventoryReleaseCalled = true;
        expect(input.storeId).toBe(storeId);
        expect(input.orderId).toBe(orderId);
        return { releasedCount: 2, skippedCount: 0 };
      },
    };

    let refundCalled = false;
    const mockRefundService: CancellationRefundCoordinator = {
      processCancellationRefund: async (_client, input) => {
        refundCalled = true;
        expect(input.storeId).toBe(storeId);
        expect(input.orderId).toBe(orderId);
        return { status: "SUCCEEDED", refundId: "rfnd_123", amount: 5000 };
      },
    };

    const coordinator = new OrderCancellationCoordinator(
      undefined,
      undefined,
      mockInventoryService,
      mockRefundService,
    );

    const result = await coordinator.cancelOrder(db, {
      storeId,
      orderId,
      reason: "Customer requested cancellation",
      actorType: "MERCHANT",
    });

    expect(result.order.status).toBe("CANCELLED");
    expect(result.cancellationStatus).toBe("CANCELLED");
    expect(result.inventory.released).toBe(true);
    expect(result.inventory.releasedCount).toBe(2);
    expect(result.refund.status).toBe("SUCCEEDED");
    expect(result.refund.refundId).toBe("rfnd_123");
    expect(inventoryReleaseCalled).toBe(true);
    expect(refundCalled).toBe(true);
  });

  it("rejects cancellation for ineligible terminal order (SHIPPED)", async () => {
    const db = await setupDb();
    const { storeId, orderId } = await seedStoreAndOrder(db, { status: "SHIPPED" });

    const coordinator = new OrderCancellationCoordinator();

    await expect(
      coordinator.cancelOrder(db, {
        storeId,
        orderId,
        reason: "Late cancellation",
      }),
    ).rejects.toThrow(OrderCancellationError);
  });

  it("rejects duplicate cancellation request with OrderImmutableError when allowAlreadyCancelled is false", async () => {
    const db = await setupDb();
    const { storeId, orderId } = await seedStoreAndOrder(db, { status: "CONFIRMED" });

    const coordinator = new OrderCancellationCoordinator();

    // First cancellation succeeds
    await coordinator.cancelOrder(db, {
      storeId,
      orderId,
      reason: "First cancel",
    });

    // Second cancellation rejected
    await expect(
      coordinator.cancelOrder(db, {
        storeId,
        orderId,
        reason: "Second cancel attempt",
      }),
    ).rejects.toThrow(OrderImmutableError);
  });

  it("allows retrying side effects in recovery mode (allowAlreadyCancelled: true) on already cancelled order", async () => {
    const db = await setupDb();
    const { storeId, orderId } = await seedStoreAndOrder(db, { status: "CANCELLED" });

    let inventoryCalled = false;
    const mockInventory: InventoryReleaseCoordinator = {
      releaseOrderReservations: async () => {
        inventoryCalled = true;
        return { releasedCount: 1, skippedCount: 0 };
      },
    };

    let refundCalled = false;
    const mockRefund: CancellationRefundCoordinator = {
      processCancellationRefund: async () => {
        refundCalled = true;
        return { status: "SUCCEEDED", refundId: "rfnd_recovered" };
      },
    };

    const coordinator = new OrderCancellationCoordinator(
      undefined,
      undefined,
      mockInventory,
      mockRefund,
    );

    const result = await coordinator.cancelOrder(db, {
      storeId,
      orderId,
      reason: "Recovery retry",
      allowAlreadyCancelled: true,
    });

    expect(result.cancellationStatus).toBe("ALREADY_CANCELLED");
    expect(result.inventory.released).toBe(true);
    expect(result.refund.status).toBe("SUCCEEDED");
    expect(inventoryCalled).toBe(true);
    expect(refundCalled).toBe(true);
  });

  it("enforces tenant isolation and rejects cross-store order cancellation", async () => {
    const db = await setupDb();
    const storeA = await seedStoreAndOrder(db, { slug: "store-iso-a" });
    const storeB = await seedStoreAndOrder(db, { slug: "store-iso-b" });

    const coordinator = new OrderCancellationCoordinator();

    // Store B attempts to cancel Store A's order
    await expect(
      coordinator.cancelOrder(db, {
        storeId: storeB.storeId,
        orderId: storeA.orderId,
        reason: "Cross store cancel attempt",
      }),
    ).rejects.toThrow(CrossStoreOrderAccessError);
  });

  it("rejects non-existent order with OrderNotFoundError", async () => {
    const db = await setupDb();
    const { storeId } = await seedStoreAndOrder(db);

    const coordinator = new OrderCancellationCoordinator();

    await expect(
      coordinator.cancelOrder(db, {
        storeId,
        orderId: generateUuidV7(),
        reason: "Cancel non-existent",
      }),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it("captures partial side effect errors without corrupting order status", async () => {
    const db = await setupDb();
    const { storeId, orderId } = await seedStoreAndOrder(db, { status: "CONFIRMED" });

    const failingInventory: InventoryReleaseCoordinator = {
      releaseOrderReservations: async () => {
        throw new Error("Deadlock on inventory item");
      },
    };

    const timingOutRefund: CancellationRefundCoordinator = {
      processCancellationRefund: async () => {
        return {
          status: "REQUIRES_RECONCILIATION",
          refundId: "rfnd_ambiguous",
          error: "Gateway timeout",
        };
      },
    };

    const coordinator = new OrderCancellationCoordinator(
      undefined,
      undefined,
      failingInventory,
      timingOutRefund,
    );

    const result = await coordinator.cancelOrder(db, {
      storeId,
      orderId,
      reason: "Cancelled with partial side-effect failures",
    });

    // Order cancellation persisted
    expect(result.order.status).toBe("CANCELLED");
    // Inventory failure accurately reflected
    expect(result.inventory.released).toBe(false);
    expect(result.inventory.error).toContain("Deadlock on inventory item");
    // Refund reconciliation accurately reflected
    expect(result.refund.status).toBe("REQUIRES_RECONCILIATION");
    expect(result.refund.refundId).toBe("rfnd_ambiguous");
  });
});
