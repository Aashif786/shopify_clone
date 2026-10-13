"use client";

import React from "react";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { StoreForm } from "../../../../src/components/merchant/stores/store-form";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";

export default function NewStorePage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      activePath="/merchant/stores"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={activeStore?.role ?? "owner"}
      onLogout={logout}
      title="Create Merchant Store"
      subtitle="Provision a new store with isolated product catalog, inventory, and currency settings."
    >
      <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Navigation Breadcrumb */}
        <div>
          <a
            href="/merchant/stores"
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ← Back to Stores
          </a>
        </div>

        {/* Store Creation Form */}
        <StoreForm
          onCancel={() => {
            window.location.href = "/merchant/stores";
          }}
        />
      </div>
    </MerchantShell>
  );
}
