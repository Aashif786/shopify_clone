"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Spinner } from "@shopify-clone/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { DiscountForm } from "../../../../src/components/merchant/discounts/discount-form";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import type { MerchantDiscountDTO } from "../../../../src/lib/merchant-discount-helpers";
import { ArrowLeft } from "lucide-react";

interface EditDiscountPageProps {
  params: Promise<{ discountId: string }>;
}

export default function EditDiscountPage({ params }: EditDiscountPageProps) {
  const { discountId } = use(params);
  const router = useRouter();
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  const [discount, setDiscount] = useState<MerchantDiscountDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const fetchDiscount = useCallback(async () => {
    if (!activeStore || !discountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get<MerchantDiscountDTO>(
        `/api/v1/stores/${activeStore.id}/discounts/${discountId}`,
        {
          storeId: activeStore.id,
        }
      );
      setDiscount(res);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "FETCH_FAILED",
              message: "Failed to fetch discount details",
              status: 500,
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStore, discountId]);

  useEffect(() => {
    if (activeStore && discountId) {
      fetchDiscount();
    }
  }, [activeStore, discountId, fetchDiscount]);

  return (
    <MerchantShell
      title="Edit Discount"
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
            Please select an active store to manage discounts.
          </Alert>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="lg" label="Loading discount..." />
            <span className="text-xs text-muted-foreground font-medium">
              Loading discount details...
            </span>
          </div>
        ) : error ? (
          <Alert variant="danger" title="Error Loading Discount">
            {error.message || "An unexpected error occurred while loading this discount."}
          </Alert>
        ) : discount ? (
          <DiscountForm
            storeId={activeStore.id}
            initialDiscount={discount}
            onSuccess={() => router.push("/merchant/discounts")}
            onCancel={() => router.push("/merchant/discounts")}
          />
        ) : null}
      </div>
    </MerchantShell>
  );
}
