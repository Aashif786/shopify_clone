import {
  type Database,
  type DatabaseClient,
  AnalyticsRepository,
} from "@shopify-clone/db";
import type {
  AnalyticsDateRangeDto,
  AnalyticsPeriodPreset,
  AnalyticsQueryDto,
  CustomerAnalyticsDto,
  DailySalesTrendPoint,
  FulfillmentStatusDistributionItem,
  LowStockVariantItem,
  OrderAnalyticsDto,
  OrderStatusDistributionItem,
  PaymentStatusDistributionItem,
  ProductAnalyticsDto,
  SalesComparisonDeltas,
  SalesMetricsValues,
  SalesOverviewDto,
  TopProductItem,
  TopSpendingCustomerItem,
} from "./analytics-dtos.js";

export class InvalidAnalyticsRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAnalyticsRangeError";
  }
}

export interface CalculatedDateRange {
  startDate: Date;
  endDate: Date;
  priorStartDate: Date;
  priorEndDate: Date;
  preset?: AnalyticsPeriodPreset;
}

export function parseNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  const num = Number(val);
  return Number.isNaN(num) ? 0 : num;
}

export function calculateDeltaPct(current: number, prior: number): number {
  if (prior === 0) {
    return current > 0 ? 100 : 0;
  }
  const pct = ((current - prior) / prior) * 100;
  return Math.round(pct * 10) / 10;
}

export function calculateDateRange(query: AnalyticsQueryDto): CalculatedDateRange {
  const now = new Date();

  if (query.period === "custom" || (query.startDate && query.endDate)) {
    if (!query.startDate || !query.endDate) {
      throw new InvalidAnalyticsRangeError(
        "Both startDate and endDate are required for custom period",
      );
    }
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new InvalidAnalyticsRangeError(
        "Invalid ISO date provided for startDate or endDate",
      );
    }
    if (startDate > endDate) {
      throw new InvalidAnalyticsRangeError(
        "startDate must be less than or equal to endDate",
      );
    }

    const durationMs = Math.max(1, endDate.getTime() - startDate.getTime());
    const maxAllowedMs = 366 * 24 * 60 * 60 * 1000;
    if (durationMs > maxAllowedMs) {
      throw new InvalidAnalyticsRangeError(
        "Date range cannot exceed 366 days",
      );
    }

    const priorEndDate = new Date(startDate.getTime() - 1);
    const priorStartDate = new Date(startDate.getTime() - durationMs);

    return {
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      preset: "custom",
    };
  }

  if (query.period === "7d") {
    const durationDays = 7;
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (durationDays - 1), 0, 0, 0, 0)
    );
    const endDate = new Date(now.getTime() + 60_000);
    const priorEndDate = new Date(startDate.getTime() - 1);
    const priorStartDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (2 * durationDays - 1), 0, 0, 0, 0)
    );
    return { startDate, endDate, priorStartDate, priorEndDate, preset: "7d" };
  }

  if (query.period === "90d") {
    const durationDays = 90;
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (durationDays - 1), 0, 0, 0, 0)
    );
    const endDate = new Date(now.getTime() + 60_000);
    const priorEndDate = new Date(startDate.getTime() - 1);
    const priorStartDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (2 * durationDays - 1), 0, 0, 0, 0)
    );
    return { startDate, endDate, priorStartDate, priorEndDate, preset: "90d" };
  }

  if (query.period === "current_month") {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endDate = new Date(now.getTime() + 60_000);
    const durationMs = Math.max(1, endDate.getTime() - startDate.getTime());
    const priorEndDate = new Date(startDate.getTime() - 1);
    const priorStartDate = new Date(startDate.getTime() - durationMs);
    return {
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      preset: "current_month",
    };
  }

  if (query.period === "previous_month") {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - 1);
    const durationMs = endDate.getTime() - startDate.getTime();
    const priorEndDate = new Date(startDate.getTime() - 1);
    const priorStartDate = new Date(startDate.getTime() - durationMs);
    return {
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      preset: "previous_month",
    };
  }

  // Default: 30d
  const durationDays = 30;
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (durationDays - 1), 0, 0, 0, 0)
  );
  const endDate = new Date(now.getTime() + 60_000);
  const priorEndDate = new Date(startDate.getTime() - 1);
  const priorStartDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (2 * durationDays - 1), 0, 0, 0, 0)
  );
  return { startDate, endDate, priorStartDate, priorEndDate, preset: "30d" };
}

