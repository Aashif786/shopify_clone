"use client";

import React from "react";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { DeveloperSettingsView } from "../../../src/components/merchant/developer/developer-settings-view";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { Spinner, Button } from "@calcart/ui";
import Link from "next/link";

export default function MerchantDeveloperPage() {
  const { user, logout } = useAuth();
  const {
    activeStore,
    stores,
    selectStore,
    isLoading: isStoreLoading,
  } = useStore();

  const userRole = activeStore?.role || "owner";

  return (
    <MerchantShell
      activePath="/merchant/developer"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={userRole}
      onLogout={logout}
      title="API & Webhooks"
      subtitle="Manage per-store bearer API keys, permission scopes, and outbound event webhook subscriptions"
    >
      <div className="space-y-6 w-full">
        {isStoreLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 bg-card rounded-xl border border-border/60 p-8">
            <Spinner size="lg" label="Loading store developer settings..." />
            <span className="text-xs font-medium text-muted-foreground animate-pulse">
              Loading developer settings...
            </span>
          </div>
        ) : !activeStore ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 bg-card rounded-xl border border-border/60 p-8 text-center">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">No Store Selected</h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                Please select or create a store to manage API keys and webhooks.
              </p>
            </div>
            <Link href="/merchant/stores/new">
              <Button size="sm">Create Store</Button>
            </Link>
          </div>
        ) : (
          <DeveloperSettingsView
            storeId={activeStore.id}
            storeSlug={activeStore.slug}
          />
        )}
      </div>
    </MerchantShell>
  );
}
