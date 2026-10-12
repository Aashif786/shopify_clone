"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@shopify-clone/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { DiscountForm } from "../../../../src/components/merchant/discounts/discount-form";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";

export default function NewDiscountPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      title="Create Discount"
      activePath="/merchant/discounts"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name}
      userEmail={user?.email}
      userRole={activeStore?.role ?? "staff"}
      onLogout={logout}
    >
      <div style={{ marginBottom: "var(--space-4, 16px)" }}>
        <Link
          href="/merchant/discounts"
          style={{
            fontSize: "var(--text-sm, 14px)",
            color: "var(--color-primary, #008060)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1, 4px)",
          }}
        >
          ← Back to Discounts
        </Link>
      </div>

      {!activeStore ? (
        <Alert variant="warning" title="No Store Selected">
          Please select an active store to create discount codes.
        </Alert>
      ) : (
        <DiscountForm
          storeId={activeStore.id}
          onSuccess={() => router.push("/merchant/discounts")}
          onCancel={() => router.push("/merchant/discounts")}
        />
      )}
    </MerchantShell>
  );
}
