"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { OrderDTO } from "@calcart/orders";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Select,
} from "@calcart/ui";
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
import {
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  Search,
  Eye,
} from "lucide-react";

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
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="order-kpi-summary"
      >
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Total Orders
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
                {kpis.totalOrders}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Net Revenue
              </div>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
                {formatOrderPrice(kpis.totalRevenue, kpis.currency)}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Pending / In-Progress
              </div>
              <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1">
                {kpis.pendingCount}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Paid Orders
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
                {kpis.paidCount}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex gap-2 flex-1 max-w-sm"
            >
              <Input
                placeholder="Search by Order #..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search by order number"
                className="text-xs h-9"
              />
              <Button type="submit" variant="outline" size="sm" className="h-9 px-3 gap-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </Button>
            </form>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Order Status */}
              <div className="min-w-[140px]">
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterSelect("status", e.target.value)}
                  aria-label="Filter by order status"
                  className="text-xs h-9"
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
              <div className="min-w-[140px]">
                <Select
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterSelect("paymentStatus", e.target.value)}
                  aria-label="Filter by payment status"
                  className="text-xs h-9"
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
              <div className="min-w-[140px]">
                <Select
                  value={filters.fulfillmentStatus}
                  onChange={(e) => handleFilterSelect("fulfillmentStatus", e.target.value)}
                  aria-label="Filter by fulfillment status"
                  className="text-xs h-9"
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
                  className="h-9 text-xs"
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
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex justify-between items-center w-full">
            <CardTitle className="text-base font-semibold">Store Orders ({orders.length})</CardTitle>
            <div className="text-xs text-muted-foreground">
              Authoritative orders recorded in PostgreSQL
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="p-8">
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
            <div className="table-container overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Order #
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Date
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Customer / Recipient
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Total
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Payment
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Fulfillment
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Status
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-xs text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => {
                    const recipientName = getOrderRecipientName(order);
                    const cancellable = canCancelOrderStatus(order.status);

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        {/* Order Number Link */}
                        <td className="py-3.5 px-4 font-semibold text-sm">
                          <Link
                            href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                            className="text-primary hover:underline font-mono"
                          >
                            #{order.orderNumber}
                          </Link>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatOrderDate(order.createdAt)}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4 text-sm font-medium text-foreground">
                          {recipientName}
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 font-bold text-sm text-foreground">
                          {formatOrderPrice(order.grandTotal ?? order.total, order.currency)}
                        </td>

                        {/* Payment Status */}
                        <td className="py-3.5 px-4">
                          <OrderPaymentBadge status={order.paymentStatus} />
                        </td>

                        {/* Fulfillment Status */}
                        <td className="py-3.5 px-4">
                          <OrderFulfillmentBadge status={order.fulfillmentStatus} />
                        </td>

                        {/* Order Status */}
                        <td className="py-3.5 px-4">
                          <OrderStatusBadge status={order.status} />
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            <Link
                              href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                              className="btn btn-outline btn-sm h-8 px-2.5 text-xs inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </Link>

                            {canManage && cancellable && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onCancelOrder(order)}
                                disabled={isStaff}
                                title={isStaff ? "Requires Admin or Owner role" : "Cancel order"}
                                className="h-8 px-2.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive"
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
            <div className="flex justify-center p-4 border-t border-border">
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
