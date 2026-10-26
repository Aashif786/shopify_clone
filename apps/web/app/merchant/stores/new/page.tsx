"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="pb-4 border-b border-border/60">
          <Link
            href="/merchant/stores"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group mb-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Stores</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Create Merchant Store
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Provision a new isolated store environment with separate catalog, inventory tracking, and payment processing
          </p>
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
