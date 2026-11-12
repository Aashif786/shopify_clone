"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import type { CollectionDTO } from "@calcart/products";
import { Button } from "@calcart/ui";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { CollectionListTable } from "@/components/merchant/collections/collection-list-table";
import { useStore } from "@/context/store-context";
import { apiClient, ApiClientError } from "@/lib/api-client";

export default function MerchantCollectionsPage() {
  const { activeStore, isLoading: isStoreLoading } = useStore();

  const [collections, setCollections] = useState<CollectionDTO[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");

  const fetchCollections = useCallback(async () => {
    if (!activeStore) return;

    setIsLoading(true);
    setError(null);

    try {
      const queryParams: Record<string, string | number | undefined> = {
        limit: 100,
      };

      if (statusFilter !== "ALL") {
        queryParams.status = statusFilter;
      }

      if (searchTerm.trim()) {
        queryParams.search = searchTerm.trim();
      }

      const res = await apiClient.get<{
        items: CollectionDTO[];
        total: number;
      }>(`/api/v1/stores/${activeStore.id}/collections`, {
        storeId: activeStore.id,
        params: queryParams,
      });

      setCollections(res.items || []);
      setTotal(res.total ?? (res.items || []).length);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "FETCH_FAILED",
              message: "Failed to fetch collections",
              status: 500,
            }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStore, statusFilter, searchTerm]);

  useEffect(() => {
    if (activeStore) {
      const timer = setTimeout(() => {
        fetchCollections();
      }, 200);
      return () => clearTimeout(timer);
    } else if (!isStoreLoading) {
      setIsLoading(false);
      setCollections([]);
    }
    return undefined;
  }, [activeStore, isStoreLoading, fetchCollections]);

  const handleDeleteCollection = async (collectionId: string) => {
    if (!activeStore) return;
    await apiClient.delete(
      `/api/v1/stores/${activeStore.id}/collections/${collectionId}`,
      { storeId: activeStore.id },
    );
  };

  return (
    <MerchantShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              <span>Collections</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Group and organize your store products for seasonal launches, catalogs, or featured selections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/merchant/collections/new">
              <Button variant="primary" size="sm">
                <Plus size={14} className="mr-1.5" />
                Create Collection
              </Button>
            </Link>
          </div>
        </div>

        {/* Collections Table */}
        <CollectionListTable
          collections={collections}
          total={total}
          storeSlug={activeStore?.slug || ""}
          storeId={activeStore?.id || ""}
          isLoading={isLoading}
          error={error}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          onSearchChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onDeleteCollection={handleDeleteCollection}
          onRefresh={fetchCollections}
        />
      </div>
    </MerchantShell>
  );
}
