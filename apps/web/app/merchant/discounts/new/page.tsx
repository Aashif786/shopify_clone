"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@shopify-clone/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { DiscountForm } from "../../../../src/components/merchant/discounts/discount-form";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { ArrowLeft } from "lucide-react";

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
      <div className="space-y-4">
        <div>
          <Link
            href="/merchant/discounts"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Discounts</span>
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
      </div>
    </MerchantShell>
  );
}
