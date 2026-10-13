"use client";

import React from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";

export default function MerchantOrdersPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      activePath="/merchant/orders"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Orders Management"
      subtitle="Track customer purchases, payment verification records, and fulfillment status"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div>
                <CardTitle>Orders & Fulfillment Pipeline</CardTitle>
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  Domain service operational in PostgreSQL • Merchant UI scheduled for Milestone C
                </p>
              </div>
              <Badge variant="neutral" size="sm">
                Planned for Milestone C
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p style={{ color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6, fontSize: "var(--font-size-sm)" }}>
              The end-to-end checkout and payment processing engine is active and validated against the live database.
              When customers complete checkout via Razorpay test mode, authoritative order records and order items are generated with ACID guarantees.
            </p>

            <div style={{ marginTop: "var(--space-6)", padding: "var(--space-5)", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
                Verified Backend Capabilities:
              </div>
              <ul className="verified-backend-list">
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Database Source of Truth:</strong> Relational tables <code>orders</code> and <code>order_items</code> persist snapshot pricing and address details.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Payment Capture & Orders Integration:</strong> <code>PaymentOrderIntegration</code> creates orders only after cryptographic HMAC validation.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Cancellation & Reservation Release:</strong> <code>/api/v1/stores/[storeId]/orders/[orderId]/cancel</code> idempotently cancels orders and releases reserved stock.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>API Contracts:</strong> <code>/api/v1/stores/[storeId]/orders</code> list and detail endpoints are implemented and protected by tenant guards.</div>
                </li>
              </ul>
            </div>

            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <a href="/merchant" className="btn btn-outline btn-sm">
                ← Return to Dashboard
              </a>
              {activeStore && (
                <a
                  href={`/stores/${encodeURIComponent(activeStore.slug)}/products`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Test Storefront Checkout ↗
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MerchantShell>
  );
}
