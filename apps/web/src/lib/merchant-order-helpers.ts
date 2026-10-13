import type {
  OrderAddressDTO,
  OrderDTO,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@shopify-clone/orders";

/**
 * Check if order is in a status that permits cancellation (PENDING, CONFIRMED, or PROCESSING).
 */
export function canCancelOrderStatus(status: OrderStatus): boolean {
  return (
    status === "PENDING" ||
    status === "CONFIRMED" ||
    status === "PROCESSING"
  );
}

export interface OrderMetrics {
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  paidCount: number;
  currency: string;
}

export interface OrderListFilters {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
}

export const INITIAL_ORDER_FILTERS: OrderListFilters = {
  orderNumber: "",
  status: "ALL",
  paymentStatus: "ALL",
  fulfillmentStatus: "ALL",
};

/**
 * Format order monetary amount in cents (minor units) to localized currency string.
 */
export function formatOrderPrice(
  cents: number | null | undefined,
  currency: string = "USD",
): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return "—";
  }
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

/**
 * Format an ISO timestamp string into a friendly localized display.
 */
export function formatOrderDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Extract recipient or customer name from order addresses.
 */
export function getOrderRecipientName(order: OrderDTO): string {
  if (order.addresses && order.addresses.length > 0) {
    const shipping = order.addresses.find(
      (a: OrderAddressDTO) => a.type === "SHIPPING",
    );
    if (shipping?.name?.trim()) return shipping.name.trim();

    const billing = order.addresses.find(
      (a: OrderAddressDTO) => a.type === "BILLING",
    );
    if (billing?.name?.trim()) return billing.name.trim();
  }
  return order.customerId ? "Registered Customer" : "Guest Customer";
}

/**
 * Calculate KPI summary figures across current order collection.
 */
export function calculateOrderMetrics(orders: OrderDTO[]): OrderMetrics {
  let totalRevenue = 0;
  let pendingCount = 0;
  let paidCount = 0;
  const currency = orders[0]?.currency || "USD";

  for (const order of orders) {
    // Only count non-cancelled orders towards net revenue
    if (order.status !== "CANCELLED") {
      totalRevenue += Number(order.grandTotal ?? order.total ?? 0);
    }
    if (order.status === "PENDING" || order.status === "PROCESSING") {
      pendingCount++;
    }
    if (order.paymentStatus === "PAID") {
      paidCount++;
    }
  }

  return {
    totalOrders: orders.length,
    totalRevenue,
    pendingCount,
    paidCount,
    currency,
  };
}

/**
 * Validate order cancellation input reason.
 */
export function validateOrderCancellationInput(reason: string): string | null {
  if (!reason || reason.trim().length === 0) {
    return "Cancellation reason is required.";
  }
  if (reason.trim().length > 500) {
    return "Cancellation reason cannot exceed 500 characters.";
  }
  return null;
}

export type BadgeVariant =
  | "warning"
  | "info"
  | "success"
  | "danger"
  | "neutral";

export function getOrderStatusBadgeConfig(status: OrderStatus): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case "PENDING":
      return { variant: "warning", label: "Pending" };
    case "CONFIRMED":
      return { variant: "info", label: "Confirmed" };
    case "PROCESSING":
      return { variant: "info", label: "Processing" };
    case "SHIPPED":
      return { variant: "info", label: "Shipped" };
    case "DELIVERED":
      return { variant: "success", label: "Delivered" };
    case "COMPLETED":
      return { variant: "success", label: "Completed" };
    case "CANCELLED":
      return { variant: "danger", label: "Cancelled" };
    default:
      return { variant: "neutral", label: status };
  }
}

export function getOrderPaymentBadgeConfig(status: OrderPaymentStatus): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case "PENDING":
      return { variant: "warning", label: "Payment Pending" };
    case "AUTHORIZED":
      return { variant: "info", label: "Authorized" };
    case "PAID":
      return { variant: "success", label: "Paid" };
    case "PARTIALLY_REFUNDED":
      return { variant: "warning", label: "Partially Refunded" };
    case "REFUNDED":
      return { variant: "neutral", label: "Refunded" };
    case "FAILED":
      return { variant: "danger", label: "Failed" };
    default:
      return { variant: "neutral", label: status };
  }
}

export function getOrderFulfillmentBadgeConfig(status: OrderFulfillmentStatus): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case "UNFULFILLED":
      return { variant: "warning", label: "Unfulfilled" };
    case "PARTIALLY_FULFILLED":
      return { variant: "info", label: "Partially Fulfilled" };
    case "FULFILLED":
      return { variant: "success", label: "Fulfilled" };
    case "CANCELLED":
      return { variant: "neutral", label: "Cancelled" };
    default:
      return { variant: "neutral", label: status };
  }
}
