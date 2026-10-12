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
    >
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <CardTitle>Store & Organization Settings</CardTitle>
            <Badge variant="neutral" size="sm">
              Planned for V1
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p style={{ color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6 }}>
            Store settings, locale configuration, and currency rules are persisted in the database via the stores module.
            Merchant-facing self-service configuration forms will be introduced in the next milestone.
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
