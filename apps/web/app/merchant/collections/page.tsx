"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { CollectionDTO } from "@calcart/products";
import { Button } from "@calcart/ui";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { PageHeader } from "@/components/merchant/ui";
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
      <div className="mt-page">
        <PageHeader
          title="Collections"
          description="Group products for launches, catalogs and featured selections"
          actions={
            <Link href="/merchant/collections/new">
              <Button variant="primary" size="sm">
                <Plus size={14} className="mr-1.5" />
                Create collection
              </Button>
            </Link>
          }
        />

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
