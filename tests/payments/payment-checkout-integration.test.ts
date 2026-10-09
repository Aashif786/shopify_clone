import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database, PaymentRepository } from "@shopify-clone/db";
import { PaymentCheckoutCoordinator } from "../../modules/payments/src/application/payment-checkout-coordinator.js";
import {
  CrossStorePaymentAccessError,
  InvalidCheckoutStateForPaymentError,
  PaymentIdempotencyConflictError,
  PaymentNotFoundError,
} from "../../modules/payments/src/domain/payment-errors.js";
import { CheckoutExpiredError } from "@shopify-clone/checkout";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("INT-01: Payment Checkout Coordinator Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const coordinator = new PaymentCheckoutCoordinator();

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
    slug = "pmt-chk-store",
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

  async function seedTestCart(db: Database, storeId: string): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    return cartId;
  }

  async function seedTestCheckout(
    db: Database,
    storeId: string,
    cartId: string,
    options?: {
      total?: number;
      status?: string;
      currency?: string;
      expiresAt?: Date | null;
    },
  ): Promise<string> {
    const checkoutId = generateUuidV7();
    const total = options?.total ?? 8500;
    const status = options?.status ?? "OPEN";
    const currency = options?.currency ?? "USD";
    const expiresAt = options?.expiresAt ?? null;

    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
      [checkoutId, storeId, cartId, total, status, currency, expiresAt],
    );
    return checkoutId;
  }

  it("atomically transitions OPEN checkout to PAYMENT_PENDING and creates payment + attempt", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "init-success");
    const cartId = await seedTestCart(db, storeId);
    const checkoutId = await seedTestCheckout(db, storeId, cartId, { total: 5000, status: "OPEN" });

    const result = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      idempotencyKey: "idemp-init-1",
    });

    expect(result.isExisting).toBe(false);
    expect(result.payment.amount).toBe(5000);
    expect(result.payment.currency).toBe("USD");
    expect(result.payment.status).toBe("CREATED");
    expect(result.attempt.status).toBe("INITIATED");

    // Verify in database that checkout status is PAYMENT_PENDING
    const checkoutRes = await db.query<{ status: string; payment_status: string }>(
      `SELECT status, payment_status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRes.rows[0]?.status).toBe("PAYMENT_PENDING");
    expect(checkoutRes.rows[0]?.payment_status).toBe("PENDING");

    // Verify payment and attempt exist in database
    const paymentRes = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM payments WHERE id = $1`,
      [result.payment.id],
    );
    expect(paymentRes.rows[0]?.status).toBe("CREATED");
  });

  it("is idempotent on retries with matching idempotencyKey, returning existing payment", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "init-idemp");
    const cartId = await seedTestCart(db, storeId);
    const checkoutId = await seedTestCheckout(db, storeId, cartId, { total: 6000 });

    const first = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      idempotencyKey: "idemp-key-repeat",
    });

    const second = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      idempotencyKey: "idemp-key-repeat",
    });

    expect(second.payment.id).toBe(first.payment.id);
    expect(second.attempt.id).toBe(first.attempt.id);

    // Verify no duplicate payment was created
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM payments WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(countRes.rows[0]?.count).toBe("1");
  });

  it("rejects reuse of idempotency key with conflicting parameters", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "init-conflict");
    const cartId = await seedTestCart(db, storeId);
    const checkoutId1 = await seedTestCheckout(db, storeId, cartId, { total: 4000 });
    const checkoutId2 = await seedTestCheckout(db, storeId, cartId, { total: 4000 });

    await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId: checkoutId1,
      idempotencyKey: "reused-key-1",
    });

    await expect(
      coordinator.initializePaymentForCheckout(db, {
        storeId,
        checkoutId: checkoutId2, // Different checkout with same key!
        idempotencyKey: "reused-key-1",
      }),
    ).rejects.toThrow(PaymentIdempotencyConflictError);
  });

  it("safely resolves concurrent initialization requests for the same checkout without creating duplicate payments", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "init-concurrent");
    const cartId = await seedTestCart(db, storeId);
    const checkoutId = await seedTestCheckout(db, storeId, cartId, { total: 9900 });

    // Execute two concurrent initializations
    const [res1, res2] = await Promise.all([
      coordinator.initializePaymentForCheckout(db, {
        storeId,
        checkoutId,
        idempotencyKey: "concurrent-key-1",
      }),
      coordinator.initializePaymentForCheckout(db, {
        storeId,
        checkoutId,
        idempotencyKey: "concurrent-key-1",
      }),
    ]);

    expect(res1.payment.id).toBe(res2.payment.id);

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM payments WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(countRes.rows[0]?.count).toBe("1");
  });

  it("reverts checkout to OPEN if payment creation fails within the transaction (atomic rollback)", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "init-rollback");
    const cartId = await seedTestCart(db, storeId);
    const checkoutId = await seedTestCheckout(db, storeId, cartId, { total: 5000, status: "OPEN" });

    // Mock payment repository where create throws
    const mockPaymentRepo = new PaymentRepository();
    mockPaymentRepo.create = async () => {
      throw new Error("Simulated database failure during payment insert");
    };

    const faultyCoordinator = new PaymentCheckoutCoordinator(mockPaymentRepo);

    await expect(
      faultyCoordinator.initializePaymentForCheckout(db, {
        storeId,
        checkoutId,
      }),
    ).rejects.toThrow("Simulated database failure during payment insert");

    // Critical Invariant: checkout MUST NOT be stuck in PAYMENT_PENDING!
    const checkoutRes = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRes.rows[0]?.status).toBe("OPEN");

    // No orphan payments created
    const paymentRes = await db.query(
      `SELECT * FROM payments WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(paymentRes.rows).toHaveLength(0);
  });

  it("rejects payment initialization for completed, expired, or cancelled checkouts", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "init-ineligible");
    const cartId = await seedTestCart(db, storeId);

    const completedId = await seedTestCheckout(db, storeId, cartId, { status: "COMPLETED" });
    const cancelledId = await seedTestCheckout(db, storeId, cartId, { status: "CANCELLED" });
    const expiredId = await seedTestCheckout(db, storeId, cartId, {
      status: "OPEN",
      expiresAt: new Date(Date.now() - 60_000), // 1 min ago
    });

    await expect(
      coordinator.initializePaymentForCheckout(db, { storeId, checkoutId: completedId }),
    ).rejects.toThrow(InvalidCheckoutStateForPaymentError);

    await expect(
      coordinator.initializePaymentForCheckout(db, { storeId, checkoutId: cancelledId }),
    ).rejects.toThrow(InvalidCheckoutStateForPaymentError);

    await expect(
      coordinator.initializePaymentForCheckout(db, { storeId, checkoutId: expiredId }),
    ).rejects.toThrow(CheckoutExpiredError);
  });

  it("rejects checkout with zero or negative total", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "init-zero-total");
    const cartId = await seedTestCart(db, storeId);
    const zeroCheckoutId = await seedTestCheckout(db, storeId, cartId, { total: 0 });

    await expect(
      coordinator.initializePaymentForCheckout(db, { storeId, checkoutId: zeroCheckoutId }),
    ).rejects.toThrow(InvalidCheckoutStateForPaymentError);
  });

  it("enforces store isolation and rejects cross-store checkout access", async () => {
    const db = await setupDb();
    const { storeId: storeA } = await seedTestStore(db, "store-a");
    const { storeId: storeB } = await seedTestStore(db, "store-b");
    const cartId = await seedTestCart(db, storeA);
    const checkoutA = await seedTestCheckout(db, storeA, cartId);

    // Attempting to access store A's checkout using store B's identity
    await expect(
      coordinator.initializePaymentForCheckout(db, {
        storeId: storeB,
        checkoutId: checkoutA,
      }),
    ).rejects.toThrow(CrossStorePaymentAccessError);

    // Non-existent checkout
    await expect(
      coordinator.initializePaymentForCheckout(db, {
        storeId: storeA,
        checkoutId: generateUuidV7(),
      }),
    ).rejects.toThrow(PaymentNotFoundError);
  });
});
