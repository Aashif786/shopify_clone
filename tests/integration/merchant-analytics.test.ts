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
import {
  AnalyticsService,
  calculateDateRange,
} from "../../modules/orders/src/application/analytics-service.js";

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

  describe("1. Tenant Isolation & Access Control Across All Endpoints", () => {
    it("strictly isolates analytics data and rejects cross-tenant requests across all 4 routes", async () => {
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

      // User A attempts to access Store B across all 4 routes -> must all return 404 (not found / forbidden)
      const endpoints = [
        { name: "overview", handler: getOverviewRoute },
        { name: "orders", handler: getOrdersAnalyticsRoute },
        { name: "products", handler: getProductsAnalyticsRoute },
        { name: "customers", handler: getCustomersAnalyticsRoute },
      ];

      for (const ep of endpoints) {
        const crossReq = new Request(
          `http://localhost:3000/api/v1/stores/${storeB.storeId}/analytics/${ep.name}`,
          {
            headers: {
              Authorization: `Bearer ${storeA.user.session.id}`,
            },
          },
        );
        const crossRes = await ep.handler(crossReq, {
          params: Promise.resolve({ storeId: storeB.storeId }),
        });
        expect(crossRes.status, `Endpoint ${ep.name} must reject cross-tenant access with 404`).toBe(404);
      }

      // User A accesses Store A's own endpoints -> all return 200, strictly scoped to Store A's data
      for (const ep of endpoints) {
        const validReq = new Request(
          `http://localhost:3000/api/v1/stores/${storeA.storeId}/analytics/${ep.name}?period=7d`,
          {
            headers: {
              Authorization: `Bearer ${storeA.user.session.id}`,
            },
          },
        );
        const validRes = await ep.handler(validReq, {
          params: Promise.resolve({ storeId: storeA.storeId }),
        });
        expect(validRes.status, `Endpoint ${ep.name} must return 200 for authorized store`).toBe(200);
      }

      // Verify Store A overview contains only Store A's $100.00
      const storeAOverview = await analyticsService.getSalesOverview(db, storeA.storeId, { period: "7d" });
      expect(storeAOverview.current.grossSales).toBe(10000);
      expect(storeAOverview.current.orderCount).toBe(1);

      // Verify Store B overview contains only Store B's $250.00
      const storeBOverview = await analyticsService.getSalesOverview(db, storeB.storeId, { period: "7d" });
      expect(storeBOverview.current.grossSales).toBe(25000);
      expect(storeBOverview.current.orderCount).toBe(1);
    });

    it("rejects unauthenticated requests with 401 across all 4 endpoints", async () => {
      const store = await seedStoreWithMember("Auth Test Store");
      const endpoints = [
        { name: "overview", handler: getOverviewRoute },
        { name: "orders", handler: getOrdersAnalyticsRoute },
        { name: "products", handler: getProductsAnalyticsRoute },
        { name: "customers", handler: getCustomersAnalyticsRoute },
      ];

      for (const ep of endpoints) {
        const unauthReq = new Request(
          `http://localhost:3000/api/v1/stores/${store.storeId}/analytics/${ep.name}`,
        );
        const res = await ep.handler(unauthReq, {
          params: Promise.resolve({ storeId: store.storeId }),
        });
        expect(res.status, `Unauthenticated request to ${ep.name} must return 401`).toBe(401);
      }
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
      expect(overview.current.totalSales).toBe(0);
      expect(overview.comparison.netSalesDeltaPct).toBe(0);
      expect(overview.comparison.averageOrderValueDeltaPct).toBe(0);

      const orders = await analyticsService.getOrderAnalytics(db, store.storeId, {
        period: "7d",
      });
      expect(orders.summary.totalOrders).toBe(0);
      expect(orders.ordersByStatus).toEqual([]);
      expect(orders.dailyTrend.length).toBeGreaterThan(0);
      expect(orders.dailyTrend.every((d) => d.netSales === 0 && d.orderCount === 0)).toBe(true);

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
    it("computes gross sales without tax or shipping, and reconciles discounts, refunds, and net sales", async () => {
      const store = await seedStoreWithMember("Financial Audit Store", "USD");
      const storeId = store.storeId;

      // Order 1: Subtotal 15000 ($150 base items), discount 1000 ($10), shipping 800 ($8), tax 700 ($7), grand_total 15500. CONFIRMED, PAID
      const order1Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-001', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 15000, 1000, 800, 700, 15500, 15500, NOW(), NOW())`,
        [order1Id, storeId],
      );

      // Order 2: Subtotal 25000 ($250 base items), discount 2000 ($20), shipping 1200 ($12), tax 1300 ($13), grand_total 25500. DELIVERED, PAID
      const order2Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-002', 'DELIVERED', 'PAID', 'FULFILLED', 'USD', 25000, 2000, 1200, 1300, 25500, 25500, NOW(), NOW())`,
        [order2Id, storeId],
      );

      // Order 3: Cancelled order that was NEVER paid (payment_status = 'PENDING') -> MUST be excluded from gross sales
      const order3Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-003', 'CANCELLED', 'PENDING', 'CANCELLED', 'USD', 5000, 0, 0, 0, 5000, 5000, NOW(), NOW())`,
        [order3Id, storeId],
      );

      // Order 4: Payment failed order (payment_status = 'FAILED') -> MUST be excluded from sales
      const order4Id = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-004', 'PENDING', 'FAILED', 'UNFULFILLED', 'USD', 8000, 0, 0, 0, 8000, 8000, NOW(), NOW())`,
        [order4Id, storeId],
      );

      // Create checkout & payment infrastructure for refunds
      const cart1Id = generateUuidV7();
      const checkout1Id = generateUuidV7();
      const payment1Id = generateUuidV7();
      await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cart1Id, storeId]);
      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id, status, currency, total) VALUES ($1, $2, $3, 'COMPLETED', 'USD', 15500)`,
        [checkout1Id, storeId, cart1Id],
      );
      await db.query(
        `INSERT INTO payments (id, store_id, order_id, checkout_id, provider, amount, currency, status) VALUES ($1, $2, $3, $4, 'razorpay', 15500, 'USD', 'CAPTURED')`,
        [payment1Id, storeId, order1Id, checkout1Id],
      );

      // Partial Refund 1: $20.00 (2000 cents) SUCCEEDED on Order 1
      const refund1Id = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 2000, 'USD', 'SUCCEEDED', NOW(), NOW())`,
        [refund1Id, storeId, payment1Id, order1Id],
      );

      // Partial Refund 2: $20.00 (2000 cents) SUCCEEDED on Order 1 -> Total refunds = $40.00
      const refund2Id = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 2000, 'USD', 'SUCCEEDED', NOW(), NOW())`,
        [refund2Id, storeId, payment1Id, order1Id],
      );

      // Ambiguous / In-flight / Failed refunds: MUST NOT be counted
      const refundPendingId = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 2500, 'USD', 'PENDING', NOW(), NOW())`,
        [refundPendingId, storeId, payment1Id, order1Id],
      );

      const refundFailedId = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 1500, 'USD', 'FAILED', NOW(), NOW())`,
        [refundFailedId, storeId, payment1Id, order1Id],
      );

      const refundReconId = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (id, store_id, payment_id, order_id, provider, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'razorpay', 3500, 'USD', 'REQUIRES_RECONCILIATION', NOW(), NOW())`,
        [refundReconId, storeId, payment1Id, order1Id],
      );

      const overview = await analyticsService.getSalesOverview(db, storeId, { period: "7d" });

      // Verifications:
      // 1. Gross Sales: Subtotals only (15000 + 25000 = 40000). Does NOT include tax (2000) or shipping (2000)!
      expect(overview.current.grossSales).toBe(40000);
      expect(overview.current.shippingTotal).toBe(2000);
      expect(overview.current.taxTotal).toBe(2000);

      // 2. Discounts: 1000 + 2000 = 3000
      expect(overview.current.discounts).toBe(3000);

      // 3. Refunds: Only SUCCEEDED refunds (2000 + 2000 = 4000). Excludes PENDING, FAILED, and REQUIRES_RECONCILIATION
      expect(overview.current.refunds).toBe(4000);

      // 4. Net Sales: Gross (40000) - Discounts (3000) - Refunds (4000) = 33000 ($330.00)
      expect(overview.current.netSales).toBe(33000);

      // 5. Total Sales: Net Sales (33000) + Shipping (2000) + Tax (2000) = 37000 ($370.00)
      expect(overview.current.totalSales).toBe(37000);

      // 6. Order count: 2 active non-cancelled orders
      expect(overview.current.orderCount).toBe(2);

      // 7. AOV: 33000 / 2 = 16500 ($165.00)
      expect(overview.current.averageOrderValue).toBe(16500);
    });

    it("correctly calculates product item gross and net revenue without double-deducting discounts", async () => {
      const store = await seedStoreWithMember("Product Discount Store", "USD");
      const storeId = store.storeId;

      const prodId = generateUuidV7();
      const varId = generateUuidV7();
      await db.query(
        `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, 'Premium Wool Hoodie', 'wool-hoodie', 'ACTIVE')`,
        [prodId, storeId],
      );
      await db.query(
        `INSERT INTO product_variants (id, store_id, product_id, title, price, sku) VALUES ($1, $2, $3, 'Navy Large', 10000, 'HD-NVY-L')`,
        [varId, storeId, prodId],
      );
      await db.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity) VALUES ($1, $2, $3, 15, 0)`,
        [generateUuidV7(), storeId, varId],
      );

      // Order with 2 units @ $100 ($200 base price), $20 discount ($2000 cents), $10 tax.
      // line_total = basePrice - discount + tax = 20000 - 2000 + 1000 = 19000
      const orderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (
           id, store_id, order_number, status, payment_status, fulfillment_status,
           currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total, created_at, updated_at
         ) VALUES ($1, $2, 'ORD-PROD-DISC', 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 20000, 2000, 0, 1000, 19000, 19000, NOW(), NOW())`,
        [orderId, storeId],
      );
      await db.query(
        `INSERT INTO order_items (
           id, order_id, store_id, product_id, variant_id, product_name_snapshot,
           variant_name_snapshot, quantity, unit_price, discount_amount, tax_amount, line_total, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'Premium Wool Hoodie', 'Navy Large', 2, 10000, 2000, 1000, 19000, NOW(), NOW())`,
        [generateUuidV7(), orderId, storeId, prodId, varId],
      );

      const productAnalytics = await analyticsService.getProductAnalytics(db, storeId, { period: "7d" });

      expect(productAnalytics.topProductsByUnits.length).toBe(1);
      const item = productAnalytics.topProductsByUnits[0]!;
      expect(item.productName).toBe("Premium Wool Hoodie");
      expect(item.unitsSold).toBe(2);
      // Gross Revenue: 2 * 10000 = 20000 ($200.00)
      expect(item.grossRevenue).toBe(20000);
      // Discount: 2000 ($20.00)
      expect(item.discountAmount).toBe(2000);
      // Net Revenue: Gross (20000) - Discount (2000) = 18000 ($180.00). Must NOT double-deduct to 17000!
      expect(item.netRevenue).toBe(18000);
    });
  });

  describe("4. Date Filtering & Calendar Boundary Presets", () => {
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

    it("verifies date boundary calculation across all presets with non-overlapping prior periods", () => {
      const presets: Array<"7d" | "30d" | "90d" | "current_month" | "previous_month"> = [
        "7d",
        "30d",
        "90d",
        "current_month",
        "previous_month",
      ];

      for (const preset of presets) {
        const range = calculateDateRange({ period: preset });
        expect(range.startDate.getTime()).toBeLessThanOrEqual(range.endDate.getTime());
        expect(range.priorStartDate.getTime()).toBeLessThanOrEqual(range.priorEndDate.getTime());
        // Strict boundary: priorEndDate must be strictly before startDate (no millisecond overlap)
        expect(range.priorEndDate.getTime()).toBeLessThan(range.startDate.getTime());
      }
    });

    it("verifies leap day and month transition handling", () => {
      // Custom range over leap day: 2024-02-28 to 2024-03-01
      const range = calculateDateRange({
        period: "custom",
        startDate: "2024-02-28T00:00:00.000Z",
        endDate: "2024-03-01T23:59:59.999Z",
      });

      expect(range.startDate.toISOString()).toBe("2024-02-28T00:00:00.000Z");
      expect(range.endDate.toISOString()).toBe("2024-03-01T23:59:59.999Z");
      // Duration spans 3 full calendar days (Feb 28, Feb 29, Mar 1)
      const durationMs = range.endDate.getTime() - range.startDate.getTime();
      expect(durationMs).toBeGreaterThan(2 * 24 * 60 * 60 * 1000);
      expect(range.priorEndDate.getTime()).toBe(range.startDate.getTime() - 1);
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
