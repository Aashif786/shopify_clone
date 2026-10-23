"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { DiscountList } from "../../../src/components/merchant/discounts/discount-list";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import type { MerchantDiscountDTO } from "../../../src/lib/merchant-discount-helpers";

export default function MerchantDiscountsPage() {
  const { user, logout } = useAuth();
  const {
    activeStore,
    stores,
    isLoading: isStoreLoading,
    selectStore,
  } = useStore();

  const [discounts, setDiscounts] = useState<MerchantDiscountDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const fetchDiscounts = useCallback(async () => {
    if (!activeStore) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get<{ items: MerchantDiscountDTO[]; total: number }>(
        `/api/v1/stores/${activeStore.id}/discounts`,
        {
          storeId: activeStore.id,
        }
      );
      setDiscounts(res.items);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "FETCH_FAILED",
              message: "Failed to fetch discounts",
              status: 500,
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStore]);

  useEffect(() => {
    if (activeStore) {
      fetchDiscounts();
    } else if (!isStoreLoading) {
      setIsLoading(false);
      setDiscounts([]);
    }
  }, [activeStore, isStoreLoading, fetchDiscounts]);

  const handleDiscountUpdated = (updated: MerchantDiscountDTO) => {
    setDiscounts((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d))
    );
  };

  return (
    <MerchantShell
      title="Discounts"
      activePath="/merchant/discounts"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name}
      userEmail={user?.email}
      userRole={activeStore?.role ?? "staff"}
      onLogout={logout}
    >
      <div
        className="merchant-page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-6, 24px)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-2xl, 24px)",
              fontWeight: 700,
              margin: 0,
              color: "var(--color-text-primary)",
            }}
          >
            Discounts
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm, 14px)",
              color: "var(--color-text-secondary)",
              margin: "var(--space-1, 4px) 0 0 0",
            }}
          >
            Manage promotional discount codes and coupon rules for your store.
          </p>
        </div>

        {activeStore && (
          <Link
            href="/merchant/discounts/new"
            className="btn btn--primary btn--md"
            data-testid="create-discount-button"
          >
            Create Discount
          </Link>
        )}
      </div>

      <DiscountList
        discounts={discounts}
        storeId={activeStore?.id ?? ""}
        isLoading={isLoading || isStoreLoading}
        error={error}
        onRetry={fetchDiscounts}
        onDiscountUpdated={handleDiscountUpdated}
      />
    </MerchantShell>
  );
}