function toDateRangeDto(range: CalculatedDateRange): AnalyticsDateRangeDto {
  return {
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
    priorStartDate: range.priorStartDate.toISOString(),
    priorEndDate: range.priorEndDate.toISOString(),
    preset: range.preset,
  };
}

export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository = new AnalyticsRepository(),
  ) {}

  async getSalesOverview(
    client: DatabaseClient | Database,
    storeId: string,
    query: AnalyticsQueryDto = {},
  ): Promise<SalesOverviewDto> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }

    const range = calculateDateRange(query);

    const [
      currency,
      currentSales,
      currentRefunds,
      priorSales,
      priorRefunds,
    ] = await Promise.all([
      this.repo.getStoreCurrency(client, storeId),
      this.repo.getSalesMetrics(client, storeId, range.startDate, range.endDate),
      this.repo.getRefundsMetrics(client, storeId, range.startDate, range.endDate),
      this.repo.getSalesMetrics(client, storeId, range.priorStartDate, range.priorEndDate),
      this.repo.getRefundsMetrics(client, storeId, range.priorStartDate, range.priorEndDate),
    ]);

    const curGross = parseNumber(currentSales.gross_sales);
    const curDiscounts = parseNumber(currentSales.discounts);
    const curRefunds = parseNumber(currentRefunds.refunds_total);
    const curNet = curGross - curDiscounts - curRefunds;
    const curOrders = parseNumber(currentSales.order_count);
    const curAov = curOrders > 0 ? Math.max(0, Math.round(curNet / curOrders)) : 0;
    const curTotalSales =
      curNet +
      parseNumber(currentSales.shipping_total) +
      parseNumber(currentSales.tax_total);

    const currentValues: SalesMetricsValues = {
      grossSales: curGross,
      discounts: curDiscounts,
      refunds: curRefunds,
      netSales: curNet,
      orderCount: curOrders,
      averageOrderValue: curAov,
      totalSales: curTotalSales,
      shippingTotal: parseNumber(currentSales.shipping_total),
      taxTotal: parseNumber(currentSales.tax_total),
    };

    const priGross = parseNumber(priorSales.gross_sales);
    const priDiscounts = parseNumber(priorSales.discounts);
    const priRefunds = parseNumber(priorRefunds.refunds_total);
    const priNet = priGross - priDiscounts - priRefunds;
    const priOrders = parseNumber(priorSales.order_count);
    const priAov = priOrders > 0 ? Math.max(0, Math.round(priNet / priOrders)) : 0;
    const priTotalSales =
      priNet +
      parseNumber(priorSales.shipping_total) +
      parseNumber(priorSales.tax_total);

    const priorValues: SalesMetricsValues = {
      grossSales: priGross,
      discounts: priDiscounts,
      refunds: priRefunds,
      netSales: priNet,
      orderCount: priOrders,
      averageOrderValue: priAov,
      totalSales: priTotalSales,
      shippingTotal: parseNumber(priorSales.shipping_total),
      taxTotal: parseNumber(priorSales.tax_total),
    };

    const comparison: SalesComparisonDeltas = {
      grossSalesDeltaPct: calculateDeltaPct(curGross, priGross),
      discountsDeltaPct: calculateDeltaPct(curDiscounts, priDiscounts),
      refundsDeltaPct: calculateDeltaPct(curRefunds, priRefunds),
      netSalesDeltaPct: calculateDeltaPct(curNet, priNet),
      orderCountDeltaPct: calculateDeltaPct(curOrders, priOrders),
      averageOrderValueDeltaPct: calculateDeltaPct(curAov, priAov),
      totalSalesDeltaPct: calculateDeltaPct(
        currentValues.totalSales,
        priorValues.totalSales,
      ),
    };

    return {
      dateRange: toDateRangeDto(range),
      currency,
      current: currentValues,
      prior: priorValues,
      comparison,
    };
  }

  async getOrderAnalytics(
    client: DatabaseClient | Database,
    storeId: string,
    query: AnalyticsQueryDto = {},
  ): Promise<OrderAnalyticsDto> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }

    const range = calculateDateRange(query);

    const [
      currency,
      ordersByStatusRows,
      ordersByPaymentRows,
      ordersByFulfillmentRows,
      salesTrendRows,
      refundsTrendRows,
    ] = await Promise.all([
      this.repo.getStoreCurrency(client, storeId),
      this.repo.getOrdersByStatus(client, storeId, range.startDate, range.endDate),
      this.repo.getOrdersByPaymentStatus(client, storeId, range.startDate, range.endDate),
      this.repo.getOrdersByFulfillmentStatus(client, storeId, range.startDate, range.endDate),
      this.repo.getDailySalesTrend(client, storeId, range.startDate, range.endDate),
      this.repo.getDailyRefundsTrend(client, storeId, range.startDate, range.endDate),
    ]);

    const ordersByStatus: OrderStatusDistributionItem[] = ordersByStatusRows.map((r) => ({
      status: r.status,
      count: parseNumber(r.count),
      totalAmount: parseNumber(r.total_amount),
    }));

    const ordersByPaymentStatus: PaymentStatusDistributionItem[] = ordersByPaymentRows.map((r) => ({
      paymentStatus: r.payment_status,
      count: parseNumber(r.count),
    }));

    const ordersByFulfillmentStatus: FulfillmentStatusDistributionItem[] = ordersByFulfillmentRows.map((r) => ({
      fulfillmentStatus: r.fulfillment_status,
      count: parseNumber(r.count),
    }));

    // Build contiguous calendar dates map for daily trends
    const trendsByDate = new Map<string, DailySalesTrendPoint>();
    const startDay = new Date(
      Date.UTC(
        range.startDate.getUTCFullYear(),
        range.startDate.getUTCMonth(),
        range.startDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endDay = new Date(
      Date.UTC(
        range.endDate.getUTCFullYear(),
        range.endDate.getUTCMonth(),
        range.endDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const cur = new Date(startDay);

    while (cur <= endDay) {
      const datePart = cur.toISOString().split("T")[0]!;
      if (!trendsByDate.has(datePart)) {
        trendsByDate.set(datePart, {
          date: datePart,
          orderCount: 0,
          grossSales: 0,
          discounts: 0,
          refunds: 0,
          netSales: 0,
          totalSales: 0,
        });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    for (const r of salesTrendRows) {
      const existing = trendsByDate.get(r.date) ?? {
        date: r.date,
        orderCount: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
        netSales: 0,
        totalSales: 0,
      };
      existing.orderCount = parseNumber(r.order_count);
      existing.grossSales = parseNumber(r.gross_sales);
      existing.discounts = parseNumber(r.discounts);
      existing.totalSales = parseNumber(r.total_sales);
      existing.netSales = existing.grossSales - existing.discounts - existing.refunds;
      trendsByDate.set(r.date, existing);
    }

    for (const r of refundsTrendRows) {
      const existing = trendsByDate.get(r.date) ?? {
        date: r.date,
        orderCount: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
        netSales: 0,
        totalSales: 0,
      };
      existing.refunds = parseNumber(r.refunds);
      existing.netSales = existing.grossSales - existing.discounts - existing.refunds;
      trendsByDate.set(r.date, existing);
    }

    const dailyTrend = Array.from(trendsByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    let totalOrders = 0;
    let fulfilledOrders = 0;
    let cancelledOrders = 0;
    let refundedOrders = 0;

    for (const item of ordersByStatus) {
      totalOrders += item.count;
      if (item.status === "CANCELLED") {
        cancelledOrders += item.count;
      }
    }

    for (const item of ordersByFulfillmentStatus) {
      if (item.fulfillmentStatus === "FULFILLED") {
        fulfilledOrders += item.count;
      }
    }

    for (const item of ordersByPaymentStatus) {
      if (item.paymentStatus === "REFUNDED" || item.paymentStatus === "PARTIALLY_REFUNDED") {
        refundedOrders += item.count;
      }
    }

    return {
      dateRange: toDateRangeDto(range),
      currency,
      ordersByStatus,
      ordersByPaymentStatus,
      ordersByFulfillmentStatus,
      dailyTrend,
      summary: {
        totalOrders,
        fulfilledOrders,
        cancelledOrders,
        refundedOrders,
      },
    };
  }

  async getProductAnalytics(
    client: DatabaseClient | Database,
    storeId: string,
    query: AnalyticsQueryDto = {},
  ): Promise<ProductAnalyticsDto> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }

    const range = calculateDateRange(query);
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);

    const [
      currency,
      unitsRows,
      revenueRows,
      lowStockRows,
    ] = await Promise.all([
      this.repo.getStoreCurrency(client, storeId),
      this.repo.getTopProducts(client, storeId, range.startDate, range.endDate, limit, "units"),
      this.repo.getTopProducts(client, storeId, range.startDate, range.endDate, limit, "revenue"),
      this.repo.getLowStockVariants(client, storeId, 10, 20),
    ]);

    const mapProduct = (r: (typeof unitsRows)[0]): TopProductItem => ({
      productId: r.product_id,
      productName: r.product_name,
      unitsSold: parseNumber(r.units_sold),
      grossRevenue: parseNumber(r.gross_revenue),
      discountAmount: parseNumber(r.discount_amount),
      netRevenue: parseNumber(r.net_revenue),
    });

    const topProductsByUnits: TopProductItem[] = unitsRows.map(mapProduct);
    const topProductsByRevenue: TopProductItem[] = revenueRows.map(mapProduct);

    const lowStockVariants: LowStockVariantItem[] = lowStockRows.map((r) => ({
      inventoryItemId: r.inventory_item_id,
      variantId: r.variant_id,
      productId: r.product_id,
      productName: r.product_name,
      variantName: r.variant_name,
      sku: r.sku,
      availableQuantity: parseNumber(r.available_quantity),
      reservedQuantity: parseNumber(r.reserved_quantity),
      isDepleted: parseNumber(r.available_quantity) <= 0,
    }));

    return {
      dateRange: toDateRangeDto(range),
      currency,
      topProductsByUnits,
      topProductsByRevenue,
      lowStockVariants,
    };
  }

  async getCustomerAnalytics(
    client: DatabaseClient | Database,
    storeId: string,
    query: AnalyticsQueryDto = {},
  ): Promise<CustomerAnalyticsDto> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }

    const range = calculateDateRange(query);

    const [
      currency,
      customerMetrics,
      topSpendingRows,
    ] = await Promise.all([
      this.repo.getStoreCurrency(client, storeId),
      this.repo.getCustomerMetrics(client, storeId, range.startDate, range.endDate),
      this.repo.getTopSpendingCustomers(client, storeId, range.startDate, range.endDate, 10),
    ]);

    const totalCustomers = parseNumber(customerMetrics.total_customers);
    const newCustomers = parseNumber(customerMetrics.new_customers);
    const activeCustomers = parseNumber(customerMetrics.active_customers);
    const repeatCustomers = parseNumber(customerMetrics.repeat_customers);

    const repeatRate =
      totalCustomers > 0
        ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10
        : 0;

    const topCustomers: TopSpendingCustomerItem[] = topSpendingRows.map((r) => ({
      customerId: r.customer_id,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      orderCount: parseNumber(r.order_count),
      totalSpent: parseNumber(r.total_spent),
    }));

    return {
      dateRange: toDateRangeDto(range),
      currency,
      totalCustomers,
      newCustomersInPeriod: newCustomers,
      activeCustomersInPeriod: activeCustomers,
      repeatCustomerCount: repeatCustomers,
      repeatCustomerRate: repeatRate,
      topCustomers,
    };
  }
}
