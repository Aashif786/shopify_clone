export type AnalyticsPeriodPreset =
  | "7d"
  | "30d"
  | "90d"
  | "current_month"
  | "previous_month"
  | "custom";

export interface AnalyticsQueryDto {
  period?: AnalyticsPeriodPreset;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface AnalyticsDateRangeDto {
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
  preset?: AnalyticsPeriodPreset;
}

export interface SalesMetricsValues {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  orderCount: number;
  averageOrderValue: number;
  totalSales: number;
  shippingTotal: number;
  taxTotal: number;
}

export interface SalesComparisonDeltas {
  grossSalesDeltaPct: number;
  discountsDeltaPct: number;
  refundsDeltaPct: number;
  netSalesDeltaPct: number;
  orderCountDeltaPct: number;
  averageOrderValueDeltaPct: number;
  totalSalesDeltaPct: number;
}

export interface SalesOverviewDto {
  dateRange: AnalyticsDateRangeDto;
  currency: string;
  current: SalesMetricsValues;
  prior: SalesMetricsValues;
  comparison: SalesComparisonDeltas;
}

export interface OrderStatusDistributionItem {
  status: string;
  count: number;
  totalAmount: number;
}

export interface PaymentStatusDistributionItem {
  paymentStatus: string;
  count: number;
}

export interface FulfillmentStatusDistributionItem {
  fulfillmentStatus: string;
  count: number;
}

export interface DailySalesTrendPoint {
  date: string; // YYYY-MM-DD
  orderCount: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  totalSales: number;
}

export interface OrderAnalyticsDto {
  dateRange: AnalyticsDateRangeDto;
  currency: string;
  ordersByStatus: OrderStatusDistributionItem[];
  ordersByPaymentStatus: PaymentStatusDistributionItem[];
  ordersByFulfillmentStatus: FulfillmentStatusDistributionItem[];
  dailyTrend: DailySalesTrendPoint[];
  summary: {
    totalOrders: number;
    fulfilledOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
  };
}

export interface TopProductItem {
  productId: string | null;
  productName: string;
  unitsSold: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
}

export interface LowStockVariantItem {
  inventoryItemId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string | null;
  availableQuantity: number;
  reservedQuantity: number;
  isDepleted: boolean;
}

export interface ProductAnalyticsDto {
  dateRange: AnalyticsDateRangeDto;
  currency: string;
  topProductsByUnits: TopProductItem[];
  topProductsByRevenue: TopProductItem[];
  lowStockVariants: LowStockVariantItem[];
}

export interface TopSpendingCustomerItem {
  customerId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  orderCount: number;
  totalSpent: number;
}

export interface CustomerAnalyticsDto {
  dateRange: AnalyticsDateRangeDto;
  currency: string;
  totalCustomers: number;
  newCustomersInPeriod: number;
  activeCustomersInPeriod: number;
  repeatCustomerCount: number;
  repeatCustomerRate: number; // percentage 0 - 100
  topCustomers: TopSpendingCustomerItem[];
}
