"use client";

import React from "react";
import Link from "next/link";
import type { OrderDTO } from "@shopify-clone/orders";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopify-clone/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Package,
  PackageCheck,
  PackageX,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
} from "lucide-react";

export interface OrderDetailViewProps {
  order: OrderDTO;
  storeSlug: string;
  storeName?: string;
}

export function OrderDetailView({
  order,
  storeSlug,
}: OrderDetailViewProps) {
  const formatPrice = (minorUnits: number | undefined | null, currency: string) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format((minorUnits || 0) / 100);
  };

  const getPaymentBadgeVariant = (status: string): "success" | "warning" | "danger" | "neutral" => {
    if (status === "PAID") return "success";
    if (status === "PENDING" || status === "AUTHORIZED") return "warning";
    if (status === "FAILED" || status === "REFUNDED") return "danger";
    return "neutral";
  };

  const getFulfillmentBadgeVariant = (status: string): "success" | "info" | "danger" | "neutral" => {
    if (status === "FULFILLED" || status === "DELIVERED") return "success";
    if (status === "SHIPPED" || status === "PARTIALLY_FULFILLED") return "info";
    if (status === "CANCELLED") return "danger";
    return "neutral";
  };

  const shippingAddr = order.addresses?.find((a) => a.type === "SHIPPING");
  const billingAddr = order.addresses?.find((a) => a.type === "BILLING");

  const isPaid = order.paymentStatus === "PAID";
  const isFulfilled = order.fulfillmentStatus === "FULFILLED";
  const isPartiallyFulfilled = order.fulfillmentStatus === "PARTIALLY_FULFILLED";
  const isCancelled = order.status === "CANCELLED";

  return (
    <div className="space-y-8" data-testid="order-details-view">
      {/* Header & Breadcrumb */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary">
              ORDER SUMMARY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            Order #{order.orderNumber}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock size={13} />
            <span>
              Placed on {new Date(order.createdAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href={`/stores/${encodeURIComponent(storeSlug)}/account/orders`}
            className="btn btn-outline btn-sm rounded-2xl px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Order History</span>
          </Link>
          <Link
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-outline btn-sm rounded-2xl px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 transition-colors"
          >
            <ShoppingBag size={13} />
            <span>Browse Store</span>
          </Link>
        </div>
      </header>

      {/* Status & Fulfillment Overview */}
      <Card className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-md p-6 sm:p-7 shadow-sm">
        <CardContent className="p-0 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/50">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                Order Status
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={getPaymentBadgeVariant(order.paymentStatus)}
                  size="md"
                  className="font-mono text-xs font-bold uppercase tracking-wider"
                  data-testid="order-payment-status"
                >
                  Payment: {order.paymentStatus}
                </Badge>
                <Badge
                  variant={getFulfillmentBadgeVariant(order.fulfillmentStatus)}
                  size="md"
                  className="font-mono text-xs font-bold uppercase tracking-wider"
                  data-testid="order-fulfillment-status"
                >
                  Fulfillment: {order.fulfillmentStatus}
                </Badge>
                <Badge
                  variant={order.status === "COMPLETED" ? "success" : order.status === "CANCELLED" ? "danger" : "info"}
                  size="md"
                  className="font-mono text-xs font-bold uppercase tracking-wider"
                  data-testid="order-status"
                >
                  {order.status}
                </Badge>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                Total Paid
              </span>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground" data-testid="order-total-amount">
                {formatPrice(order.total, order.currency)}
              </div>
            </div>
          </div>

          {/* Fulfillment Lifecycle Stepper */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground block">
              Fulfillment Progress
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Step 1: Placed */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-500 font-mono text-xs font-bold">
                  <CheckCircle2 size={15} />
                  <span>1. Placed</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Order recorded</p>
              </div>

              {/* Step 2: Payment */}
              <div
                className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  isPaid
                    ? "bg-muted/30 border-border/50 text-emerald-500"
                    : "bg-muted/10 border-border/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  {isPaid ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Clock size={15} />}
                  <span>2. Payment</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isPaid ? "Payment confirmed" : "Verification pending"}
                </p>
              </div>

              {/* Step 3: Fulfillment */}
              <div
                className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  isFulfilled
                    ? "bg-muted/30 border-border/50 text-emerald-500"
                    : isPartiallyFulfilled
                    ? "bg-primary/5 border-primary/30 text-primary"
                    : "bg-muted/10 border-border/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  {isFulfilled ? (
                    <PackageCheck size={15} className="text-emerald-500" />
                  ) : isPartiallyFulfilled ? (
                    <Truck size={15} className="text-primary animate-pulse" />
                  ) : (
                    <Package size={15} />
                  )}
                  <span>3. Fulfillment</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isFulfilled
                    ? "Shipped & packed"
                    : isPartiallyFulfilled
                    ? "Partially shipped"
                    : "Preparing order"}
                </p>
              </div>

              {/* Step 4: Completion */}
              <div
                className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  order.status === "COMPLETED" || isFulfilled
                    ? "bg-muted/30 border-border/50 text-emerald-500"
                    : isCancelled
                    ? "bg-destructive/5 border-destructive/30 text-destructive"
                    : "bg-muted/10 border-border/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  {order.status === "COMPLETED" ? (
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  ) : isCancelled ? (
                    <PackageX size={15} className="text-destructive" />
                  ) : (
                    <Clock size={15} />
                  )}
                  <span>4. Complete</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isCancelled ? "Order cancelled" : order.status === "COMPLETED" ? "Order delivered" : "In transit"}
                </p>
              </div>
            </div>
          </div>

          {/* Status Timeline History */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="pt-4 border-t border-border/50 space-y-3" data-testid="order-activity-log">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground block">
                Activity &amp; Tracking Log
              </span>
              <div className="space-y-2">
                {order.statusHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-2xl bg-muted/20 border border-border/40 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-mono font-semibold text-foreground">
                        {entry.reason || `Status updated to ${entry.toStatus}`}
                      </span>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>Actor: {entry.actorType}</span>
                        {entry.fromStatus && (
                          <span>
                            ({entry.fromStatus} &rarr; {entry.toStatus})
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        dateStyle: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layout Grid: Items (8 cols) & Summary/Addresses (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Line Items */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md p-6 sm:p-7 shadow-sm" data-testid="order-items-card">
            <CardHeader className="p-0 pb-5 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-primary" />
                  <CardTitle className="text-lg font-bold tracking-tight text-foreground">
                    Purchased Items ({order.items?.length || 0})
                  </CardTitle>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  Currency: {order.currency}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0 pt-4 divide-y divide-border/40">
              {order.items && order.items.length > 0 ? (
                order.items.map((item) => (
                  <div key={item.id} className="py-4 first:pt-2 last:pb-2 flex items-start justify-between gap-4" data-testid={`order-item-${item.id}`}>
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center shrink-0 text-muted-foreground">
                        <Package size={20} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-foreground leading-snug" data-testid="item-name">
                          {item.productNameSnapshot}
                        </h4>
                        {item.variantNameSnapshot && (
                          <p className="text-xs text-muted-foreground font-mono" data-testid="item-variant">
                            {item.variantNameSnapshot}
                          </p>
                        )}
                        {item.skuSnapshot && (
                          <p className="text-[11px] text-muted-foreground/80 font-mono" data-testid="item-sku">
                            SKU: {item.skuSnapshot}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground font-mono pt-0.5">
                          Qty: <span data-testid="item-quantity">{item.quantity}</span> &times; {formatPrice(item.unitPrice, order.currency)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono font-bold text-sm text-foreground shrink-0" data-testid="item-line-total">
                      {formatPrice(item.lineTotal, order.currency)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground font-mono">
                  No item snapshots recorded for this order.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Addresses Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shipping Address */}
            <Card className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md p-6 shadow-sm" data-testid="order-shipping-address-card">
              <CardHeader className="p-0 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-primary" />
                  <CardTitle className="text-sm font-bold tracking-tight text-foreground">
                    Shipping Address
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-3 text-xs leading-relaxed space-y-1 text-muted-foreground">
                {shippingAddr ? (
                  <div data-testid="shipping-address-content">
                    <div className="font-bold text-foreground">{shippingAddr.name}</div>
                    <div>{shippingAddr.addressLine1}</div>
                    {shippingAddr.addressLine2 && <div>{shippingAddr.addressLine2}</div>}
                    <div>
                      {shippingAddr.city}, {shippingAddr.state} {shippingAddr.postalCode}
                    </div>
                    <div>{shippingAddr.country}</div>
                    {shippingAddr.phone && <div className="font-mono pt-1">Tel: {shippingAddr.phone}</div>}
                  </div>
                ) : (
                  <p className="text-muted-foreground font-mono">No shipping address recorded</p>
                )}
              </CardContent>
            </Card>

            {/* Billing Address */}
            <Card className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md p-6 shadow-sm" data-testid="order-billing-address-card">
              <CardHeader className="p-0 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-primary" />
                  <CardTitle className="text-sm font-bold tracking-tight text-foreground">
                    Billing Address
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-3 text-xs leading-relaxed space-y-1 text-muted-foreground">
                {billingAddr ? (
                  <div data-testid="billing-address-content">
                    <div className="font-bold text-foreground">{billingAddr.name}</div>
                    <div>{billingAddr.addressLine1}</div>
                    {billingAddr.addressLine2 && <div>{billingAddr.addressLine2}</div>}
                    <div>
                      {billingAddr.city}, {billingAddr.state} {billingAddr.postalCode}
                    </div>
                    <div>{billingAddr.country}</div>
                    {billingAddr.phone && <div className="font-mono pt-1">Tel: {billingAddr.phone}</div>}
                  </div>
                ) : shippingAddr ? (
                  <p className="text-muted-foreground">Same as shipping address</p>
                ) : (
                  <p className="text-muted-foreground font-mono">No billing address recorded</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Pricing Breakdown & Payment */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md p-6 sm:p-7 shadow-sm" data-testid="order-payment-card">
            <CardHeader className="p-0 pb-4 border-b border-border/50">
              <CardTitle className="text-base font-bold tracking-tight text-foreground">
                Payment Breakdown
              </CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                Detailed financial audit
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 pt-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span data-testid="order-subtotal">{formatPrice(order.subtotal, order.currency)}</span>
              </div>

              {order.discountTotal > 0 && (
                <div className="flex items-center justify-between text-emerald-500 font-semibold" data-testid="order-discount">
                  <span className="flex items-center gap-1">
                    <Tag size={12} />
                    <span>Discount {order.discountCode ? `(${order.discountCode})` : ""}</span>
                  </span>
                  <span>-{formatPrice(order.discountTotal, order.currency)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Shipping</span>
                <span data-testid="order-shipping">
                  {order.shippingTotal > 0 ? formatPrice(order.shippingTotal, order.currency) : "Free"}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Taxes</span>
                <span data-testid="order-tax">{formatPrice(order.taxTotal, order.currency)}</span>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-foreground font-bold text-base">
                <span>Total</span>
                <span data-testid="order-grand-total">{formatPrice(order.total, order.currency)}</span>
              </div>

              {order.paymentId && (
                <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground break-all">
                  <span className="block font-semibold uppercase text-[10px] tracking-wider">Payment Ref:</span>
                  <span>{order.paymentId}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return / Support Card */}
          <div className="p-5 rounded-3xl bg-muted/20 border border-border/50 space-y-2 text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-primary" />
              <span>Purchase Protection</span>
            </span>
            <p className="text-muted-foreground leading-relaxed">
              All purchases are cryptographically signed and tracked with multi-tenant data isolation. Need assistance with this order? Contact store support with your order number.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
