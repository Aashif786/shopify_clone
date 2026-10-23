"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { StoreDetailDTO } from "@shopify-clone/stores";
import {
  Alert,
  Button,
  EmptyState,
  Spinner,
} from "@shopify-clone/ui";
import { Plus, RefreshCw } from "lucide-react";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { StoreLifecycleCard } from "../../../src/components/merchant/settings/store-lifecycle-card";
import { StoreSettingsForm } from "../../../src/components/merchant/settings/store-settings-form";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../src/lib/api-client";

export default function MerchantSettingsPage() {
  const { user, logout } = useAuth();
  const {
    activeStore,
    stores,
    selectStore,
    refreshStores,
    isLoading: isStoreLoading,
  } = useStore();

  const [storeDetail, setStoreDetail] = useState<StoreDetailDTO | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadStoreDetail = useCallback(async (storeId: string) => {
    setIsLoadingDetail(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<StoreDetailDTO>(`/api/v1/stores/${storeId}`);
      setStoreDetail(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setFetchError(err.message || "Failed to load store details.");
      } else {
        setFetchError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading store settings.",
        );
      }
      setStoreDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (activeStore?.id) {
      loadStoreDetail(activeStore.id);
    } else {
      setStoreDetail(null);
      setFetchError(null);
    }
  }, [activeStore?.id, loadStoreDetail]);

  const handleSaveSuccess = async (updated: StoreDetailDTO) => {
    setStoreDetail(updated);
    await refreshStores(updated.id);
  };

  const handleStatusChange = async (updated: StoreDetailDTO) => {
    setStoreDetail(updated);
    await refreshStores(updated.id);
  };

  const userRole = activeStore?.role || "owner";

  return (
    <MerchantShell
      activePath="/merchant/settings"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={userRole}
      onLogout={logout}
      title="Store Settings"
      subtitle="Configure store profile, currency, regional settings, and operational lifecycle"
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Loading state */}
        {(isStoreLoading || (activeStore && isLoadingDetail && !storeDetail)) && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 bg-card rounded-xl border border-border/60 p-8">
            <Spinner size="lg" label="Loading store settings..." />
            <span className="text-xs font-medium text-muted-foreground animate-pulse">
              Loading store settings...
            </span>
          </div>
        )}

        {/* Empty state: No active store */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="You need to select an active store or create a new one before configuring store settings."
            action={
              <a href="/merchant/stores/new" className="btn btn-primary inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Create New Store
              </a>
            }
          />
        )}

        {/* Fetch Error state */}
        {!isLoadingDetail && fetchError && activeStore && (
          <Alert
            variant="danger"
            title="Failed to Load Store Details"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadStoreDetail(activeStore.id)}
                className="h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Retry
              </Button>
            }
          >
            {fetchError}
          </Alert>
        )}

        {/* Main Settings & Lifecycle Content */}
        {storeDetail && (
          <>
            <StoreSettingsForm
              store={storeDetail}
              userRole={userRole}
              onSaveSuccess={handleSaveSuccess}
            />

            <StoreLifecycleCard
              store={storeDetail}
              userRole={userRole}
              onStatusChange={handleStatusChange}
            />
          </>
        )}
      </div>
    </MerchantShell>
  );
}
