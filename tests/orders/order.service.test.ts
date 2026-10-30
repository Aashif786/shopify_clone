import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  OrderRepository,
} from "@calcart/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { OrderService } from "../../modules/orders/src/application/order-service.js";
import {
  CrossStoreOrderAccessError,
  InvalidOrderStateError,
} from "../../modules/orders/src/domain/order-errors.js";
import type { TrustedCheckoutData } from "../../modules/orders/src/application/dtos.js";

describe("OrderService Integration Tests", { timeout: 30_000 }, () => {
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
    slug = "store-orders-svc",
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

  async function seedTestCustomer(db: Database, storeId: string): Promise<string> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, status) VALUES ($1, $2, 'cust@example.com', 'ACTIVE')`,
      [customerId, storeId],
    );
    return customerId;
  }

  async function seedTestCheckout(db: Database, storeId: string): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, 5000, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId],
    );
    return checkoutId;
  }

  async function seedTestProductAndVariant(
    db: Database,
    storeId: string,
    title = "T-Shirt",
    sku = "TSHIRT-BLK-M",
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [productId, storeId, title, `${sku.toLowerCase()}-${Date.now().toString(36)}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Medium Black', $4, 2500, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, sku],
    );

    return { productId, variantId };
  }

  it("successfully creates an order transactionally with items, addresses, and history", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const customerId = await seedTestCustomer(db, storeId);
    const checkoutId = await seedTestCheckout(db, storeId);
    const { productId: prod1, variantId: var1 } = await seedTestProductAndVariant(
      db,
      storeId,
      "T-Shirt",
      "TSHIRT-M-BLK",
    );
    const { productId: prod2, variantId: var2 } = await seedTestProductAndVariant(
      db,
      storeId,
      "Cap",
      "CAP-OS",
    );

    const service = new OrderService();

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      customerId,
      currency: "USD",
      subtotal: 7000,
      discountTotal: 1000,
      shippingTotal: 500,
      taxTotal: 300,
      total: 6800,
      items: [
        {
          productId: prod1,
          variantId: var1,
          productNameSnapshot: "T-Shirt",
          variantNameSnapshot: "Medium / Black",
          skuSnapshot: "TSHIRT-M-BLK",
          unitPrice: 3000,
          quantity: 2,
          discountAmount: 0,
          taxAmount: 0,
        },
        {
          productId: prod2,
          variantId: var2,
          productNameSnapshot: "Cap",
          variantNameSnapshot: "One Size",
          skuSnapshot: "CAP-OS",
          unitPrice: 1000,
          quantity: 1,
          discountAmount: 0,
          taxAmount: 0,
        },
      ],
      shippingAddress: {
        firstName: "Alice",
        lastName: "Smith",
        addressLine1: "100 Maple St",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "USA",
        phone: "+12065550100",
      },
      billingAddress: {
        firstName: "Alice",
        lastName: "Smith",
        addressLine1: "100 Maple St",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "USA",
      },
    };

    const orderDto = await service.createOrderFromCheckout(db, {
      storeId,
      checkout: checkoutData,
    });

    expect(orderDto.id).toBeDefined();
    expect(orderDto.storeId).toBe(storeId);
    expect(orderDto.checkoutId).toBe(checkoutId);
    expect(orderDto.status).toBe("PENDING");
    expect(orderDto.paymentStatus).toBe("PENDING");
    expect(orderDto.fulfillmentStatus).toBe("UNFULFILLED");
    expect(orderDto.subtotal).toBe(7000); // (2 * 3000) + (1 * 1000) = 7000
    expect(orderDto.discountTotal).toBe(1000);
    expect(orderDto.shippingTotal).toBe(500);
    expect(orderDto.taxTotal).toBe(300);
    expect(orderDto.total).toBe(6800); // 7000 - 1000 + 500 + 300 = 6800
    expect(orderDto.grandTotal).toBe(6800);

    expect(orderDto.items).toHaveLength(2);
    expect(orderDto.addresses).toHaveLength(2);
    expect(orderDto.statusHistory).toHaveLength(1);
    expect(orderDto.statusHistory![0].toStatus).toBe("PENDING");
    expect(orderDto.statusHistory![0].actorType).toBe("SYSTEM");

    // Verify DB persistence directly
    const dbOrder = await db.query(
      `SELECT * FROM orders WHERE id = $1 AND store_id = $2`,
      [orderDto.id, storeId],
    );
    expect(dbOrder.rows).toHaveLength(1);

    const dbItems = await db.query(
      `SELECT * FROM order_items WHERE order_id = $1 AND store_id = $2`,
      [orderDto.id, storeId],
    );
    expect(dbItems.rows).toHaveLength(2);

    const dbAddresses = await db.query(
      `SELECT * FROM order_addresses WHERE order_id = $1 AND store_id = $2`,
      [orderDto.id, storeId],
    );
    expect(dbAddresses.rows).toHaveLength(2);

    const dbHistory = await db.query(
      `SELECT * FROM order_status_history WHERE order_id = $1 AND store_id = $2`,
      [orderDto.id, storeId],
    );
    expect(dbHistory.rows).toHaveLength(1);
  });

  it("does not trust client-supplied totals and recalculates authoritatively", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const checkoutId = await seedTestCheckout(db, storeId);
    const service = new OrderService();

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      currency: "USD",
      subtotal: 10, // Client forged value
      total: 10, // Client forged value
      discountTotal: 200,
      shippingTotal: 300,
      taxTotal: 100,
      items: [
        {
          productNameSnapshot: "Luxury Watch",
          variantNameSnapshot: "Gold",
          unitPrice: 50000,
          quantity: 2,
        },
      ],
    };

    const order = await service.createOrderFromCheckout(db, {
      storeId,
      checkout: checkoutData,
    });

    // Subtotal must be 2 * 50000 = 100,000
    expect(order.subtotal).toBe(100000);
    // Total must be 100000 - 200 + 300 + 100 = 100,200
    expect(order.total).toBe(100200);
    expect(order.grandTotal).toBe(100200);
  });

  it("is idempotent for same-checkout retries", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const checkoutId = await seedTestCheckout(db, storeId);
    const service = new OrderService();

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      currency: "USD",
      items: [
        {
          productNameSnapshot: "Hat",
          variantNameSnapshot: "Black",
          unitPrice: 2500,
          quantity: 1,
        },
      ],
      shippingAddress: {
        addressLine1: "123 Elm St",
        city: "Austin",
        postalCode: "78701",
        country: "USA",
      },
    };

    // First attempt creates order
    const firstOrder = await service.createOrderFromCheckout(db, {
      storeId,
      checkout: checkoutData,
    });

    // Second attempt returns existing order without duplicates
    const secondOrder = await service.createOrderFromCheckout(db, {
      storeId,
      checkout: checkoutData,
    });

    expect(secondOrder.id).toBe(firstOrder.id);
    expect(secondOrder.orderNumber).toBe(firstOrder.orderNumber);
    expect(secondOrder.total).toBe(firstOrder.total);

    // Verify DB count is exactly 1
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM orders WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    expect(Number(countRes.rows[0].count)).toBe(1);
  });

  it("safely resolves concurrent order creation for the same checkout", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const checkoutId = await seedTestCheckout(db, storeId);
    const service = new OrderService();

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      currency: "USD",
      items: [
        {
          productNameSnapshot: "Shoe",
          variantNameSnapshot: "Size 10",
          unitPrice: 8000,
          quantity: 1,
        },
      ],
    };

    // Launch two concurrent requests for the exact same checkout
    const [resultA, resultB] = await Promise.all([
      service.createOrderFromCheckout(db, { storeId, checkout: checkoutData }),
      service.createOrderFromCheckout(db, { storeId, checkout: checkoutData }),
    ]);

    expect(resultA.id).toBe(resultB.id);
    expect(resultA.orderNumber).toBe(resultB.orderNumber);

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM orders WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    expect(Number(countRes.rows[0].count)).toBe(1);
  });

  it("enforces tenant boundary and rejects cross-store checkout data", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const anotherStoreId = generateUuidV7();
    const checkoutId = await seedTestCheckout(db, storeId);
    const service = new OrderService();

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId: anotherStoreId, // Foreign store!
      currency: "USD",
      items: [
        {
          productNameSnapshot: "Item",
          variantNameSnapshot: "Standard",
          unitPrice: 1000,
          quantity: 1,
        },
      ],
    };

    await expect(
      service.createOrderFromCheckout(db, { storeId, checkout: checkoutData }),
    ).rejects.toThrow(CrossStoreOrderAccessError);
  });

  it("rejects order creation without items", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const checkoutId = await seedTestCheckout(db, storeId);
    const service = new OrderService();

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      currency: "USD",
      items: [],
    };

    await expect(
      service.createOrderFromCheckout(db, { storeId, checkout: checkoutData }),
    ).rejects.toThrow(InvalidOrderStateError);
  });

  it("rolls back all changes atomically if an item insertion fails", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const checkoutId = await seedTestCheckout(db, storeId);

    // Mock an order repo where createItem fails
    const mockRepo = new OrderRepository();
    mockRepo.createItem = async () => {
      throw new Error("Simulated disk error inserting item");
    };

    const service = new OrderService(mockRepo);

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      currency: "USD",
      items: [
        {
          productNameSnapshot: "Item A",
          variantNameSnapshot: "Variant A",
          unitPrice: 1000,
          quantity: 1,
        },
      ],
    };

    await expect(
      service.createOrderFromCheckout(db, { storeId, checkout: checkoutData }),
    ).rejects.toThrow("Simulated disk error inserting item");

    // Verify nothing remained in database
    const ordersRes = await db.query(
      `SELECT * FROM orders WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    expect(ordersRes.rows).toHaveLength(0);

    const historyRes = await db.query(
      `SELECT * FROM order_status_history WHERE store_id = $1`,
      [storeId],
    );
    expect(historyRes.rows).toHaveLength(0);
  });

  it("retrieves orders by ID, checkout ID, and order number with hydrated relationships", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const checkoutId = await seedTestCheckout(db, storeId);
    const service = new OrderService();

    const checkoutData: TrustedCheckoutData = {
      id: checkoutId,
      storeId,
      currency: "USD",
      items: [
        {
          productNameSnapshot: "Desk",
          variantNameSnapshot: "Wood",
          unitPrice: 15000,
          quantity: 1,
        },
      ],
      shippingAddress: {
        addressLine1: "500 Market St",
        city: "San Francisco",
        postalCode: "94105",
        country: "USA",
      },
    };

    const created = await service.createOrderFromCheckout(db, {
      storeId,
      checkout: checkoutData,
    });

    const byId = await service.getOrderById(db, storeId, created.id);
    expect(byId).not.toBeNull();
    expect(byId!.id).toBe(created.id);
    expect(byId!.items).toHaveLength(1);
    expect(byId!.addresses).toHaveLength(1);

    const byCheckout = await service.getOrderByCheckoutId(db, storeId, checkoutId);
    expect(byCheckout).not.toBeNull();
    expect(byCheckout!.id).toBe(created.id);

    const byOrderNum = await service.getOrderByOrderNumber(
      db,
      storeId,
      created.orderNumber,
    );
    expect(byOrderNum).not.toBeNull();
    expect(byOrderNum!.id).toBe(created.id);

    const nonexistent = await service.getOrderById(db, storeId, generateUuidV7());
    expect(nonexistent).toBeNull();
  });
});
