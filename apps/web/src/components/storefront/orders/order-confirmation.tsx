"use client";

import Link from "next/link";
import React from "react";
import type { OrderDTO } from "@calcart/orders";
import { formatStorePrice } from "../products/product-card";
import { Badge, Card, CardContent } from "@calcart/ui";
import { CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "../motion/storefront-motion";

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
    <div className="storefront-order-confirmation-container space-y-10" data-testid="order-confirmation-view">
      {/* 1. Letter-style heading. The mark only appears for an order the server reports as PAID. */}
      <div className="order-confirmation-hero border-b border-[color:var(--at-hairline)] pb-10 pt-4">
        <motion.div
          className="order-confirmation-icon mb-5 inline-flex h-11 w-11 items-center justify-center border border-foreground text-foreground"
          aria-hidden="true"
          initial={isPaid ? { opacity: 0, scale: 0.9 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          {isPaid ? <CheckCircle2 size={22} strokeWidth={1.5} /> : <PackageCheck size={22} strokeWidth={1.5} />}
        </motion.div>
        <h1 className="order-confirmation-title at-display-lg text-foreground">
          {isPaid ? "Thank You for Your Order!" : "Order Received"}
        </h1>
        <p className="order-confirmation-subtitle at-lede mt-4 max-w-lg text-muted-foreground">
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
          <Reveal>
          <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent p-6 sm:p-7">
            <CardContent className="p-0 space-y-5">
              <div
                className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-[color:var(--at-hairline)]"
              >
                <div>
                  <span className="text-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Number</span>
                  <div className="at-num text-xl text-foreground" data-testid="order-number">
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

          </Reveal>

          {/* Purchased Items Card */}
          <Reveal delay={0.05}>
          <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent p-6 sm:p-7">
            <CardContent className="p-0 space-y-4">
              <h3 className="at-title text-xl text-foreground">
                Items Ordered
              </h3>
              <ul className="order-items-list divide-y divide-[color:var(--at-hairline)] list-none p-0 m-0" role="list">
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

          </Reveal>

          <div className="pt-2">
            <Link
              href={catalogHref}
              className="at-press inline-flex h-12 items-center gap-2 bg-primary px-8 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground"
            >
              <span>← Continue Shopping</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Order Financial Summary (4 cols on lg, sticky) */}
        <div className="order-confirmation-sidebar lg:col-span-4 lg:sticky lg:top-28">
          <Reveal delay={0.1}>
          <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent p-6 sm:p-7">
            <CardContent className="p-0 space-y-4">
              <h3 className="at-title text-xl text-foreground">
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
                  <span className="font-bold text-base text-foreground">{isPaid ? "Total Paid" : "Order Total"}</span>
                  <span className="font-extrabold text-2xl tracking-tight text-foreground" data-testid="order-grand-total">
                    {formatStorePrice(order.grandTotal ?? order.total, currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
