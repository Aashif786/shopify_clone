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
    >
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <CardTitle>Orders & Fulfillment</CardTitle>
            <Badge variant="neutral" size="sm">
              Planned for V1
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p style={{ color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6 }}>
            The order processing and payment capture pipeline is fully active in the backend core (Razorpay integration,
            inventory reservation releases, and cancellation workflows). Full merchant-side order administration and fulfillment UI
            is scheduled for the next release.
          </p>
          <div style={{ marginTop: "var(--space-6)" }}>
            <a href="/merchant" className="btn btn-outline btn-sm">
              ← Return to Dashboard
            </a>
          </div>
        </CardContent>
      </Card>
    </MerchantShell>
  );
}
