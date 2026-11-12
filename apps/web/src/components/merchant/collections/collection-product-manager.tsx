"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { CollectionProductItemDTO, ProductSummaryDTO } from "@calcart/products";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@calcart/ui";
import { apiClient } from "@/lib/api-client";

export interface CollectionProductManagerProps {
  storeId: string;
  collectionId: string;
  currency?: string;
  onProductCountChange?: (newCount: number) => void;
}

export function CollectionProductManager({
  storeId,
  collectionId,
  currency = "USD",
  onProductCountChange,
}: CollectionProductManagerProps) {
  const [items, setItems] = useState<CollectionProductItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reorder state
  const [isReordering, setIsReordering] = useState<boolean>(false);

  // Add Products Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [catalogProducts, setCatalogProducts] = useState<ProductSummaryDTO[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>("");
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);

  // Fetch assigned collection products
  const fetchAssignedProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        productIds: string[];
        items: CollectionProductItemDTO[];
      }>(`/api/v1/stores/${storeId}/collections/${collectionId}/products`, {
        storeId,
      });
      const loadedItems = res.items || [];
      setItems(loadedItems);
      if (onProductCountChange) {
        onProductCountChange(loadedItems.length);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load collection products",
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeId, collectionId, onProductCountChange]);

  useEffect(() => {
    fetchAssignedProducts();
  }, [fetchAssignedProducts]);

  // Fetch catalog products when modal opens or search changes
  const fetchCatalogProducts = useCallback(
    async (searchTerm: string) => {
      setIsCatalogLoading(true);
      try {
        const queryParams: Record<string, string | number> = {
          limit: 30,
        };
        if (searchTerm.trim()) {
          queryParams.search = searchTerm.trim();
        }
        const res = await apiClient.get<{
          items: ProductSummaryDTO[];
        }>(`/api/v1/stores/${storeId}/products`, {
          storeId,
          params: queryParams,
        });
        setCatalogProducts(res.items || []);
      } catch (err) {
        console.error("Failed to search store products:", err);
      } finally {
        setIsCatalogLoading(false);
      }
    },
    [storeId],
  );

  useEffect(() => {
    if (isAddModalOpen) {
      const timer = setTimeout(() => {
        fetchCatalogProducts(catalogSearch);
      }, 250);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAddModalOpen, catalogSearch, fetchCatalogProducts]);

  // Add a product to the collection
  const handleAddProduct = async (product: ProductSummaryDTO) => {
    setAddingProductId(product.id);
    try {
      await apiClient.post(
        `/api/v1/stores/${storeId}/collections/${collectionId}/products`,
        {
          productId: product.id,
          position: items.length,
        },
        { storeId },
      );
      await fetchAssignedProducts();
    } catch (err) {
      console.error("Failed to add product to collection:", err);
    } finally {
      setAddingProductId(null);
    }
  };

  // Remove a product from the collection
  const handleRemoveProduct = async (productId: string) => {
    setRemovingProductId(productId);
    try {
      await apiClient.delete(
        `/api/v1/stores/${storeId}/collections/${collectionId}/products/${productId}`,
        { storeId },
      );
      const updated = items.filter((p) => p.productId !== productId);
      setItems(updated);
      if (onProductCountChange) {
        onProductCountChange(updated.length);
      }
    } catch (err) {
      console.error("Failed to remove product from collection:", err);
    } finally {
      setRemovingProductId(null);
    }
  };

  // Move product position up or down
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex]!;
    newItems[targetIndex] = temp!;

    // Optimistic UI update
    setItems(newItems);
    setIsReordering(true);

    try {
      const productIds = newItems.map((item) => item.productId);
      await apiClient.put(
        `/api/v1/stores/${storeId}/collections/${collectionId}/products`,
        { productIds },
        { storeId },
      );
    } catch (err) {
      console.error("Failed to persist reordering:", err);
      // Revert on failure
      fetchAssignedProducts();
    } finally {
      setIsReordering(false);
    }
  };

  const assignedProductIds = new Set(items.map((i) => i.productId));

  const formatPrice = (centsStr: string | null) => {
    if (!centsStr) return "—";
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span>Collection Products</span>
            <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Products included in this collection. Arrange their order to control how they appear on the storefront.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            setCatalogSearch("");
            setIsAddModalOpen(true);
          }}
        >
          <Plus size={14} className="mr-1.5" />
          Add Products
        </Button>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert
            variant="danger"
            title="Failed to load products"
            className="mb-4"
            action={
              <Button variant="outline" size="sm" onClick={fetchAssignedProducts}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-6 h-6 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading assigned products...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center space-y-3 bg-muted/20 border border-dashed border-border rounded-xl">
            <div className="w-10 h-10 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Package size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">No products in this collection</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add products to group them together and showcase them on your storefront collection page.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCatalogSearch("");
                setIsAddModalOpen(true);
              }}
            >
              <Plus size={14} className="mr-1.5" />
              Add First Product
            </Button>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[10%] text-xs font-semibold text-center">Order</TableHead>
                  <TableHead className="w-[45%] text-xs font-semibold">Product</TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold">Price</TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.productId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs font-mono font-medium text-muted-foreground w-6 text-center">
                          #{index + 1}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0 || isReordering}
                            onClick={() => handleMove(index, "up")}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
                            title="Move up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={index === items.length - 1 || isReordering}
                            onClick={() => handleMove(index, "down")}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
                            title="Move down"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted border border-border/80 overflow-hidden relative shrink-0 flex items-center justify-center">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.title}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <Package size={16} className="text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate max-w-sm">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {item.sku ? `SKU: ${item.sku}` : `slug: ${item.slug}`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status === "ACTIVE" ? (
                        <Badge variant="success" size="sm">
                          Active
                        </Badge>
                      ) : item.status === "ARCHIVED" ? (
                        <Badge variant="warning" size="sm">
                          Archived
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-foreground">
                      {formatPrice(item.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={removingProductId === item.productId}
                        onClick={() => handleRemoveProduct(item.productId)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove from collection"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add Products Modal */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Products to Collection"
      >
        <div className="space-y-4 pt-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search products by title or SKU..."
              className="w-full h-9 pl-9 pr-8 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
            {catalogSearch && (
              <button
                type="button"
                onClick={() => setCatalogSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Product list */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-border/60">
            {isCatalogLoading ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-5 h-5 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-muted-foreground">Searching products...</p>
              </div>
            ) : catalogProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No products found.
              </div>
            ) : (
              catalogProducts.map((prod) => {
                const isAssigned = assignedProductIds.has(prod.id);
                return (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between gap-3 pt-2 pb-2 first:pt-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-muted border border-border/80 overflow-hidden relative shrink-0 flex items-center justify-center">
                        {prod.primaryMediaUrl ? (
                          <Image
                            src={prod.primaryMediaUrl}
                            alt={prod.title}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        ) : (
                          <Package size={14} className="text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate max-w-xs">
                          {prod.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                          {prod.sku && <span>{prod.sku}</span>}
                          {prod.price !== null && prod.price !== undefined && (
                            <span>
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: currency,
                              }).format(prod.price / 100)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isAssigned ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">
                          <Check size={12} />
                          Added
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          loading={addingProductId === prod.id}
                          onClick={() => handleAddProduct(prod)}
                          className="h-7 text-xs"
                        >
                          <Plus size={12} className="mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
