"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { InventoryItemDTO } from "@shopify-clone/inventory";
import type { ProductDetailDTO, ProductSummaryDTO } from "@shopify-clone/products";
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
      // 1. Fetch products list for the store
      const productsRes = await apiClient.get<{ items: ProductSummaryDTO[] }>(
        `/api/v1/stores/${storeId}/products`,
      );
      const productSummaries = productsRes.items || [];

      if (productSummaries.length === 0) {
        setInventoryItems([]);
        setIsLoadingInventory(false);
        return;
      }

      // 2. Fetch full product details (including variants)
      const productDetails = await Promise.all(
        productSummaries.map(async (p) => {
          try {
            return await apiClient.get<ProductDetailDTO>(
              `/api/v1/stores/${storeId}/products/${p.id}`,
            );
          } catch {
            return null;
          }
        }),
      );

      // 3. For each variant, load authoritative inventory item
      const rows: InventoryVariantItem[] = [];

      for (const prod of productDetails) {
        if (!prod || !prod.variants) continue;

        for (const variant of prod.variants) {
          let invDto: InventoryItemDTO | null = null;
          try {
            invDto = await apiClient.get<InventoryItemDTO>(
              `/api/v1/stores/${storeId}/inventory/${variant.id}`,
            );
          } catch {
            // 404 means uninitialized stock record, which is valid for newly created variants
            invDto = null;
          }

          rows.push({
            variantId: variant.id,
            productId: prod.id,
            productTitle: prod.title,
            productSlug: prod.slug,
            variantTitle: variant.title,
            sku: variant.sku ?? null,
            price: variant.price,
            currency: variant.currency || "USD",
            availableQuantity: invDto?.availableQuantity ?? 0,
            reservedQuantity: invDto?.reservedQuantity ?? 0,
            totalQuantity: invDto?.totalQuantity ?? 0,
            isInitialized: Boolean(invDto),
            inventoryItemId: invDto?.id ?? null,
          });
        }
      }

      setInventoryItems(rows);
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
