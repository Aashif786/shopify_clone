"use client";

import React from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";

export default function MerchantInventoryPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      activePath="/merchant/inventory"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Inventory Management"
      subtitle="Variant stock allocations, checkout reservations, and multi-location stock adjustments"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div>
                <CardTitle>Inventory & Stock Control</CardTitle>
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  Concurrency-safe stock allocation engine • Merchant UI scheduled for Milestone C
                </p>
              </div>
              <Badge variant="neutral" size="sm">
                Planned for Milestone C
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p style={{ color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6, fontSize: "var(--font-size-sm)" }}>
              Inventory allocation, stock reservation expiration, and concurrent stock deduction are strictly managed
              server-side by the <code>inventory</code> module with PostgreSQL row-level locks (<code>FOR UPDATE</code>).
              Multi-location stock adjustment tables and live variant stock level UI are scheduled for Milestone C.
            </p>

            <div style={{ marginTop: "var(--space-6)", padding: "var(--space-5)", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
                Verified Backend Capabilities:
              </div>
              <ul className="verified-backend-list">
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>PostgreSQL Schema:</strong> Tables <code>inventory_items</code>, <code>inventory_levels</code>, and <code>inventory_reservations</code> store authoritative quantities.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Concurrency Protection:</strong> High-concurrency checkout purchases tested without overselling or race conditions.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Reservation Release Worker:</strong> Abandoned or expired checkouts automatically return stock to available inventory.</div>
                </li>
                <li className="verified-backend-item">
                  <span className="verified-backend-check">✓</span>
                  <div><strong>Audit History & Adjustments:</strong> <code>/api/v1/stores/[storeId]/inventory/[variantId]/adjust</code> and history tracking endpoints ready for UI connection.</div>
                </li>
              </ul>
            </div>

            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <a href="/merchant/products" className="btn btn-primary btn-sm">
                Manage Products & Variants →
              </a>
              <a href="/merchant" className="btn btn-outline btn-sm">
                ← Return to Dashboard
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </MerchantShell>
  );
}
