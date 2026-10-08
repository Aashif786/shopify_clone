import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import { ProductService } from "@shopify-clone/products";
import {
  CrossStoreInventoryAccessError,
  DuplicateReservationError,
  InsufficientStockError,
  InvalidReservationStateTransitionError,
  InventoryNotFoundError,
  InventoryService,
  ReservationNotFoundError,
} from "@shopify-clone/inventory";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Inventory Adversarial & Concurrency Test Suite", { timeout: 45_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const productService = new ProductService();
  const inventoryService = new InventoryService();

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

  async function createTestContext(
    db: Database,
    slug: string,
    initialStock = 10,
  ): Promise<{ storeId: string; variantId: string; productId: string }> {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, `${slug}@example.com`],
    );

    const store = await storeService.createStore(db, userId, {
      name: `Store ${slug}`,
      slug,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    const product = await productService.createProduct(db, store.id, {
      title: "Adversarial Test Item",
      slug: `item-${slug}`,
      price: 5000,
    });
    const variantId = product.variants[0]!.id;

    if (initialStock > 0) {
      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: initialStock,
        reason: "INITIAL_STOCK",
      });
    }

    return { storeId: store.id, variantId, productId: product.id };
  }

  // =========================================================================
  // SECTION 4.A: Three competing reservations
  // =========================================================================
  it("4.A: Three competing reservations (stock=10, A=6, B=6, C=6) -> exactly one succeeds", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "compete-3", 10);

    const results = await Promise.allSettled([
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 6,
        referenceType: "CHECKOUT",
        referenceId: "chk_3_a",
      }),
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 6,
        referenceType: "CHECKOUT",
        referenceId: "chk_3_b",
      }),
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 6,
        referenceType: "CHECKOUT",
        referenceId: "chk_3_c",
      }),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);

    for (const fail of failures) {
      if (fail.status === "rejected") {
        expect(fail.reason).toBeInstanceOf(InsufficientStockError);
      }
    }

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(4);
    expect(avail.reservedQuantity).toBe(6);
    expect(avail.totalQuantity).toBe(10);
  });

  // =========================================================================
  // SECTION 4.B: Many concurrent reservations
  // =========================================================================
  it("4.B: 20 concurrent reservations (stock=100, each 5) -> all succeed, available=0, reserved=100", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-20-exact", 100);

    const promises = Array.from({ length: 20 }, (_, i) =>
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 5,
        referenceType: "CHECKOUT",
        referenceId: `chk_mass_exact_${i}`,
      }),
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter((r) => r.status === "fulfilled");
    expect(successes).toHaveLength(20);

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(0);
    expect(avail.reservedQuantity).toBe(100);
    expect(avail.totalQuantity).toBe(100);
  });

  it("4.B (oversell prevention): 20 concurrent reservations requesting 10 each with stock=100", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-20-oversell", 100);

    const promises = Array.from({ length: 20 }, (_, i) =>
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 10,
        referenceType: "CHECKOUT",
        referenceId: `chk_mass_over_${i}`,
      }),
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    // Exactly 10 can succeed, 10 must fail
    expect(successes).toHaveLength(10);
    expect(failures).toHaveLength(10);

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(0);
    expect(avail.reservedQuantity).toBe(100);
    expect(avail.totalQuantity).toBe(100);
  });

  // =========================================================================
  // SECTION 4.C: Reservation vs adjustment concurrency
  // =========================================================================
  it("4.C: Concurrent reservation and stock adjustment preserves consistency without lost updates", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "res-adj-race", 20);

    const [resResult, adjResult] = await Promise.allSettled([
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 8,
        referenceType: "CHECKOUT",
        referenceId: "chk_res_adj_1",
      }),
      inventoryService.adjustStock(db, storeId, variantId, {
        quantityDelta: 15,
        reason: "RESTOCK",
      }),
    ]);

    expect(resResult.status).toBe("fulfilled");
    expect(adjResult.status).toBe("fulfilled");

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    // 20 initial - 8 reserved + 15 restock = 27 available, 8 reserved, 35 total
    expect(avail.availableQuantity).toBe(27);
    expect(avail.reservedQuantity).toBe(8);
    expect(avail.totalQuantity).toBe(35);
  });

  // =========================================================================
  // SECTION 4.D: Reservation vs release concurrency
  // =========================================================================
  it("4.D: Concurrent release and reservation never double-releases or loses stock", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "res-rel-race", 10);

    const initialRes = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 5,
      referenceType: "CHECKOUT",
      referenceId: "chk_initial_res",
    });

    // Available: 5, Reserved: 5
    // Run release of initialRes concurrently with a new reservation of 8
    const [relResult, newResResult] = await Promise.allSettled([
      inventoryService.releaseReservation(db, storeId, initialRes.id),
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 8,
        referenceType: "CHECKOUT",
        referenceId: "chk_competing_new_res",
      }),
    ]);

    expect(relResult.status).toBe("fulfilled");

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    if (newResResult.status === "fulfilled") {
      // Release completed first, stock became 10, then reservation of 8 succeeded
      expect(avail.availableQuantity).toBe(2);
      expect(avail.reservedQuantity).toBe(8);
      expect(avail.totalQuantity).toBe(10);
    } else {
      // Reservation ran first and failed (5 < 8), then release succeeded
      expect(avail.availableQuantity).toBe(10);
      expect(avail.reservedQuantity).toBe(0);
      expect(avail.totalQuantity).toBe(10);
    }
  });

  // =========================================================================
  // SECTION 5: Reservation Lifecycle Race Conditions
  // =========================================================================
  it("5. Lifecycle race: release + release concurrently is safe and idempotent", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "life-rel-rel", 10);

    const res = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 4,
      referenceType: "CHECKOUT",
      referenceId: "chk_life_rel_rel",
    });

    const [r1, r2] = await Promise.allSettled([
      inventoryService.releaseReservation(db, storeId, res.id),
      inventoryService.releaseReservation(db, storeId, res.id),
    ]);

    expect(r1.status).toBe("fulfilled");
    expect(r2.status).toBe("fulfilled");

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    // Stock restored exactly once: 10 available, 0 reserved
    expect(avail.availableQuantity).toBe(10);
    expect(avail.reservedQuantity).toBe(0);
  });

  it("5. Lifecycle race: finalize + finalize concurrently is safe and idempotent", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "life-fin-fin", 10);

    const res = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 4,
      referenceType: "CHECKOUT",
      referenceId: "chk_life_fin_fin",
    });

    const [f1, f2] = await Promise.allSettled([
      inventoryService.finalizeReservation(db, storeId, res.id),
      inventoryService.finalizeReservation(db, storeId, res.id),
    ]);

    expect(f1.status).toBe("fulfilled");
    expect(f2.status).toBe("fulfilled");

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    // Reserved consumed exactly once: 6 available, 0 reserved, 6 total
    expect(avail.availableQuantity).toBe(6);
    expect(avail.reservedQuantity).toBe(0);
    expect(avail.totalQuantity).toBe(6);
  });

  it("5. Lifecycle race: release + finalize concurrently is mutually exclusive", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "life-rel-fin", 10);

    const res = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 4,
      referenceType: "CHECKOUT",
      referenceId: "chk_life_rel_fin",
    });

    const [r1, r2] = await Promise.allSettled([
      inventoryService.releaseReservation(db, storeId, res.id),
      inventoryService.finalizeReservation(db, storeId, res.id),
    ]);

    const successes = [r1, r2].filter((r) => r.status === "fulfilled");
    const failures = [r1, r2].filter((r) => r.status === "rejected");

    // Exactly one must win, exactly one must be rejected
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    if (failures[0]!.status === "rejected") {
      expect(failures[0]!.reason).toBeInstanceOf(
        InvalidReservationStateTransitionError,
      );
    }

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.reservedQuantity).toBe(0);
    // Either release won (10 available) or finalize won (6 available)
    expect([6, 10]).toContain(avail.availableQuantity);
  });

  it("5. Lifecycle race: expire + finalize concurrently does not crash expiration batch", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "life-exp-fin", 10);

    const pastDate = new Date(Date.now() - 5000);
    const res = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 3,
      referenceType: "CHECKOUT",
      referenceId: "chk_exp_race",
      expiresAt: pastDate,
    });

    // Run finalize and expiration concurrently
    const [finResult, expResult] = await Promise.allSettled([
      inventoryService.finalizeReservation(db, storeId, res.id),
      inventoryService.expireReservations(db, storeId, new Date()),
    ]);

    expect(finResult.status).toBe("fulfilled");
    expect(expResult.status).toBe("fulfilled");

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.reservedQuantity).toBe(0);
    // Stock is either finalized (7 available) or expired/released (10 available)
    expect([7, 10]).toContain(avail.availableQuantity);
  });

  // =========================================================================
  // SECTION 6: Idempotency Attack Testing
  // =========================================================================
  it("6. Idempotency: concurrent duplicate adjustments with same key apply exactly once", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "idemp-adj-race", 10);

    const [adj1, adj2, adj3] = await Promise.allSettled([
      inventoryService.adjustStock(db, storeId, variantId, {
        quantityDelta: 5,
        reason: "RESTOCK",
        referenceType: "idempotency_key",
        referenceId: "idemp_test_adj_key",
      }),
      inventoryService.adjustStock(db, storeId, variantId, {
        quantityDelta: 5,
        reason: "RESTOCK",
        referenceType: "idempotency_key",
        referenceId: "idemp_test_adj_key",
      }),
      inventoryService.adjustStock(db, storeId, variantId, {
        quantityDelta: 5,
        reason: "RESTOCK",
        referenceType: "idempotency_key",
        referenceId: "idemp_test_adj_key",
      }),
    ]);

    expect(adj1.status).toBe("fulfilled");
    expect(adj2.status).toBe("fulfilled");
    expect(adj3.status).toBe("fulfilled");

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    // Stock was 10, exactly one +5 adjustment applied -> 15 (NOT 25)
    expect(avail.availableQuantity).toBe(15);

    // Verify exactly one adjustment record in database
    const history = await inventoryService.listAdjustments(db, storeId, variantId);
    const idempRecords = history.filter(
      (h) => h.referenceId === "idemp_test_adj_key",
    );
    expect(idempRecords).toHaveLength(1);
  });

  it("6. Idempotency: same key with different parameters rejects with DuplicateReservationError", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "idemp-conflict", 10);

    await inventoryService.adjustStock(db, storeId, variantId, {
      quantityDelta: 5,
      reason: "RESTOCK",
      referenceType: "idempotency_key",
      referenceId: "conflict_key_1",
    });

    await expect(
      inventoryService.adjustStock(db, storeId, variantId, {
        quantityDelta: 10, // Different quantity
        reason: "RESTOCK",
        referenceType: "idempotency_key",
        referenceId: "conflict_key_1",
      }),
    ).rejects.toThrow(DuplicateReservationError);
  });

  it("6. Idempotency: concurrent duplicate reservations with same key reserve once", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "idemp-res-race", 20);

    const [res1, res2, res3] = await Promise.allSettled([
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 5,
        referenceType: "CHECKOUT",
        referenceId: "chk_idemp_res_key",
      }),
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 5,
        referenceType: "CHECKOUT",
        referenceId: "chk_idemp_res_key",
      }),
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 5,
        referenceType: "CHECKOUT",
        referenceId: "chk_idemp_res_key",
      }),
    ]);

    expect(res1.status).toBe("fulfilled");
    expect(res2.status).toBe("fulfilled");
    expect(res3.status).toBe("fulfilled");

    // All 3 return identical reservation ID
    if (
      res1.status === "fulfilled" &&
      res2.status === "fulfilled" &&
      res3.status === "fulfilled"
    ) {
      expect(res1.value.id).toBe(res2.value.id);
      expect(res2.value.id).toBe(res3.value.id);
    }

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(15);
    expect(avail.reservedQuantity).toBe(5);
  });

  // =========================================================================
  // SECTION 7: Uninitialized Variant Concurrency Attack
  // =========================================================================
  it("7. Uninitialized variant: concurrent adjustments serialize cleanly without unique violation crash", async () => {
    const db = await setupDb();
    // Create context with stock 0 so variant exists in store but inventory item is not initialized
    const { storeId, variantId } = await createTestContext(db, "uninit-race", 0);

    // Launch 5 concurrent adjustments on uninitialized variant
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        inventoryService.adjustStock(db, storeId, variantId, {
          quantityDelta: 4,
          reason: "RESTOCK",
          referenceType: "idempotency_key",
          referenceId: `uninit_key_${i}`,
        }),
      ),
    );

    const successes = results.filter((r) => r.status === "fulfilled");
    expect(successes).toHaveLength(5);

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(20); // 5 * 4 = 20

    const history = await inventoryService.listAdjustments(db, storeId, variantId);
    expect(history).toHaveLength(5);
  });

  // =========================================================================
  // SECTION 10: Multi-Item Reservation Review (reserveMany)
  // =========================================================================
  it("10. reserveMany: correctly aggregates duplicate variants in input items", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "multi-dup-var", 15);

    // Request same variant twice: 4 + 3 = 7
    const reservations = await inventoryService.reserveMany(db, storeId, {
      items: [
        { variantId, quantity: 4 },
        { variantId, quantity: 3 },
      ],
      referenceType: "CHECKOUT",
      referenceId: "chk_multi_dup_1",
    });

    expect(reservations).toHaveLength(1);
    expect(reservations[0]!.quantity).toBe(7);

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(8); // 15 - 7
    expect(avail.reservedQuantity).toBe(7);
  });

  it("10. reserveMany: rejects when aggregated duplicate variant quantity exceeds available stock", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "multi-dup-exceed", 10);

    // Request 6 + 6 = 12 against stock of 10
    await expect(
      inventoryService.reserveMany(db, storeId, {
        items: [
          { variantId, quantity: 6 },
          { variantId, quantity: 6 },
        ],
        referenceType: "CHECKOUT",
        referenceId: "chk_multi_dup_exceed",
      }),
    ).rejects.toThrow(InsufficientStockError);

    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(10);
    expect(avail.reservedQuantity).toBe(0);
  });

  it("10. reserveMany: rejects with CrossStoreInventoryAccessError if any variant belongs to another store", async () => {
    const db = await setupDb();
    const storeA = await createTestContext(db, "store-a-multi", 10);
    const storeB = await createTestContext(db, "store-b-multi", 10);

    await expect(
      inventoryService.reserveMany(db, storeA.storeId, {
        items: [
          { variantId: storeA.variantId, quantity: 2 },
          { variantId: storeB.variantId, quantity: 2 }, // Cross-store variant
        ],
        referenceType: "CHECKOUT",
        referenceId: "chk_cross_multi",
      }),
    ).rejects.toThrow(CrossStoreInventoryAccessError);
  });

  it("10. reserveMany: deterministic locking prevents deadlock on overlapping multi-item requests", async () => {
    const db = await setupDb();
    const { storeId, variantId: v1, productId } = await createTestContext(
      db,
      "deadlock-test",
      20,
    );

    // Create a second variant on the same product
    const v2Res = await db.query<{ id: string }>(
      `INSERT INTO product_variants (id, store_id, product_id, title, price, position)
       VALUES ($1, $2, $3, 'Variant 2', 6000, 2)
       RETURNING id`,
      [generateUuidV7(), storeId, productId],
    );
    const v2 = v2Res.rows[0]!.id;
    await inventoryService.adjustStock(db, storeId, v2, {
      quantityDelta: 20,
      reason: "INITIAL_STOCK",
    });

    // Request A: v1=7, v2=5
    // Request B: v2=7, v1=5 (reversed input order to test deterministic sort ordering)
    const [resA, resB] = await Promise.allSettled([
      inventoryService.reserveMany(db, storeId, {
        items: [
          { variantId: v1, quantity: 7 },
          { variantId: v2, quantity: 5 },
        ],
        referenceType: "CHECKOUT",
        referenceId: "chk_deadlock_a",
      }),
      inventoryService.reserveMany(db, storeId, {
        items: [
          { variantId: v2, quantity: 7 },
          { variantId: v1, quantity: 5 },
        ],
        referenceType: "CHECKOUT",
        referenceId: "chk_deadlock_b",
      }),
    ]);

    expect(resA.status).toBe("fulfilled");
    expect(resB.status).toBe("fulfilled");

    const avail1 = await inventoryService.getAvailability(db, storeId, v1);
    const avail2 = await inventoryService.getAvailability(db, storeId, v2);

    expect(avail1.availableQuantity).toBe(8); // 20 - 7 - 5
    expect(avail1.reservedQuantity).toBe(12);
    expect(avail2.availableQuantity).toBe(8); // 20 - 5 - 7
    expect(avail2.reservedQuantity).toBe(12);
  });

  // =========================================================================
  // SECTION 7: Tenant Boundary Attack Testing
  // =========================================================================
  it("7. Tenant attack: cross-store variant access throws CrossStoreInventoryAccessError", async () => {
    const db = await setupDb();
    const storeA = await createTestContext(db, "tenant-a", 10);
    const storeB = await createTestContext(db, "tenant-b", 10);

    // Store A attempts to reserve variant belonging to Store B
    await expect(
      inventoryService.reserve(db, storeA.storeId, {
        variantId: storeB.variantId,
        quantity: 2,
        referenceType: "CHECKOUT",
        referenceId: "tenant_attack_res",
      }),
    ).rejects.toThrow(CrossStoreInventoryAccessError);

    // Store A attempts to adjust stock of variant belonging to Store B
    await expect(
      inventoryService.adjustStock(db, storeA.storeId, storeB.variantId, {
        quantityDelta: 5,
        reason: "RESTOCK",
      }),
    ).rejects.toThrow(CrossStoreInventoryAccessError);
  });

  it("7. Tenant attack: cross-store item and reservation IDs throw NotFoundError", async () => {
    const db = await setupDb();
    const storeA = await createTestContext(db, "tenant-iso-a", 10);
    const storeB = await createTestContext(db, "tenant-iso-b", 10);

    const bRes = await inventoryService.reserve(db, storeB.storeId, {
      variantId: storeB.variantId,
      quantity: 2,
      referenceType: "CHECKOUT",
      referenceId: "chk_store_b_res",
    });

    const bItem = await inventoryService.getInventoryItem(
      db,
      storeB.storeId,
      storeB.variantId,
    );

    // Store A attempts to query item from Store B -> InventoryNotFoundError
    await expect(
      inventoryService.getInventoryById(db, storeA.storeId, bItem.id),
    ).rejects.toThrow(InventoryNotFoundError);

    // Store A attempts to query reservation from Store B -> ReservationNotFoundError
    await expect(
      inventoryService.getReservation(db, storeA.storeId, bRes.id),
    ).rejects.toThrow(ReservationNotFoundError);

    // Store A attempts to release reservation from Store B -> ReservationNotFoundError
    await expect(
      inventoryService.releaseReservation(db, storeA.storeId, bRes.id),
    ).rejects.toThrow(ReservationNotFoundError);

    // Store A attempts to finalize reservation from Store B -> ReservationNotFoundError
    await expect(
      inventoryService.finalizeReservation(db, storeA.storeId, bRes.id),
    ).rejects.toThrow(ReservationNotFoundError);
  });

  // =========================================================================
  // SECTION 9: Transaction Rollback Testing
  // =========================================================================
  it("9. Transaction rollback: failure mid-operation leaves inventory state completely clean", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "rollback-test", 10);

    // Simulate an operation that mutates stock but throws before commit
    await expect(
      db.withTransaction(async (tx) => {
        await inventoryService.adjustStock(tx, storeId, variantId, {
          quantityDelta: 5,
          reason: "RESTOCK",
        });
        throw new Error("Simulated failure mid-transaction");
      }),
    ).rejects.toThrow("Simulated failure mid-transaction");

    // Verify quantity unchanged
    const avail = await inventoryService.getAvailability(db, storeId, variantId);
    expect(avail.availableQuantity).toBe(10);

    // Verify no stray adjustment history
    const history = await inventoryService.listAdjustments(db, storeId, variantId);
    expect(history).toHaveLength(1); // Only initial stock
  });

  // =========================================================================
  // SECTION 13: Database Constraint Enforcement
  // =========================================================================
  it("13. Database constraints: direct SQL violating quantity invariants is rejected by PostgreSQL", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "db-constraints", 10);

    const item = await inventoryService.getInventoryItem(db, storeId, variantId);

    // Attempt direct SQL setting negative available quantity
    await expect(
      db.query(
        `UPDATE inventory_items SET available_quantity = -5 WHERE id = $1`,
        [item.id],
      ),
    ).rejects.toThrow();

    // Attempt direct SQL setting negative reserved quantity
    await expect(
      db.query(
        `UPDATE inventory_items SET reserved_quantity = -1 WHERE id = $1`,
        [item.id],
      ),
    ).rejects.toThrow();

    // Attempt duplicate reference on inventory_adjustments
    await db.query(
      `INSERT INTO inventory_adjustments (
         id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity,
         reason, reference_type, reference_id, created_at
       ) VALUES ($1, $2, $3, 5, 10, 15, 'RESTOCK', 'order', 'ord_123', NOW())`,
      [generateUuidV7(), storeId, item.id],
    );

    // Second insert with exact same store_id, reference_type, reference_id MUST fail
    await expect(
      db.query(
        `INSERT INTO inventory_adjustments (
           id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity,
           reason, reference_type, reference_id, created_at
         ) VALUES ($1, $2, $3, 2, 15, 17, 'RESTOCK', 'order', 'ord_123', NOW())`,
        [generateUuidV7(), storeId, item.id],
      ),
    ).rejects.toThrow();
  });
});
