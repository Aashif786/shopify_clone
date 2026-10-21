import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { register } from "@shopify-clone/auth";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { GET as getOverviewRoute } from "../../apps/web/app/api/v1/stores/[storeId]/analytics/overview/route.js";
import { GET as getOrdersAnalyticsRoute } from "../../apps/web/app/api/v1/stores/[storeId]/analytics/orders/route.js";
import { GET as getProductsAnalyticsRoute } from "../../apps/web/app/api/v1/stores/[storeId]/analytics/products/route.js";
import { GET as getCustomersAnalyticsRoute } from "../../apps/web/app/api/v1/stores/[storeId]/analytics/customers/route.js";
import { AnalyticsService } from "../../modules/orders/src/application/analytics-service.js";

declare global {
  var __shopify_clone_web_db: Database | undefined;
}

describe("Merchant Analytics & Reporting Integration Tests", { timeout: 45_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const analyticsService = new AnalyticsService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = db;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedStoreWithMember(
    name: string,
    currency: string = "USD",
    role: "owner" | "admin" | "staff" = "owner",
  ) {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${name}`],
    );

    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, 'en-US', 'UTC')`,
      [storeId, orgId, name, `slug-${storeId}`, currency],
    );

    const user = await register(db, {
      email: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}@example.com`,
      password: "securePassword123!",
      name: `${name} User`,
    });

    const membershipId = generateUuidV7();
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [membershipId, storeId, user.user.id, role],
    );

    return { orgId, storeId, user };
  }

  describe("1. Tenant Isolation & Access Control", () => {
    it("strictly isolates analytics data and rejects cross-tenant requests", async () => {
      const storeA = await seedStoreWithMember("Store Alpha", "USD", "owner");
      const storeB = await seedStoreWithMember("Store Beta", "USD", "owner");

      // Seed an order in Store A
      const orderAId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status,
           fulfillment_status, currency, subtotal, discount_total, shipping_total,
           tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-A-01', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 10000, 0, 0, 0, 10000, 10000, NOW(), NOW())`,
        [orderAId, storeA.storeId],
      );

      // Seed an order in Store B
      const orderBId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status,
           fulfillment_status, currency, subtotal, discount_total, shipping_total,
           tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-B-01', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 25000, 0, 0, 0, 25000, 25000, NOW(), NOW())`,
        [orderBId, storeB.storeId],
      );

      // User A attempts to access Store B's analytics endpoint -> must be 404 (not found / unauthorized)
      const crossReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.storeId}/analytics/overview`,
        {
          headers: {
            Authorization: `Bearer ${storeA.user.session.id}`,
          },
        },
      );
      const crossRes = await getOverviewRoute(crossReq, {
        params: Promise.resolve({ storeId: storeB.storeId }),
      });
      expect(crossRes.status).toBe(404);

      // User A accesses Store A's own analytics -> success, contains only Store A's $100.00
      const validReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.storeId}/analytics/overview?period=7d`,
        {
          headers: {
            Authorization: `Bearer ${storeA.user.session.id}`,
          },
        },
      );
      const validRes = await getOverviewRoute(validReq, {
        params: Promise.resolve({ storeId: storeA.storeId }),
      });
      expect(validRes.status).toBe(200);
      const json = await validRes.json();
      expect(json.data.current.grossSales).toBe(10000);
      expect(json.data.current.orderCount).toBe(1);

      // Verify Orders API route returns 200
      const ordersRouteReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.storeId}/analytics/orders?period=7d`,
        { headers: { Authorization: `Bearer ${storeA.user.session.id}` } },
      );
      const ordersRouteRes = await getOrdersAnalyticsRoute(ordersRouteReq, {
        params: Promise.resolve({ storeId: storeA.storeId }),
      });
      expect(ordersRouteRes.status).toBe(200);
      const ordersJson = await ordersRouteRes.json();
      expect(ordersJson.data.summary.totalOrders).toBe(1);

      // Verify Products API route returns 200
      const productsRouteReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.storeId}/analytics/products?period=7d`,
        { headers: { Authorization: `Bearer ${storeA.user.session.id}` } },
      );
      const productsRouteRes = await getProductsAnalyticsRoute(productsRouteReq, {
        params: Promise.resolve({ storeId: storeA.storeId }),
      });
      expect(productsRouteRes.status).toBe(200);

      // Verify Customers API route returns 200
      const customersRouteReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.storeId}/analytics/customers?period=7d`,
        { headers: { Authorization: `Bearer ${storeA.user.session.id}` } },
      );
      const customersRouteRes = await getCustomersAnalyticsRoute(customersRouteReq, {
        params: Promise.resolve({ storeId: storeA.storeId }),
      });
      expect(customersRouteRes.status).toBe(200);

      // Verify Store B's direct analytics calculation via service has only Store B's $250.00
      const storeBOverview = await analyticsService.getSalesOverview(
        db,
        storeB.storeId,
        { period: "7d" },
      );
      expect(storeBOverview.current.grossSales).toBe(25000);
      expect(storeBOverview.current.orderCount).toBe(1);
    });

    it("rejects unauthenticated requests with 401", async () => {
      const store = await seedStoreWithMember("Auth Test Store");
      const unauthReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.storeId}/analytics/overview`,
      );
      const res = await getOverviewRoute(unauthReq, {
        params: Promise.resolve({ storeId: store.storeId }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("2. Empty Store Handling & Zero Prevention", () => {
    it("returns clean zero metrics without division-by-zero or NaN for store with no activity", async () => {
      const store = await seedStoreWithMember("Empty Store", "USD");

      const overview = await analyticsService.getSalesOverview(db, store.storeId, {
        period: "30d",
      });
      expect(overview.current.grossSales).toBe(0);
      expect(overview.current.discounts).toBe(0);
      expect(overview.current.refunds).toBe(0);
      expect(overview.current.netSales).toBe(0);
      expect(overview.current.orderCount).toBe(0);
      expect(overview.current.averageOrderValue).toBe(0);
      expect(overview.comparison.netSalesDeltaPct).toBe(0);

      const orders = await analyticsService.getOrderAnalytics(db, store.storeId, {
        period: "7d",
      });
      expect(orders.summary.totalOrders).toBe(0);
      expect(orders.ordersByStatus).toEqual([]);
      expect(orders.dailyTrend.length).toBeGreaterThan(0);
      expect(orders.dailyTrend.every((d) => d.netSales === 0)).toBe(true);

      const products = await analyticsService.getProductAnalytics(db, store.storeId);
      expect(products.topProductsByUnits).toEqual([]);
      expect(products.topProductsByRevenue).toEqual([]);
      expect(products.lowStockVariants).toEqual([]);

      const customers = await analyticsService.getCustomerAnalytics(db, store.storeId);
      expect(customers.totalCustomers).toBe(0);
      expect(customers.newCustomersInPeriod).toBe(0);
      expect(customers.activeCustomersInPeriod).toBe(0);
      expect(customers.repeatCustomerCount).toBe(0);
      expect(customers.repeatCustomerRate).toBe(0);
      expect(customers.topCustomers).toEqual([]);
    });
  });

  describe("3. Financial Calculation Correctness & Accounting Invariants", () => {
    it("computes gross sales, discounts, succeeded refunds, net sales, and AOV correctly", async () => {
      const store = await seedStoreWithMember("Commerce Store", "USD");
      const storeId = store.storeId;

      // Order 1: Subtotal 15000 ($150), discount 1000 ($10), grand_total 14000. CONFIRMED, PAID
      const order1Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-001', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 15000, 1000, 0, 0, 14000, 14000, NOW(), NOW())`,
        [order1Id, storeId],
      );

      // Order 2: Subtotal 25000 ($250), discount 2000 ($20), grand_total 23000. DELIVERED, PAID
      const order2Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-002', 'DELIVERED', 'PAID', 'FULFILLED', 'USD', 25000, 2000, 0, 0, 23000, 23000, NOW(), NOW())`,
        [order2Id, storeId],
      );

      // Order 3: Cancelled order ($50) -> MUST NOT be in gross or net sales
      const order3Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-003', 'CANCELLED', 'PAID', 'CANCELLED', 'USD', 5000, 0, 0, 0, 5000, 5000, NOW(), NOW())`,
        [order3Id, storeId],
      );

      // Order 4: Payment failed order ($80) -> MUST NOT be in gross or net sales
      const order4Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-004', 'PENDING', 'FAILED', 'UNFULFILLED', 'USD', 8000, 0, 0, 0, 8000, 8000, NOW(), NOW())`,
        [order4Id, storeId],
      );

      // Create dummy carts, checkouts, and payments for refunds
      const cart1Id = generateUuidV7();
      const checkout1Id = generateUuidV7();
      const payment1Id = generateUuidV7();
      await db.query(
        `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
        [cart1Id, storeId],
      );
      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id, status, currency, total)
         VALUES ($1, $2, $3, 'COMPLETED', 'USD', 14000)`,
        [checkout1Id, storeId, cart1Id],
      );
      await db.query(
        `INSERT INTO payments (id, store_id, order_id, checkout_id, provider, amount, currency, status)
         VALUES ($1, $2, $3, $4, 'razorpay', 14000, 'USD', 'CAPTURED')`,
        [payment1Id, storeId, order1Id, checkout1Id],
      );

      // Refund 1: SUCCEEDED refund for $40.00 (4000 cents) -> MUST be counted in refunds
      const refund1Id = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 4000, 'USD', 'SUCCEEDED', NOW(), NOW())`,
        [refund1Id, storeId, payment1Id, order1Id],
      );

      // Refund 2: PENDING refund for $25.00 -> MUST NOT be counted
      const refund2Id = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 2500, 'USD', 'PENDING', NOW(), NOW())`,
        [refund2Id, storeId, payment1Id, order1Id],
      );

      // Refund 3: FAILED refund for $15.00 -> MUST NOT be counted
      const refund3Id = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 1500, 'USD', 'FAILED', NOW(), NOW())`,
        [refund3Id, storeId, payment1Id, order1Id],
      );

      // Overview Calculation:
      // Valid orders: Order 1 (subtotal: 15000, discount: 1000) + Order 2 (subtotal: 25000, discount: 2000)
      // Gross sales = 15000 + 25000 = 40000 ($400)
      // Discounts = 1000 + 2000 = 3000 ($30)
      // Refunds = 4000 ($40)
      // Net Sales = 40000 - 3000 - 4000 = 33000 ($330)
      // Order count = 2
      // AOV = 33000 / 2 = 16500 ($165)
      const overview = await analyticsService.getSalesOverview(db, storeId, {
        period: "7d",
      });

      expect(overview.currency).toBe("USD");
      expect(overview.current.grossSales).toBe(40000);
      expect(overview.current.discounts).toBe(3000);
      expect(overview.current.refunds).toBe(4000);
      expect(overview.current.netSales).toBe(33000);
      expect(overview.current.orderCount).toBe(2);
      expect(overview.current.averageOrderValue).toBe(16500);
    });
  });

  describe("4. Period Comparison Logic", () => {
    it("computes accurate percentage change vs the preceding period", async () => {
      const store = await seedStoreWithMember("Comparison Store", "USD");
      const storeId = store.storeId;

      // Seed 1 order in the PRIOR period (10 days ago, for a 7d range query)
      const priorOrderDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const priorOrderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-PRIOR', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 10000, 0, 0, 0, 10000, 10000, $3, $3)`,
        [priorOrderId, storeId, priorOrderDate.toISOString()],
      );

      // Seed 2 orders in the CURRENT period (now)
      const curOrder1Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-CUR-1', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 10000, 0, 0, 0, 10000, 10000, NOW(), NOW())`,
        [curOrder1Id, storeId],
      );
      const curOrder2Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-CUR-2', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 15000, 0, 0, 0, 15000, 15000, NOW(), NOW())`,
        [curOrder2Id, storeId],
      );

      const overview = await analyticsService.getSalesOverview(db, storeId, {
        period: "7d",
      });

      // Current gross = 25000, Prior gross = 10000
      // Delta = ((25000 - 10000) / 10000) * 100 = +150.0%
      expect(overview.current.grossSales).toBe(25000);
      expect(overview.prior.grossSales).toBe(10000);
      expect(overview.comparison.grossSalesDeltaPct).toBe(150);

      // Current orders = 2, Prior orders = 1
      // Delta = +100.0%
      expect(overview.current.orderCount).toBe(2);
      expect(overview.prior.orderCount).toBe(1);
      expect(overview.comparison.orderCountDeltaPct).toBe(100);
    });
  });

  describe("5. Product & Low Stock Inventory Analytics", () => {
    it("ranks top products by units and revenue and flags low-stock inventory variants", async () => {
      const store = await seedStoreWithMember("Product Analytics Store", "USD");
      const storeId = store.storeId;

      // Seed Product 1
      const prod1Id = generateUuidV7();
      const var1Id = generateUuidV7();
      const inv1Id = generateUuidV7();
      await db.query(
        `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, 'Classic Leather Jacket', 'leather-jacket', 'ACTIVE')`,
        [prod1Id, storeId],
      );
      await db.query(
        `INSERT INTO product_variants (id, store_id, product_id, title, price, sku) VALUES ($1, $2, $3, 'Medium Black', 15000, 'JKT-BLK-M')`,
        [var1Id, storeId, prod1Id],
      );
      // Low stock: available = 4
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity) VALUES ($1, $2, $3, 4, 1)`,
        [inv1Id, storeId, var1Id],
      );

      // Seed Product 2
      const prod2Id = generateUuidV7();
      const var2Id = generateUuidV7();
      const inv2Id = generateUuidV7();
      await db.query(
        `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, 'Cotton T-Shirt', 'cotton-tshirt', 'ACTIVE')`,
        [prod2Id, storeId],
      );
      await db.query(
        `INSERT INTO product_variants (id, store_id, product_id, title, price, sku) VALUES ($1, $2, $3, 'Large White', 3000, 'TSH-WHT-L')`,
        [var2Id, storeId, prod2Id],
      );
      // Depleted stock: available = 0
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity) VALUES ($1, $2, $3, 0, 0)`,
        [inv2Id, storeId, var2Id],
      );

      // Seed Product 3 with plenty of stock (available = 50)
      const prod3Id = generateUuidV7();
      const var3Id = generateUuidV7();
      const inv3Id = generateUuidV7();
      await db.query(
        `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, 'Denim Jeans', 'denim-jeans', 'ACTIVE')`,
        [prod3Id, storeId],
      );
      await db.query(
        `INSERT INTO product_variants (id, store_id, product_id, title, price, sku) VALUES ($1, $2, $3, 'Size 32', 8000, 'JNS-32')`,
        [var3Id, storeId, prod3Id],
      );
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity) VALUES ($1, $2, $3, 50, 0)`,
        [inv3Id, storeId, var3Id],
      );

      // Seed Order with items:
      // Jacket: 2 units @ 15000 = 30000 line total
      // T-Shirt: 5 units @ 3000 = 15000 line total
      const orderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-PRODS', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 45000, 0, 0, 0, 45000, 45000, NOW(), NOW())`,
        [orderId, storeId],
      );
      await db.query(
        `INSERT INTO order_items (
           id, order_id, store_id, product_id, variant_id, product_name_snapshot,
           variant_name_snapshot, quantity, unit_price, discount_amount, tax_amount, line_total, created_at, updated_at
         ) VALUES
         ($1, $2, $3, $4, $5, 'Classic Leather Jacket', 'Medium Black', 2, 15000, 0, 0, 30000, NOW(), NOW()),
         ($6, $2, $3, $7, $8, 'Cotton T-Shirt', 'Large White', 5, 3000, 0, 0, 15000, NOW(), NOW())`,
        [
          generateUuidV7(),
          orderId,
          storeId,
          prod1Id,
          var1Id,
          generateUuidV7(),
          prod2Id,
          var2Id,
        ],
      );

      const productAnalytics = await analyticsService.getProductAnalytics(
        db,
        storeId,
        { period: "7d" },
      );

      // By Units: Cotton T-Shirt (5 units) is #1, Jacket (2 units) is #2
      expect(productAnalytics.topProductsByUnits[0]?.productName).toBe("Cotton T-Shirt");
      expect(productAnalytics.topProductsByUnits[0]?.unitsSold).toBe(5);
      expect(productAnalytics.topProductsByUnits[1]?.productName).toBe("Classic Leather Jacket");
      expect(productAnalytics.topProductsByUnits[1]?.unitsSold).toBe(2);

      // By Revenue: Leather Jacket ($300) is #1, Cotton T-Shirt ($150) is #2
      expect(productAnalytics.topProductsByRevenue[0]?.productName).toBe("Classic Leather Jacket");
      expect(productAnalytics.topProductsByRevenue[0]?.netRevenue).toBe(30000);
      expect(productAnalytics.topProductsByRevenue[1]?.productName).toBe("Cotton T-Shirt");
      expect(productAnalytics.topProductsByRevenue[1]?.netRevenue).toBe(15000);

      // Low stock:
      // T-Shirt has available = 0 (isDepleted = true)
      // Jacket has available = 4 (isDepleted = false)
      // Jeans (available = 50) must NOT be included!
      expect(productAnalytics.lowStockVariants.length).toBe(2);
      const depletedItem = productAnalytics.lowStockVariants.find((v) => v.productName === "Cotton T-Shirt");
      expect(depletedItem?.availableQuantity).toBe(0);
      expect(depletedItem?.isDepleted).toBe(true);

      const lowStockItem = productAnalytics.lowStockVariants.find((v) => v.productName === "Classic Leather Jacket");
      expect(lowStockItem?.availableQuantity).toBe(4);
      expect(lowStockItem?.isDepleted).toBe(false);
    });
  });

  describe("6. Customer Growth & Retention Analytics", () => {
    it("accurately tracks new customers, repeat purchasers, and top customer spenders", async () => {
      const store = await seedStoreWithMember("Customer Analytics Store", "USD");
      const storeId = store.storeId;

      // Customer 1: Repeat buyer with 2 orders
      const cust1Id = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email, first_name, last_name, created_at, updated_at)
         VALUES ($1, $2, 'alice@example.com', 'Alice', 'Smith', NOW(), NOW())`,
        [cust1Id, storeId],
      );

      // Customer 2: Single order
      const cust2Id = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email, first_name, last_name, created_at, updated_at)
         VALUES ($1, $2, 'bob@example.com', 'Bob', 'Jones', NOW(), NOW())`,
        [cust2Id, storeId],
      );

      // Seed 2 orders for Alice ($100 each)
      for (let i = 1; i <= 2; i++) {
        const orderId = generateUuidV7();
        await db.query(
          `INSERT INTO orders (
             id, store_id, customer_id, order_number, status, payment_status, fulfillment_status,
             currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 10000, 0, 0, 0, 10000, 10000, NOW(), NOW())`,
          [orderId, storeId, cust1Id, `ORD-ALICE-${i}`],
        );
      }

      // Seed 1 order for Bob ($50)
      const bobOrderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, customer_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, $3, 'ORD-BOB-1', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 5000, 0, 0, 0, 5000, 5000, NOW(), NOW())`,
        [bobOrderId, storeId, cust2Id],
      );

      const customerAnalytics = await analyticsService.getCustomerAnalytics(
        db,
        storeId,
        { period: "30d" },
      );

      expect(customerAnalytics.totalCustomers).toBe(2);
      expect(customerAnalytics.newCustomersInPeriod).toBe(2);
      expect(customerAnalytics.activeCustomersInPeriod).toBe(2);
      expect(customerAnalytics.repeatCustomerCount).toBe(1); // Alice
      expect(customerAnalytics.repeatCustomerRate).toBe(50); // 1 / 2 = 50.0%

      // Top Customers: Alice spent $200 (20000 cents), Bob spent $50 (5000 cents)
      expect(customerAnalytics.topCustomers[0]?.email).toBe("alice@example.com");
      expect(customerAnalytics.topCustomers[0]?.orderCount).toBe(2);
      expect(customerAnalytics.topCustomers[0]?.totalSpent).toBe(20000);

      expect(customerAnalytics.topCustomers[1]?.email).toBe("bob@example.com");
      expect(customerAnalytics.topCustomers[1]?.orderCount).toBe(1);
      expect(customerAnalytics.topCustomers[1]?.totalSpent).toBe(5000);
    });
  });

  describe("7. Multi-Currency Scoping", () => {
    it("respects store primary currency in reporting", async () => {
      const storeInr = await seedStoreWithMember("INR Store", "INR");
      const storeUsd = await seedStoreWithMember("USD Store", "USD");

      const inrOverview = await analyticsService.getSalesOverview(db, storeInr.storeId);
      expect(inrOverview.currency).toBe("INR");

      const usdOverview = await analyticsService.getSalesOverview(db, storeUsd.storeId);
      expect(usdOverview.currency).toBe("USD");
    });
  });

  describe("8. Date Range Validation & Error Handling", () => {
    it("rejects reversed date ranges with 400 validation error", async () => {
      const store = await seedStoreWithMember("Validation Store");

      const reversedReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.storeId}/analytics/overview?period=custom&startDate=2026-10-20T00:00:00Z&endDate=2026-10-10T00:00:00Z`,
        {
          headers: {
            Authorization: `Bearer ${store.user.session.id}`,
          },
        },
      );
      const res = await getOverviewRoute(reversedReq, {
        params: Promise.resolve({ storeId: store.storeId }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error?.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid date strings with 400 validation error", async () => {
      const store = await seedStoreWithMember("Validation Store 2");

      const invalidReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.storeId}/analytics/overview?period=custom&startDate=not-a-date&endDate=also-not-a-date`,
        {
          headers: {
            Authorization: `Bearer ${store.user.session.id}`,
          },
        },
      );
      const res = await getOverviewRoute(invalidReq, {
        params: Promise.resolve({ storeId: store.storeId }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects date range exceeding 366 days with 400 validation error", async () => {
      const store = await seedStoreWithMember("Validation Store 3");

      const excessReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.storeId}/analytics/overview?period=custom&startDate=2024-01-01T00:00:00Z&endDate=2026-01-01T00:00:00Z`,
        {
          headers: {
            Authorization: `Bearer ${store.user.session.id}`,
          },
        },
      );
      const res = await getOverviewRoute(excessReq, {
        params: Promise.resolve({ storeId: store.storeId }),
      });
      expect(res.status).toBe(400);
    });
  });
});
