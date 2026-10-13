"use client";

import React from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";

export default function MerchantCustomersPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      activePath="/merchant/customers"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Customers Management"
      subtitle="Customer accounts, shipping addresses, purchase histories, and merchant segmentation"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div>
                <CardTitle>Customer Directory & Profiles</CardTitle>
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  Customer domain active in PostgreSQL • Directory UI scheduled for Milestone C
                </p>
              </div>
              <Badge variant="neutral" size="sm">
                Planned for Milestone C
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p style={{ color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6, fontSize: "var(--font-size-sm)" }}>
              The customer domain service, address management, and tenant-scoped identity records are operational in PostgreSQL.
              Merchant customer listing, order history association, and customer profile management UI will be introduced in Milestone C.
            </p>

            <div style={{ marginTop: "var(--space-6)", padding: "var(--space-5)", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
                Verified Backend Capabilities:
              </div>
              <ul className="verified-backend-list">
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Database Isolation:</strong> Relational tables <code>customers</code> and <code>customer_addresses</code> partitioned by <code>store_id</code>.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Email Uniqueness:</strong> Strictly enforced per store—customers can safely register across multiple stores without data bleed.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Account Status Control:</strong> <code>/api/v1/stores/[storeId]/customers/[customerId]/enable</code> and <code>/disable</code> endpoints operational.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Address Book:</strong> Sub-resource routes for shipping and billing address management verified.</div>
                </li>
              </ul>
            </div>

            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <a href="/merchant" className="btn btn-outline btn-sm">
                ← Return to Dashboard
              </a>
              <a href="/merchant/products" className="btn btn-primary btn-sm">
                View Store Products →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </MerchantShell>
  );
}
