"use client";

import React from "react";
import type { OrderDTO } from "@shopify-clone/orders";
import { formatStorePrice } from "../products/product-card";
import { Badge, Card, CardContent } from "@shopify-clone/ui";

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
    <div className="storefront-order-confirmation-container" data-testid="order-confirmation-view">
      {/* Success Banner */}
      <div className="order-confirmation-hero text-center" style={{ margin: "var(--space-8) 0 var(--space-6) 0" }}>
        <div
          className="order-confirmation-icon"
          style={{ fontSize: "3.5rem", marginBottom: "var(--space-2)" }}
          aria-hidden="true"
        >
          {isPaid ? "🎉" : "⏳"}
        </div>
        <h1 className="order-confirmation-title font-bold text-2xl" style={{ margin: "0 0 var(--space-2) 0" }}>
          {isPaid ? "Thank You for Your Order!" : "Order Received"}
        </h1>
        <p className="order-confirmation-subtitle text-muted text-sm" style={{ margin: 0 }}>
          {isPaid
            ? `Your payment has been verified. A confirmation email has been sent from ${storeName}.`
            : "Your order has been recorded and payment verification is in progress."}
        </p>
      </div>

      <div
        className="order-confirmation-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "var(--space-6)",
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        {/* Left Column: Order details & items */}
        <div className="order-confirmation-main" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Order Header Card */}
          <Card>
            <CardContent>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--color-border)",
                  marginBottom: "var(--space-3)",
                }}
              >
                <div>
                  <span className="text-muted text-xs">Order Number</span>
                  <div className="font-bold text-lg" data-testid="order-number">
                    {order.orderNumber}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Badge variant={isPaid ? "success" : isPending ? "warning" : "danger"} size="md" data-testid="payment-status-badge">
                    {order.paymentStatus}
                  </Badge>
                  <Badge variant="info" size="md">
                    {order.status}
                  </Badge>
                </div>
              </div>

              {shippingAddr && (
                <div style={{ fontSize: "var(--font-size-sm)" }}>
                  <span className="font-semibold text-xs text-muted" style={{ textTransform: "uppercase" }}>
                    Shipping Address
                  </span>
                  <div style={{ marginTop: "var(--space-1)" }} data-testid="order-shipping-address">
                    <div>{shippingAddr.name}</div>
                    <div>{shippingAddr.addressLine1}</div>
                    {shippingAddr.addressLine2 && <div>{shippingAddr.addressLine2}</div>}
                    <div>
                      {shippingAddr.city}, {shippingAddr.state} {shippingAddr.postalCode}
                    </div>
                    <div>{shippingAddr.country}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchased Items Card */}
          <Card>
            <CardContent>
              <h3 className="font-bold text-md" style={{ marginBottom: "var(--space-3)" }}>
                Items Ordered
              </h3>
              <ul className="order-items-list" role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {order.items?.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-2) 0",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                    data-testid={`order-item-${item.id}`}
                  >
                    <div>
                      <div className="font-medium text-sm">{item.productNameSnapshot}</div>
                      {item.variantNameSnapshot &&
                        item.variantNameSnapshot !== "Default Title" &&
                        item.variantNameSnapshot !== "Default" && (
                          <div className="text-muted text-xs">{item.variantNameSnapshot}</div>
                        )}
                      <div className="text-muted text-xs">Qty: {item.quantity}</div>
                    </div>
                    <div className="font-semibold text-sm">
                      {formatStorePrice(item.unitPrice * item.quantity, currency)}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div style={{ marginTop: "var(--space-4)" }}>
            <a href={catalogHref} className="btn btn-primary btn-md">
              ← Continue Shopping
            </a>
          </div>
        </div>

        {/* Right Column: Order Financial Summary */}
        <div className="order-confirmation-sidebar">
          <Card>
            <CardContent>
              <h3 className="font-bold text-md" style={{ marginBottom: "var(--space-4)" }}>
                Payment Summary
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Subtotal</span>
                  <span>{formatStorePrice(order.subtotal, currency)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-muted">Discounts</span>
                    <span className="text-success">-{formatStorePrice(order.discountTotal, currency)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Shipping</span>
                  <span>{order.shippingTotal > 0 ? formatStorePrice(order.shippingTotal, currency) : "Free"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Taxes</span>
                  <span>{order.taxTotal > 0 ? formatStorePrice(order.taxTotal, currency) : "Included"}</span>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "var(--space-2) 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "var(--font-size-base)" }}>
                  <span>Total Paid</span>
                  <span data-testid="order-grand-total">{formatStorePrice(order.grandTotal ?? order.total, currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
