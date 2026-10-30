"use client";

import React from "react";
import type { OrderDTO } from "@calcart/orders";
import { formatStorePrice } from "../products/product-card";
import { Badge, Card, CardContent } from "@calcart/ui";
import { CheckCircle2, PackageCheck, Truck } from "lucide-react";

export interface OrderConfirmationProps {
  order: OrderDTO;
  storeSlug: string;
  storeName: string;
}

export function OrderConfirmation({
  order,
  storeSlug,
  storeName,
}: OrderConfirmationProps) {
  const currency = order.currency || "USD";
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  const isPaid = order.paymentStatus === "PAID";
  const isPending = order.paymentStatus === "PENDING" || order.paymentStatus === "AUTHORIZED";

  const shippingAddr = order.addresses?.find((a) => a.type === "SHIPPING");

  return (
    <div className="storefront-order-confirmation-container max-w-5xl mx-auto space-y-10" data-testid="order-confirmation-view">
      {/* 1. Celebratory Success Hero */}
      <div className="order-confirmation-hero text-center py-8 space-y-3">
        <div
          className="order-confirmation-icon inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-lg mb-2"
          aria-hidden="true"
        >
          {isPaid ? <CheckCircle2 size={40} className="text-emerald-500" /> : <PackageCheck size={40} className="text-primary" />}
        </div>
        <h1 className="order-confirmation-title text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          {isPaid ? "Thank You for Your Order!" : "Order Received"}
        </h1>
        <p className="order-confirmation-subtitle text-muted text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
          {isPaid
            ? `Your payment has been verified. A confirmation email has been sent from ${storeName}.`
            : "Your order has been recorded and payment verification is in progress."}
        </p>
      </div>

      {/* 2. Order Breakdown Grid */}
      <div
        className="order-confirmation-layout grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left Column: Order metadata & items (8 cols on lg) */}
        <div className="order-confirmation-main lg:col-span-8 space-y-6">
          {/* Order Header Card */}
          <Card className="rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-sm">
            <CardContent className="p-0 space-y-5">
              <div
                className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border/60"
              >
                <div>
                  <span className="text-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Number</span>
                  <div className="font-extrabold text-xl tracking-tight text-foreground" data-testid="order-number">
                    {order.orderNumber}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isPaid ? "success" : isPending ? "warning" : "danger"} size="md" data-testid="payment-status-badge" className="font-bold">
                    {order.paymentStatus}
                  </Badge>
                  <Badge variant="info" size="md" className="font-semibold">
                    {order.status}
                  </Badge>
                </div>
              </div>

              {shippingAddr && (
                <div className="space-y-1.5 text-sm">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Truck size={14} className="text-primary" /> Shipping Address
                  </span>
                  <div className="text-foreground leading-relaxed pl-5" data-testid="order-shipping-address">
                    <div className="font-semibold">{shippingAddr.name}</div>
                    <div className="text-muted-foreground">{shippingAddr.addressLine1}</div>
                    {shippingAddr.addressLine2 && <div className="text-muted-foreground">{shippingAddr.addressLine2}</div>}
                    <div className="text-muted-foreground">
                      {shippingAddr.city}, {shippingAddr.state} {shippingAddr.postalCode}
                    </div>
                    <div className="text-muted-foreground">{shippingAddr.country}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchased Items Card */}
          <Card className="rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-sm">
            <CardContent className="p-0 space-y-4">
              <h3 className="font-bold text-base text-foreground tracking-tight">
                Items Ordered
              </h3>
              <ul className="order-items-list divide-y divide-border/50 list-none p-0 m-0" role="list">
                {order.items?.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between items-center py-3.5"
                    data-testid={`order-item-${item.id}`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-sm text-foreground">{item.productNameSnapshot}</div>
                      {item.variantNameSnapshot &&
                        item.variantNameSnapshot !== "Default Title" &&
                        item.variantNameSnapshot !== "Default" && (
                          <div className="text-muted text-xs text-muted-foreground">{item.variantNameSnapshot}</div>
                        )}
                      <div className="text-muted text-xs text-muted-foreground">Qty: {item.quantity}</div>
                    </div>
                    <div className="font-bold text-sm text-foreground">
                      {formatStorePrice(item.unitPrice * item.quantity, currency)}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="pt-2">
            <a
              href={catalogHref}
              className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-bold shadow-md hover:shadow-primary/20 transition-all inline-flex items-center gap-2"
            >
              <span>← Continue Shopping</span>
            </a>
          </div>
        </div>

        {/* Right Column: Order Financial Summary (4 cols on lg, sticky) */}
        <div className="order-confirmation-sidebar lg:col-span-4 lg:sticky lg:top-28">
          <Card className="rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-sm">
            <CardContent className="p-0 space-y-4">
              <h3 className="font-bold text-base text-foreground tracking-tight">
                Payment Summary
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted text-muted-foreground font-medium">Subtotal</span>
                  <span className="font-semibold text-foreground">{formatStorePrice(order.subtotal, currency)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between items-center text-emerald-500 font-semibold">
                    <span className="text-muted">Discounts</span>
                    <span className="text-success">-{formatStorePrice(order.discountTotal, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted text-muted-foreground font-medium">Shipping</span>
                  <span className="font-semibold text-foreground">{order.shippingTotal > 0 ? formatStorePrice(order.shippingTotal, currency) : "Free"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted text-muted-foreground font-medium">Taxes</span>
                  <span className="font-semibold text-foreground">{order.taxTotal > 0 ? formatStorePrice(order.taxTotal, currency) : "Included"}</span>
                </div>
                <div className="h-px bg-border/60 my-2" />
                <div className="flex justify-between items-baseline pt-1">
                  <span className="font-bold text-base text-foreground">Total Paid</span>
                  <span className="font-extrabold text-2xl tracking-tight text-foreground" data-testid="order-grand-total">
                    {formatStorePrice(order.grandTotal ?? order.total, currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
