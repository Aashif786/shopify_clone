"use client";

import React from "react";
import type { OrderAddressDTO, OrderDTO, OrderItemDTO, OrderStatusHistoryDTO } from "@shopify-clone/orders";
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

export interface OrderDetailsViewProps {
  order: OrderDTO;
  userRole?: string;
  onOpenCancel: () => void;
  onOpenFulfill?: () => void;
}

export function OrderDetailsView({
  order,
  userRole,
  onOpenCancel,
  onOpenFulfill,
}: OrderDetailsViewProps) {
  const isCancellable = canCancelOrderStatus(order.status);
  const isFulfillable =
    order.status !== "CANCELLED" &&
    order.status !== "COMPLETED" &&
    order.fulfillmentStatus !== "FULFILLED";
  const isStaff = userRole === "staff";
  const currency = order.currency || "USD";

  const shippingAddr = order.addresses?.find((a: OrderAddressDTO) => a.type === "SHIPPING");
  const billingAddr = order.addresses?.find((a: OrderAddressDTO) => a.type === "BILLING");

  const latestFulfillmentHistory = order.statusHistory
    ?.slice()
    .reverse()
    .find((h) => h.toStatus?.startsWith("fulfillment:"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Top Header Card */}
      <Card>
        <CardContent style={{ padding: "var(--space-5)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <a
                  href="/merchant/orders"
                  className="btn btn-ghost btn-sm"
                  style={{ textDecoration: "none", padding: "0 var(--space-2)" }}
                >
                  ← All Orders
                </a>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-2xl)",
                    fontWeight: "var(--font-weight-bold)",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  Order #{order.orderNumber}
                </h1>
                <OrderStatusBadge status={order.status} size="md" />
                <OrderPaymentBadge status={order.paymentStatus} size="md" />
                <OrderFulfillmentBadge status={order.fulfillmentStatus} size="md" />
              </div>
              <p
                style={{
                  margin: "var(--space-2) 0 0",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Placed on {formatOrderDate(order.createdAt)} • Last updated{" "}
                {formatOrderDate(order.updatedAt)}
              </p>
            </div>

            {/* Actions: Fulfill & Cancel */}
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              {isFulfillable && onOpenFulfill && (
                <Button
                  variant="primary"
                  onClick={onOpenFulfill}
                  title="Fulfill order and record tracking details"
                >
                  Fulfill Order
                </Button>
              )}

              {isCancellable && (
                <Button
                  variant="outline"
                  onClick={onOpenCancel}
                  disabled={isStaff}
                  title={isStaff ? "Requires Admin or Owner role" : "Cancel order and release inventory"}
                  style={{
                    color: "var(--color-danger, #dc2626)",
                    borderColor: "var(--color-danger, #dc2626)",
                  }}
                >
                  Cancel Order
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Banner if cancelled */}
      {order.status === "CANCELLED" && (
        <Alert variant="danger" title="Order Cancelled">
          <p style={{ margin: "0 0 var(--space-1) 0" }}>
            This order was cancelled on {formatOrderDate(order.cancelledAt)}.
          </p>
          {order.cancelReason && (
            <p style={{ margin: 0 }}>
              <strong>Reason:</strong> {order.cancelReason}
            </p>
          )}
        </Alert>
      )}

      {/* Main 2-Column Content Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        {/* Left Column: Line Items, Totals, Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Line Items Card */}
          <Card>
            <CardHeader>
              <CardTitle>Purchased Items ({order.items?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent style={{ padding: 0 }}>
              {(!order.items || order.items.length === 0) ? (
                <div style={{ padding: "var(--space-6)", color: "var(--color-text-muted)" }}>
                  No item line records recorded for this order.
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
                        <th style={{ padding: "var(--space-3) var(--space-4)" }}>Item Details</th>
                        <th style={{ padding: "var(--space-3) var(--space-4)" }}>SKU</th>
                        <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Price</th>
                        <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Qty</th>
                        {order.discountTotal > 0 && (
                          <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Discount</th>
                        )}
                        <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item: OrderItemDTO) => (
                        <tr
                          key={item.id}
                          style={{ borderBottom: "1px solid var(--color-border)" }}
                        >
                          {/* Item Details */}
                          <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                            <div style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" }}>
                              {item.productId ? (
                                <a
                                  href={`/merchant/products/${encodeURIComponent(item.productId)}`}
                                  style={{ color: "inherit", textDecoration: "none" }}
                                >
                                  {item.productNameSnapshot}
                                </a>
                              ) : (
                                item.productNameSnapshot
                              )}
                            </div>
                            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "2px" }}>
                              {item.variantNameSnapshot}
                            </div>
                          </td>

                          {/* SKU */}
                          <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono, monospace)", color: "var(--color-text-secondary)" }}>
                            {item.skuSnapshot || "—"}
                          </td>

                          {/* Unit Price */}
                          <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>
                            {formatOrderPrice(item.unitPrice, currency)}
                          </td>

                          {/* Quantity */}
                          <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", fontWeight: "var(--font-weight-semibold)" }}>
                            ×{item.quantity}
                          </td>

                          {/* Discount */}
                          {order.discountTotal > 0 && (
                            <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: "var(--color-success, #16a34a)" }}>
                              {item.discountAmount > 0 ? `-${formatOrderPrice(item.discountAmount, currency)}` : "—"}
                            </td>
                          )}

                          {/* Line Total */}
                          <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: "var(--font-weight-semibold)" }}>
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
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Items Subtotal</span>
                  <span>{formatOrderPrice(order.subtotal, currency)}</span>
                </div>

                {order.discountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", color: "var(--color-success, #16a34a)" }}>
                    <span>Discounts Applied</span>
                    <span>-{formatOrderPrice(order.discountTotal, currency)}</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Shipping</span>
                  <span>
                    {order.shippingTotal > 0
                      ? formatOrderPrice(order.shippingTotal, currency)
                      : "Free Shipping"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Taxes</span>
                  <span>{formatOrderPrice(order.taxTotal, currency)}</span>
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--color-border)",
                    marginTop: "var(--space-2)",
                    paddingTop: "var(--space-3)",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--font-size-lg)",
                    fontWeight: "var(--font-weight-bold)",
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {formatOrderPrice(order.grandTotal ?? order.total, currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status History & Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle>Order Lifecycle & Audit Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {(!order.statusHistory || order.statusHistory.length === 0) ? (
                <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  No previous transition records found. Current status: <strong>{order.status}</strong>.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {order.statusHistory.map((entry: OrderStatusHistoryDTO, index: number) => (
                    <div
                      key={entry.id || index}
                      style={{
                        display: "flex",
                        gap: "var(--space-3)",
                        alignItems: "flex-start",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: "var(--color-primary, #2563eb)",
                          marginTop: "6px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-1)" }}>
                          <span style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>
                            {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Created as ${entry.toStatus}`}
                          </span>
                          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                            {formatOrderDate(entry.createdAt)}
                          </span>
                        </div>
                        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                          Actor: <strong>{entry.actorType}</strong>
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

        {/* Right Column: Customer, Payment & Fulfillment Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Customer & Shipping Card */}
          <Card>
            <CardHeader>
              <CardTitle>Customer & Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--font-size-sm)" }}>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                    Customer Type
                  </div>
                  <div style={{ fontWeight: "var(--font-weight-semibold)", marginTop: "2px" }}>
                    {order.customerId ? "Registered Store Customer" : "Guest Customer"}
                  </div>
                  {order.customerId && (
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
                      ID: {order.customerId}
                    </div>
                  )}
                </div>

                {/* Shipping Address */}
                {shippingAddr ? (
                  <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)" }}>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", marginBottom: "4px" }}>
                      Shipping Address
                    </div>
                    <div style={{ fontWeight: "var(--font-weight-semibold)" }}>{shippingAddr.name}</div>
                    <div style={{ color: "var(--color-text-secondary)" }}>{shippingAddr.addressLine1}</div>
                    {shippingAddr.addressLine2 && (
                      <div style={{ color: "var(--color-text-secondary)" }}>{shippingAddr.addressLine2}</div>
                    )}
                    <div style={{ color: "var(--color-text-secondary)" }}>
                      {shippingAddr.city}, {shippingAddr.state} {shippingAddr.postalCode}
                    </div>
                    <div style={{ color: "var(--color-text-secondary)" }}>{shippingAddr.country}</div>
                    {shippingAddr.phone && (
                      <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", marginTop: "2px" }}>
                        Tel: {shippingAddr.phone}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                    No shipping address attached to this order.
                  </div>
                )}

                {/* Billing Address if different */}
                {billingAddr && billingAddr !== shippingAddr && (
                  <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)" }}>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", marginBottom: "4px" }}>
                      Billing Address
                    </div>
                    <div style={{ fontWeight: "var(--font-weight-semibold)" }}>{billingAddr.name}</div>
                    <div style={{ color: "var(--color-text-secondary)" }}>{billingAddr.addressLine1}</div>
                    <div style={{ color: "var(--color-text-secondary)" }}>
                      {billingAddr.city}, {billingAddr.country}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--font-size-sm)" }}>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                    Payment Status
                  </div>
                  <div style={{ marginTop: "4px" }}>
                    <OrderPaymentBadge status={order.paymentStatus} size="md" />
                  </div>
                </div>

                {order.paymentId && (
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                      Payment Provider Reference
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "var(--font-size-xs)",
                        marginTop: "2px",
                        wordBreak: "break-all",
                      }}
                    >
                      {order.paymentId}
                    </div>
                  </div>
                )}

                {order.checkoutId && (
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                      Checkout Reference
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "var(--font-size-xs)",
                        marginTop: "2px",
                        wordBreak: "break-all",
                      }}
                    >
                      {order.checkoutId}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: "var(--color-bg)",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Payments are verified with backend HMAC signatures and encrypted test credentials.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fulfillment Pipeline Card */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle>Fulfillment Pipeline</CardTitle>
                <Badge
                  variant={order.fulfillmentStatus === "FULFILLED" ? "success" : "neutral"}
                  size="sm"
                >
                  {order.fulfillmentStatus === "FULFILLED" ? "Fulfilled" : "Pending"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--font-size-sm)" }}>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                    Fulfillment Status
                  </div>
                  <div style={{ marginTop: "4px" }}>
                    <OrderFulfillmentBadge status={order.fulfillmentStatus} size="md" />
                  </div>
                </div>

                {latestFulfillmentHistory?.reason && (
                  <div
                    style={{
                      backgroundColor: "var(--color-bg)",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "2px" }}>
                      Dispatch & Tracking:
                    </div>
                    <div>{latestFulfillmentHistory.reason}</div>
                  </div>
                )}

                {isFulfillable && onOpenFulfill && (
                  <div style={{ marginTop: "var(--space-1)" }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={onOpenFulfill}
                      style={{ width: "100%" }}
                    >
                      Fulfill Items Now
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
