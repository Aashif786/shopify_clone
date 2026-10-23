"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  EmptyState,
  Spinner,
} from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { InventoryHistoryDialog } from "../../../src/components/merchant/inventory/inventory-history-dialog";
import { InventoryTable } from "../../../src/components/merchant/inventory/inventory-table";
import { StockAdjustmentDialog } from "../../../src/components/merchant/inventory/stock-adjustment-dialog";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../src/lib/api-client";
import {
  type InventoryVariantItem,
} from "../../../src/lib/merchant-inventory-helpers";

export default function MerchantInventoryPage() {
  const { user, logout } = useAuth();
  const {
    activeStore,
    stores,
    selectStore,
    isLoading: isStoreLoading,
  } = useStore();

  const [inventoryItems, setInventoryItems] = useState<InventoryVariantItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedForAdjustment, setSelectedForAdjustment] = useState<InventoryVariantItem | null>(null);
  const [selectedForHistory, setSelectedForHistory] = useState<InventoryVariantItem | null>(null);

  const userRole = activeStore?.role || "owner";

  const loadStoreInventory = useCallback(async (storeId: string) => {
    setIsLoadingInventory(true);
    setFetchError(null);
    setSuccessMessage(null);

    try {
      // Fetch authoritative store inventory items directly from backend
      const res = await apiClient.get<{ items: InventoryVariantItem[] }>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/inventory`,
      );
      setInventoryItems(res.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setFetchError(err.message || "Failed to load store inventory.");
      } else {
        setFetchError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred loading inventory data.",
        );
      }
      setInventoryItems([]);
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    if (activeStore?.id) {
      loadStoreInventory(activeStore.id);
    } else {
      setInventoryItems([]);
      setFetchError(null);
    }
  }, [activeStore?.id, loadStoreInventory]);

  const handleAdjustmentSuccess = (updatedItem: InventoryVariantItem) => {
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.variantId === updatedItem.variantId ? updatedItem : item,
      ),
    );
    setSuccessMessage(
      `Successfully adjusted stock for "${updatedItem.productTitle} — ${updatedItem.variantTitle}". Available units: ${updatedItem.availableQuantity}.`,
    );
  };

  return (
    <MerchantShell
      activePath="/merchant/inventory"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={userRole}
      onLogout={logout}
      title="Inventory Management"
      subtitle="Authoritative on-hand stock, checkout reservations, and movement audits"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Success Alert */}
        {successMessage && (
          <Alert variant="success" title="Inventory Updated">
            {successMessage}
          </Alert>
        )}

        {/* Loading state */}
        {(isStoreLoading || (activeStore && isLoadingInventory && inventoryItems.length === 0)) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "260px",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <Spinner size="lg" label="Loading store inventory..." />
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              Loading authoritative inventory levels...
            </span>
          </div>
        )}

        {/* Empty state: No active store */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store or create a new store to manage inventory."
            action={
              <a href="/merchant/stores/new" className="btn btn-primary">
                Create New Store
              </a>
            }
          />
        )}

        {/* Fetch Error state */}
        {!isLoadingInventory && fetchError && activeStore && (
          <Alert
            variant="danger"
            title="Failed to Load Inventory"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadStoreInventory(activeStore.id)}
              >
                Retry
              </Button>
            }
          >
            {fetchError}
          </Alert>
        )}

        {/* Empty state: No products in active store */}
        {!isLoadingInventory && !fetchError && activeStore && inventoryItems.length === 0 && (
          <EmptyState
            title="No Products or Variants Found"
            description="You need to create products and variants before managing stock levels and inventory reservations."
            action={
              <a href="/merchant/products/new" className="btn btn-primary">
                + Create First Product
              </a>
            }
          />
        )}

        {/* Main Inventory Table */}
        {activeStore && !fetchError && inventoryItems.length > 0 && (
          <InventoryTable
            items={inventoryItems}
            onAdjustStock={(item) => setSelectedForAdjustment(item)}
            onViewHistory={(item) => setSelectedForHistory(item)}
            canManage={true}
          />
        )}
      </div>

      {/* Stock Adjustment Dialog */}
      {activeStore && (
        <StockAdjustmentDialog
          storeId={activeStore.id}
          variantItem={selectedForAdjustment}
          isOpen={Boolean(selectedForAdjustment)}
          onClose={() => setSelectedForAdjustment(null)}
          onSuccess={handleAdjustmentSuccess}
        />
      )}

      {/* Inventory Audit History Dialog */}
      {activeStore && (
        <InventoryHistoryDialog
          storeId={activeStore.id}
          variantItem={selectedForHistory}
          isOpen={Boolean(selectedForHistory)}
          onClose={() => setSelectedForHistory(null)}
        />
      )}
    </MerchantShell>
  );
}
