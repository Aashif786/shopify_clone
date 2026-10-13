"use client";

import React from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";

export default function MerchantSettingsPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      activePath="/merchant/settings"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Store Settings"
      subtitle="Store configuration, default currency, locale, and tenant metadata"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {activeStore && (
          <Card>
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <div>
                  <CardTitle>Current Store Configuration</CardTitle>
                  <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                    Authoritative PostgreSQL records for <strong>{activeStore.name}</strong>
                  </p>
                </div>
                <Badge variant="success" size="sm">Active Store</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "var(--space-4)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <div style={{ padding: "var(--space-3)", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Store Name</div>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginTop: "2px" }}>{activeStore.name}</div>
                </div>

                <div style={{ padding: "var(--space-3)", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Slug & URL Handle</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)", marginTop: "2px" }}>{activeStore.slug}</div>
                </div>

                <div style={{ padding: "var(--space-3)", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Primary Currency</div>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginTop: "2px" }}>{activeStore.currency || "USD"}</div>
                </div>

                <div style={{ padding: "var(--space-3)", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Store Identifier</div>
                  <code style={{ fontSize: "11px", marginTop: "2px", display: "block" }}>{activeStore.id}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div>
                <CardTitle>Merchant Self-Service Configuration</CardTitle>
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  Store lifecycle controls, contact information, and currency updates
                </p>
              </div>
              <Badge variant="neutral" size="sm">
                Planned for Milestone B
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p style={{ color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6, fontSize: "var(--font-size-sm)" }}>
              Store configuration, contact information, and store lifecycle state transitions (Active, Suspended, Archived)
              are fully supported by backend APIs (<code>PATCH /api/v1/stores/[storeId]</code>, <code>/suspend</code>, <code>/reactivate</code>, <code>/archive</code>).
              Merchant self-service editing forms will be connected in Milestone B.
            </p>
            <div style={{ marginTop: "var(--space-6)" }}>
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
