"use client";

import React from "react";
import Link from "next/link";
import type { OrderAddressDTO, OrderDTO, OrderItemDTO, OrderStatusHistoryDTO } from "@shopify-clone/orders";
import type { OrderRefundSummaryDTO, RefundDTO } from "@shopify-clone/payments";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@shopify-clone/ui";
import {
  canCancelOrderStatus,
  formatOrderDate,
  formatOrderPrice,
} from "../../../lib/merchant-order-helpers";
import {
  OrderFulfillmentBadge,
  OrderPaymentBadge,
  OrderStatusBadge,
} from "./order-status-badge";
import {
  ArrowLeft,
  Package,
  CreditCard,
  Truck,
  User,
  Clock,
  RotateCcw,
  XCircle,
  Receipt,
} from "lucide-react";

export interface OrderDetailsViewProps {
  order: OrderDTO;
  userRole?: string;
  onOpenCancel: () => void;
  onOpenFulfill?: () => void;
  refundSummary?: OrderRefundSummaryDTO | null;
  onOpenRefund?: () => void;
}

export function OrderDetailsView({
  order,
  userRole,
  onOpenCancel,
  onOpenFulfill,
  refundSummary,
  onOpenRefund,
}: OrderDetailsViewProps) {
  const isCancellable = canCancelOrderStatus(order.status);
  const isFulfillable =
    order.status !== "CANCELLED" &&
    order.status !== "COMPLETED" &&
    order.fulfillmentStatus !== "FULFILLED";
  const isStaff = userRole === "staff";
  const isRefundable =
    order.status !== "CANCELLED" &&
    (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED") &&
    (refundSummary ? refundSummary.remainingRefundable > 0 : true);
  const currency = order.currency || "USD";

  const shippingAddr = order.addresses?.find((a: OrderAddressDTO) => a.type === "SHIPPING");
  const billingAddr = order.addresses?.find((a: OrderAddressDTO) => a.type === "BILLING");

  const latestFulfillmentHistory = order.statusHistory
    ?.slice()
    .reverse()
    .find((h) => h.toStatus?.startsWith("fulfillment:"));

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/merchant/orders"
                  className="btn btn-ghost btn-sm px-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Orders</span>
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono m-0">
                  Order #{order.orderNumber}
                </h1>
                <OrderStatusBadge status={order.status} size="md" />
                <OrderPaymentBadge status={order.paymentStatus} size="md" />
                <OrderFulfillmentBadge status={order.fulfillmentStatus} size="md" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground m-0">
                Placed on {formatOrderDate(order.createdAt)} • Last updated{" "}
                {formatOrderDate(order.updatedAt)}
              </p>
            </div>

            {/* Actions: Fulfill & Cancel */}
            <div className="flex gap-2 items-center flex-wrap">
              {isFulfillable && onOpenFulfill && (
                <Button
                  variant="primary"
                  onClick={onOpenFulfill}
                  title="Fulfill order and record tracking details"
                  size="sm"
                  className="gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Fulfill Order</span>
                </Button>
              )}

              {isCancellable && (
                <Button
                  variant="outline"
                  onClick={onOpenCancel}
                  disabled={isStaff}
                  title={isStaff ? "Requires Admin or Owner role" : "Cancel order and release inventory"}
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Order</span>
                </Button>
              )}

              {isRefundable && onOpenRefund && (
                <Button
                  variant="outline"
                  onClick={onOpenRefund}
                  disabled={isStaff}
                  title={isStaff ? "Requires Admin or Owner role" : "Initiate a full refund for this order"}
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Refund Order</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Banner if cancelled */}
      {order.status === "CANCELLED" && (
        <Alert variant="danger" title="Order Cancelled">
          <p className="mb-1 text-sm">
            This order was cancelled on {formatOrderDate(order.cancelledAt)}.
          </p>
          {order.cancelReason && (
            <p className="m-0 text-sm">
              <strong>Reason:</strong> {order.cancelReason}
            </p>
          )}
        </Alert>
      )}

      {/* Refunded Notice Banner if refunded */}
      {order.paymentStatus === "REFUNDED" && (
        <Alert variant="info" title="Order Fully Refunded">
          <p className="m-0 text-xs">
            This order has been fully refunded. The payment has been returned to the customer and this order is excluded from customer lifetime spend.
          </p>
        </Alert>
      )}

      {/* Main 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Line Items, Totals, Timeline (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Purchased Items ({order.items?.length ?? 0})
                </CardTitle>
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(!order.items || order.items.length === 0) ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  No item line records recorded for this order.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">Item Details</th>
                        <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">SKU</th>
                        <th className="py-3 px-4 font-semibold text-xs text-muted-foreground text-right">Price</th>
                        <th className="py-3 px-4 font-semibold text-xs text-muted-foreground text-center">Qty</th>
                        {order.discountTotal > 0 && (
                          <th className="py-3 px-4 font-semibold text-xs text-muted-foreground text-right">Discount</th>
                        )}
                        <th className="py-3 px-4 font-semibold text-xs text-muted-foreground text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {order.items.map((item: OrderItemDTO) => (
                        <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                          {/* Item Details */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm text-foreground">
                              {item.productId ? (
                                <Link
                                  href={`/merchant/products/${encodeURIComponent(item.productId)}`}
                                  className="hover:underline hover:text-primary"
                                >
                                  {item.productNameSnapshot}
                                </Link>
                              ) : (
                                item.productNameSnapshot
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.variantNameSnapshot}
                            </div>
                          </td>

                          {/* SKU */}
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                            {item.skuSnapshot || "—"}
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-4 text-right text-xs font-mono">
                            {formatOrderPrice(item.unitPrice, currency)}
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-4 text-center font-semibold text-xs">
                            ×{item.quantity}
                          </td>

                          {/* Discount */}
                          {order.discountTotal > 0 && (
                            <td className="py-3 px-4 text-right text-xs font-mono text-emerald-600 dark:text-emerald-400">
                              {item.discountAmount > 0 ? `-${formatOrderPrice(item.discountAmount, currency)}` : "—"}
                            </td>
                          )}

                          {/* Line Total */}
                          <td className="py-3 px-4 text-right font-semibold text-sm font-mono text-foreground">
                            {formatOrderPrice(item.lineTotal, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Breakdown Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Financial Summary</CardTitle>
                <Receipt className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Subtotal</span>
                  <span className="font-mono">{formatOrderPrice(order.subtotal, currency)}</span>
                </div>

                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discounts Applied</span>
                    <span className="font-mono">-{formatOrderPrice(order.discountTotal, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-mono">
                    {order.shippingTotal > 0
                      ? formatOrderPrice(order.shippingTotal, currency)
                      : "Free Shipping"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-mono">{formatOrderPrice(order.taxTotal, currency)}</span>
                </div>

                <div className="border-t border-border mt-3 pt-3 flex justify-between text-base font-bold">
                  <span>Grand Total</span>
                  <span className="font-mono text-foreground">
                    {formatOrderPrice(order.grandTotal ?? order.total, currency)}
                  </span>
                </div>

                {refundSummary && refundSummary.refundedAmount > 0 && (
                  <div className="border-t border-dashed border-border mt-3 pt-3 space-y-1">
                    <div className="flex justify-between text-destructive text-xs">
                      <span>Total Refunded</span>
                      <span className="font-mono">-{formatOrderPrice(refundSummary.refundedAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-sm">
                      <span>Net Settled Total</span>
                      <span className="font-mono">
                        {formatOrderPrice(
                          Math.max(0, (order.grandTotal ?? order.total) - refundSummary.refundedAmount),
                          currency,
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Refund History Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Refund History ({refundSummary?.refunds?.length ?? 0})
                </CardTitle>
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(!refundSummary?.refunds || refundSummary.refunds.length === 0) ? (
                <div className="p-5 text-center text-xs text-muted-foreground">
                  No refund transactions recorded for this order.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Date</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Amount</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Status</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Reason</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {refundSummary.refunds.map((refund: RefundDTO) => (
                        <tr key={refund.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {formatOrderDate(refund.createdAt)}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-xs font-mono text-destructive">
                            -{formatOrderPrice(refund.amount, refund.currency || currency)}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant={
                                refund.status === "SUCCEEDED"
                                  ? "success"
                                  : refund.status === "FAILED"
                                  ? "danger"
                                  : "warning"
                              }
                              size="sm"
                            >
                              {refund.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-foreground">
                            {refund.reason || "—"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">
                            {refund.providerRefundId || refund.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History & Audit Trail */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Order Lifecycle & Audit Timeline
                </CardTitle>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {(!order.statusHistory || order.statusHistory.length === 0) ? (
                <p className="m-0 text-xs text-muted-foreground">
                  No previous transition records found. Current status: <strong>{order.status}</strong>.
                </p>
              ) : (
                <div className="space-y-4">
                  {order.statusHistory.map((entry: OrderStatusHistoryDTO, index: number) => (
                    <div
                      key={entry.id || index}
                      className="flex gap-3 items-start relative pl-2"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0 ring-4 ring-primary/20" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between flex-wrap gap-1">
                          <span className="font-semibold text-xs text-foreground">
                            {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Created as ${entry.toStatus}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatOrderDate(entry.createdAt)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Actor: <strong className="text-foreground">{entry.actorType}</strong>
                          {entry.reason && ` • "${entry.reason}"`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Customer, Payment & Fulfillment Info (1 col) */}
        <div className="space-y-6">
          {/* Customer & Shipping Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Customer & Delivery</CardTitle>
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div>
                <div className="text-muted-foreground uppercase font-semibold text-[11px]">
                  Customer Type
                </div>
                <div className="font-semibold text-sm text-foreground mt-0.5">
                  {order.customerId ? "Registered Store Customer" : "Guest Customer"}
                </div>
                {order.customerId && (
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">
                    ID: {order.customerId}
                  </div>
                )}
              </div>

              {/* Shipping Address */}
              {shippingAddr ? (
                <div className="border-t border-border/50 pt-3 space-y-1">
                  <div className="text-muted-foreground uppercase font-semibold text-[11px] mb-1">
                    Shipping Address
                  </div>
                  <div className="font-semibold text-foreground text-sm">{shippingAddr.name}</div>
                  <div className="text-muted-foreground">{shippingAddr.addressLine1}</div>
                  {shippingAddr.addressLine2 && (
                    <div className="text-muted-foreground">{shippingAddr.addressLine2}</div>
                  )}
                  <div className="text-muted-foreground">
                    {shippingAddr.city}, {shippingAddr.state} {shippingAddr.postalCode}
                  </div>
                  <div className="text-muted-foreground">{shippingAddr.country}</div>
                  {shippingAddr.phone && (
                    <div className="text-muted-foreground text-xs mt-1">
                      Tel: {shippingAddr.phone}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground italic">
                  No shipping address attached to this order.
                </div>
              )}

              {/* Billing Address if different */}
              {billingAddr && billingAddr !== shippingAddr && (
                <div className="border-t border-border/50 pt-3 space-y-1">
                  <div className="text-muted-foreground uppercase font-semibold text-[11px] mb-1">
                    Billing Address
                  </div>
                  <div className="font-semibold text-foreground">{billingAddr.name}</div>
                  <div className="text-muted-foreground">{billingAddr.addressLine1}</div>
                  <div className="text-muted-foreground">
                    {billingAddr.city}, {billingAddr.country}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Details Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Payment Information</CardTitle>
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs">
              <div>
                <div className="text-muted-foreground uppercase font-semibold text-[11px]">
                  Payment Status
                </div>
                <div className="mt-1">
                  <OrderPaymentBadge status={order.paymentStatus} size="md" />
                </div>
              </div>

              {order.paymentId && (
                <div className="border-t border-border/50 pt-2.5">
                  <div className="text-muted-foreground uppercase font-semibold text-[11px]">
                    Payment Provider Reference
                  </div>
                  <div className="font-mono text-xs text-foreground mt-0.5 break-all select-all bg-muted/60 px-2 py-1 rounded">
                    {order.paymentId}
                  </div>
                </div>
              )}

              {order.checkoutId && (
                <div className="border-t border-border/50 pt-2.5">
                  <div className="text-muted-foreground uppercase font-semibold text-[11px]">
                    Checkout Reference
                  </div>
                  <div className="font-mono text-xs text-foreground mt-0.5 break-all select-all bg-muted/60 px-2 py-1 rounded">
                    {order.checkoutId}
                  </div>
                </div>
              )}

              <div className="bg-muted/40 p-2.5 rounded border border-border/50 text-[11px] text-muted-foreground">
                Payments are verified with backend HMAC signatures and encrypted test credentials.
              </div>
            </CardContent>
          </Card>

          {/* Fulfillment Pipeline Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Fulfillment Pipeline</CardTitle>
                <Badge
                  variant={order.fulfillmentStatus === "FULFILLED" ? "success" : "neutral"}
                  size="sm"
                >
                  {order.fulfillmentStatus === "FULFILLED" ? "Fulfilled" : "Pending"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div>
                <div className="text-muted-foreground uppercase font-semibold text-[11px]">
                  Fulfillment Status
                </div>
                <div className="mt-1">
                  <OrderFulfillmentBadge status={order.fulfillmentStatus} size="md" />
                </div>
              </div>

              {latestFulfillmentHistory?.reason && (
                <div className="bg-muted/40 p-2.5 rounded border border-border/50 text-xs text-foreground">
                  <div className="font-semibold text-xs mb-0.5 text-muted-foreground">
                    Dispatch & Tracking:
                  </div>
                  <div>{latestFulfillmentHistory.reason}</div>
                </div>
              )}

              {isFulfillable && onOpenFulfill && (
                <div className="pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onOpenFulfill}
                    className="w-full gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Fulfill Items Now</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
