"use client";

import React from "react";
import Link from "next/link";
import type { OrderAddressDTO, OrderDTO, OrderItemDTO, OrderStatusHistoryDTO } from "@calcart/orders";
import type { OrderRefundSummaryDTO, RefundDTO } from "@calcart/payments";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@calcart/ui";
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
  CheckCircle2,
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
      {/* Streamlined Executive Order Fulfillment Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-card shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/merchant/orders"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mr-1 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>All Orders</span>
            </Link>
            <span className="text-border">|</span>
            <h1 className="text-xl font-bold tracking-tight text-foreground font-mono m-0">
              Order #{order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.status} size="sm" />
            <OrderPaymentBadge status={order.paymentStatus} size="sm" />
            <OrderFulfillmentBadge status={order.fulfillmentStatus} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground m-0 flex items-center gap-2 flex-wrap">
            <span>Placed <span className="font-mono text-foreground font-medium">{formatOrderDate(order.createdAt)}</span></span>
            <span>&bull;</span>
            <span>Updated <span className="font-mono text-foreground font-medium">{formatOrderDate(order.updatedAt)}</span></span>
            {order.paymentId && (
              <>
                <span>&bull;</span>
                <span>Payment Ref: <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground">{order.paymentId}</code></span>
              </>
            )}
          </p>
        </div>

        {/* Actions: Fulfill, Refund, Cancel */}
        <div className="flex gap-2 items-center flex-wrap shrink-0">
          {isFulfillable && onOpenFulfill && (
            <Button
              variant="primary"
              onClick={onOpenFulfill}
              title="Fulfill order and record tracking details"
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Fulfill Order</span>
            </Button>
          )}

          {isRefundable && onOpenRefund && (
            <Button
              variant="outline"
              onClick={onOpenRefund}
              disabled={isStaff}
              title={isStaff ? "Requires Admin or Owner role" : "Initiate a full refund for this order"}
              size="sm"
              className="h-8 text-xs font-semibold text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refund Order</span>
            </Button>
          )}

          {isCancellable && (
            <Button
              variant="outline"
              onClick={onOpenCancel}
              disabled={isStaff}
              title={isStaff ? "Requires Admin or Owner role" : "Cancel order and release inventory"}
              size="sm"
              className="h-8 text-xs font-semibold text-destructive/80 border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Order</span>
            </Button>
          )}
        </div>
      </div>

      {/* Cancellation Banner if cancelled */}
      {order.status === "CANCELLED" && (
        <Alert variant="danger" title="Order Cancelled">
          <p className="mb-1 text-xs">
            This order was cancelled on {formatOrderDate(order.cancelledAt)}.
          </p>
          {order.cancelReason && (
            <p className="m-0 text-xs">
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

      {/* Main 2-Column Content Layout: 8 cols main, 4 cols sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Line Items, Totals, Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Purchased Items Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Purchased Items ({order.items?.length ?? 0})
                  </CardTitle>
                </div>
                <Badge variant="neutral" size="sm" className="font-mono text-[11px]">
                  {order.items?.reduce((acc, i) => acc + i.quantity, 0) ?? 0} units
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(!order.items || order.items.length === 0) ? (
                <div className="p-6 text-xs text-muted-foreground text-center">
                  No item line records recorded for this order.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">Item Details</th>
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">SKU</th>
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider text-right">Price</th>
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider text-center">Qty</th>
                        {order.discountTotal > 0 && (
                          <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider text-right">Discount</th>
                        )}
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {order.items.map((item: OrderItemDTO) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          {/* Item Details */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm text-foreground">
                              {item.productId ? (
                                <Link
                                  href={`/merchant/products/${encodeURIComponent(item.productId)}`}
                                  className="hover:underline hover:text-primary transition-colors"
                                >
                                  {item.productNameSnapshot}
                                </Link>
                              ) : (
                                item.productNameSnapshot
                              )}
                            </div>
                            {item.variantNameSnapshot && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {item.variantNameSnapshot}
                              </div>
                            )}
                          </td>

                          {/* SKU */}
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                            {item.skuSnapshot ? (
                              <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] text-foreground font-mono">
                                {item.skuSnapshot}
                              </code>
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-4 text-right text-xs font-mono text-muted-foreground">
                            {formatOrderPrice(item.unitPrice, currency)}
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-4 text-center font-mono font-semibold text-xs text-foreground">
                            ×{item.quantity}
                          </td>

                          {/* Discount */}
                          {order.discountTotal > 0 && (
                            <td className="py-3 px-4 text-right text-xs font-mono text-emerald-600 dark:text-emerald-400">
                              {item.discountAmount > 0 ? `-${formatOrderPrice(item.discountAmount, currency)}` : "—"}
                            </td>
                          )}

                          {/* Line Total */}
                          <td className="py-3 px-4 text-right font-semibold text-xs font-mono text-foreground">
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
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">Financial Summary</CardTitle>
                </div>
                <Badge variant="neutral" size="sm" className="font-mono text-[11px]">
                  {currency}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Items Subtotal</span>
                  <span className="font-mono font-medium text-foreground">{formatOrderPrice(order.subtotal, currency)}</span>
                </div>

                {order.discountTotal > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span>Discounts Applied</span>
                    <span className="font-mono font-medium">-{formatOrderPrice(order.discountTotal, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-mono font-medium text-foreground">
                    {order.shippingTotal > 0
                      ? formatOrderPrice(order.shippingTotal, currency)
                      : "Free Shipping"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-mono font-medium text-foreground">{formatOrderPrice(order.taxTotal, currency)}</span>
                </div>

                <div className="border-t border-border/60 mt-3 pt-3 flex justify-between items-center text-sm font-bold">
                  <span className="text-foreground">Grand Total</span>
                  <span className="font-mono text-base font-bold text-foreground">
                    {formatOrderPrice(order.grandTotal ?? order.total, currency)}
                  </span>
                </div>

                {refundSummary && refundSummary.refundedAmount > 0 && (
                  <div className="border-t border-dashed border-border/60 mt-3 pt-3 space-y-1.5">
                    <div className="flex justify-between items-center text-destructive text-xs">
                      <span>Total Refunded</span>
                      <span className="font-mono font-semibold">-{formatOrderPrice(refundSummary.refundedAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between items-center font-semibold text-xs">
                      <span className="text-foreground">Net Settled Total</span>
                      <span className="font-mono text-foreground font-bold">
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
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Refund History ({refundSummary?.refunds?.length ?? 0})
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(!refundSummary?.refunds || refundSummary.refunds.length === 0) ? (
                <div className="p-5 text-center text-xs text-muted-foreground">
                  No refund transactions recorded for this order.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">Date</th>
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">Amount</th>
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">Status</th>
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">Reason</th>
                        <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {refundSummary.refunds.map((refund: RefundDTO) => (
                        <tr key={refund.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
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
                              className="text-[10px] font-semibold"
                            >
                              {refund.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-foreground">
                            {refund.reason || "—"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] text-foreground font-mono">
                              {refund.providerRefundId || refund.id}
                            </code>
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
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Order Lifecycle & Audit Timeline
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {(!order.statusHistory || order.statusHistory.length === 0) ? (
                <p className="m-0 text-xs text-muted-foreground">
                  No previous transition records found. Current status: <strong className="text-foreground">{order.status}</strong>.
                </p>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-border/60">
                  {order.statusHistory.map((entry: OrderStatusHistoryDTO, index: number) => (
                    <div
                      key={entry.id || index}
                      className="relative"
                    >
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
                      <div className="min-w-0">
                        <div className="flex justify-between flex-wrap gap-1">
                          <span className="font-semibold text-xs text-foreground">
                            {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Created as ${entry.toStatus}`}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
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

        {/* Right Column: Customer, Payment & Fulfillment Info (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Fulfillment Pipeline Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">Fulfillment Pipeline</CardTitle>
                </div>
                <Badge
                  variant={order.fulfillmentStatus === "FULFILLED" ? "success" : "neutral"}
                  size="sm"
                  className="text-[10px] font-semibold"
                >
                  {order.fulfillmentStatus === "FULFILLED" ? "Fulfilled" : "Pending"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5 text-xs">
              <div>
                <div className="text-muted-foreground uppercase font-semibold text-[11px] mb-1">
                  Fulfillment Status
                </div>
                <div>
                  <OrderFulfillmentBadge status={order.fulfillmentStatus} size="md" />
                </div>
              </div>

              {latestFulfillmentHistory?.reason && (
                <div className="bg-muted/40 p-3 rounded-lg border border-border/50 text-xs text-foreground space-y-1">
                  <div className="font-semibold text-xs text-muted-foreground">
                    Dispatch &amp; Tracking:
                  </div>
                  <div className="font-mono text-xs">{latestFulfillmentHistory.reason}</div>
                </div>
              )}

              {isFulfillable && onOpenFulfill && (
                <div className="pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onOpenFulfill}
                    className="w-full gap-1.5 h-8 text-xs font-semibold"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Fulfill Items Now</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer & Delivery Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">Customer & Delivery</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
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
                    <div className="text-muted-foreground text-xs mt-1 font-mono">
                      Tel: {shippingAddr.phone}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground italic border-t border-border/50 pt-3">
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
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">Payment Information</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5 text-xs">
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
                  <div className="font-mono text-xs text-foreground mt-0.5 break-all select-all bg-muted/60 px-2 py-1 rounded border border-border/40">
                    {order.paymentId}
                  </div>
                </div>
              )}

              {order.checkoutId && (
                <div className="border-t border-border/50 pt-2.5">
                  <div className="text-muted-foreground uppercase font-semibold text-[11px]">
                    Checkout Reference
                  </div>
                  <div className="font-mono text-xs text-foreground mt-0.5 break-all select-all bg-muted/60 px-2 py-1 rounded border border-border/40">
                    {order.checkoutId}
                  </div>
                </div>
              )}

              <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-[11px] text-muted-foreground flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>Payments are verified with backend HMAC signatures and encrypted test credentials.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
