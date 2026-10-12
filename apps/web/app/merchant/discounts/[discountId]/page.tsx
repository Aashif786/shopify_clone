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
          Please select an active store to manage discounts.
        </Alert>
      ) : isLoading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-12, 48px)",
            gap: "var(--space-3, 12px)",
          }}
        >
          <Spinner size="lg" label="Loading discount details..." />
          <span style={{ color: "var(--color-text-secondary, #666)" }}>Loading discount details...</span>
        </div>
      ) : error ? (
        <Alert variant="danger" title="Failed to Load Discount">
          {error.message || "Discount could not be found or loaded."}
        </Alert>
      ) : discount ? (
        <DiscountForm
          storeId={activeStore.id}
          initialDiscount={discount}
          onSuccess={() => router.push("/merchant/discounts")}
          onCancel={() => router.push("/merchant/discounts")}
        />
      ) : (
        <Alert variant="warning" title="Not Found">
          Discount not found.
        </Alert>
      )}
    </MerchantShell>
  );
}
