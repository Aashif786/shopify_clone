"use client";

import React, { useState } from "react";
import type { OrderDTO } from "@shopify-clone/orders";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Select,
} from "@shopify-clone/ui";
import {
  canCancelOrderStatus,
  calculateOrderMetrics,
  formatOrderDate,
  formatOrderPrice,
  getOrderRecipientName,
  type OrderListFilters,
} from "../../../lib/merchant-order-helpers";
import {
  OrderFulfillmentBadge,
  OrderPaymentBadge,
  OrderStatusBadge,
} from "./order-status-badge";

export interface OrderListTableProps {
  orders: OrderDTO[];
  hasMore: boolean;
  filters: OrderListFilters;
  isLoading: boolean;
  canManage: boolean;
  userRole?: string;
  onFilterChange: (filters: OrderListFilters) => void;
  onNextPage?: () => void;
  onResetFilters: () => void;
  onCancelOrder: (order: OrderDTO) => void;
}

export function OrderListTable({
  orders,
  hasMore,
  filters,
  isLoading,
  canManage,
  userRole,
  onFilterChange,
  onNextPage,
  onResetFilters,
  onCancelOrder,
}: OrderListTableProps) {
  const [searchInput, setSearchInput] = useState<string>(filters.orderNumber);

  const kpis = calculateOrderMetrics(orders);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filters, orderNumber: searchInput.trim() });
  };

  const handleFilterSelect = (key: keyof OrderListFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.orderNumber !== "" ||
    filters.status !== "ALL" ||
    filters.paymentStatus !== "ALL" ||
    filters.fulfillmentStatus !== "ALL";

  const isStaff = userRole === "staff";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* KPI Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
        }}
        data-testid="order-kpi-summary"
      >
        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Orders
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
              {kpis.totalOrders}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Net Revenue
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-success, #16a34a)", marginTop: "var(--space-1)" }}>
              {formatOrderPrice(kpis.totalRevenue, kpis.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pending / In-Progress
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-warning, #d97706)", marginTop: "var(--space-1)" }}>
              {kpis.pendingCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Paid Orders
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
              {kpis.paidCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent style={{ padding: "var(--space-4)" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Search */}
            <form
              onSubmit={handleSearchSubmit}
              style={{ display: "flex", gap: "var(--space-2)", flex: "1 1 240px", minWidth: "220px" }}
            >
              <Input
                placeholder="Search by Order #..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search by order number"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>

            {/* Filter Dropdowns */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-2)",
                alignItems: "center",
              }}
            >
              {/* Order Status */}
              <div style={{ minWidth: "140px" }}>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterSelect("status", e.target.value)}
                  aria-label="Filter by order status"
                >
                  <option value="ALL">All Order Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>

              {/* Payment Status */}
              <div style={{ minWidth: "140px" }}>
                <Select
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterSelect("paymentStatus", e.target.value)}
                  aria-label="Filter by payment status"
                >
                  <option value="ALL">All Payments</option>
                  <option value="PENDING">Payment Pending</option>
                  <option value="AUTHORIZED">Authorized</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="FAILED">Failed</option>
                </Select>
              </div>

              {/* Fulfillment Status */}
              <div style={{ minWidth: "140px" }}>
                <Select
                  value={filters.fulfillmentStatus}
                  onChange={(e) => handleFilterSelect("fulfillmentStatus", e.target.value)}
                  aria-label="Filter by fulfillment status"
                >
                  <option value="ALL">All Fulfillment</option>
                  <option value="UNFULFILLED">Unfulfilled</option>
                  <option value="PARTIALLY_FULFILLED">Partially Fulfilled</option>
                  <option value="FULFILLED">Fulfilled</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    onResetFilters();
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Store Orders ({orders.length})</CardTitle>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              Authoritative orders recorded in PostgreSQL
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          {orders.length === 0 ? (
            <div style={{ padding: "var(--space-8)" }}>
              <EmptyState
                title="No Orders Found"
                description={
                  hasActiveFilters
                    ? "No orders match the current search or status filters. Try clearing your filters."
                    : "No orders have been placed in this store yet. Customers can place orders via storefront checkout."
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchInput("");
                        onResetFilters();
                      }}
                    >
                      Reset Filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--font-size-sm)",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                    }}
                  >
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Order #
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Date
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Customer / Recipient
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Total
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Payment
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Fulfillment
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Status
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: "var(--font-weight-semibold)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const recipientName = getOrderRecipientName(order);
                    const cancellable = canCancelOrderStatus(order.status);

                    return (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        {/* Order Number Link */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                          <a
                            href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                            style={{
                              color: "var(--color-primary, #2563eb)",
                              textDecoration: "none",
                              fontFamily: "var(--font-mono, monospace)",
                            }}
                          >
                            #{order.orderNumber}
                          </a>
                        </td>

                        {/* Date */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)" }}>
                          {formatOrderDate(order.createdAt)}
                        </td>

                        {/* Customer */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-primary)" }}>
                          {recipientName}
                        </td>

                        {/* Total */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                          {formatOrderPrice(order.grandTotal ?? order.total, order.currency)}
                        </td>

                        {/* Payment Status */}
                        <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                          <OrderPaymentBadge status={order.paymentStatus} />
                        </td>

                        {/* Fulfillment Status */}
                        <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                          <OrderFulfillmentBadge status={order.fulfillmentStatus} />
                        </td>

                        {/* Order Status */}
                        <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                          <OrderStatusBadge status={order.status} />
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                            <a
                              href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                              className="btn btn-outline btn-sm"
                            >
                              Details
                            </a>

                            {canManage && cancellable && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onCancelOrder(order)}
                                disabled={isStaff}
                                title={isStaff ? "Requires Admin or Owner role" : "Cancel order"}
                                style={{ color: "var(--color-danger, #dc2626)", borderColor: "var(--color-danger, #dc2626)" }}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {hasMore && onNextPage && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "var(--space-4)",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={onNextPage}
                loading={isLoading}
              >
                Load More Orders
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
