"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import type { ProductSummaryDTO, ProductStatus } from "@shopify-clone/products";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  EmptyState,
  Alert,
  Spinner,
} from "@shopify-clone/ui";

export interface ProductTableProps {
  products: ProductSummaryDTO[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onCreateProduct?: () => void;
}

export function formatProductStatusBadge(status: ProductStatus) {
  switch (status) {
    case "ACTIVE":
      return <Badge variant="success" size="sm">Active</Badge>;
    case "ARCHIVED":
      return <Badge variant="warning" size="sm">Archived</Badge>;
    case "DRAFT":
    default:
      return <Badge variant="neutral" size="sm">Draft</Badge>;
  }
}

export function ProductTable({
  products,
  isLoading = false,
  error = null,
  onRetry,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onCreateProduct,
}: ProductTableProps) {
  // Error state
  if (error) {
    return (
      <div className="product-table-error" role="region" aria-label="Product list error">
        <Alert
          variant="danger"
          title="Failed to load products"
          action={
            onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {error.message || "An unexpected error occurred while fetching products."}
        </Alert>
      </div>
    );
  }

  // Initial loading state
  if (isLoading && products.length === 0) {
    return (
      <div
        className="product-table-loading flex flex-col items-center justify-center py-20 px-4 gap-3 text-center"
        role="status"
      >
        <Spinner size="lg" label="Loading products..." />
        <span className="text-xs text-muted-foreground font-medium animate-pulse">
          Loading products...
        </span>
      </div>
    );
  }

  // Empty state
  if (!isLoading && products.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-muted/20 text-center">
        <EmptyState
          title="No products found"
          description="Get started by adding your first product to this store."
          action={
            onCreateProduct ? (
              <Button variant="primary" size="md" onClick={onCreateProduct}>
                Add Product
              </Button>
            ) : (
              <a href="/merchant/products/new" className="btn btn--primary btn--md inline-flex items-center gap-1.5">
                Add Product
              </a>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="product-table-wrapper rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md overflow-hidden shadow-xs">
      <Table aria-label="Products Table">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3">Product</TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3">Status</TableHead>
            <TableHead align="center" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3">Variants</TableHead>
            <TableHead align="center" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3">Media</TableHead>
            <TableHead align="right" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3">Created</TableHead>
            <TableHead align="right" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className="hover:bg-muted/30 transition-colors group">
              <TableCell className="py-3">
                <Link
                  href={`/merchant/products/${encodeURIComponent(product.id)}`}
                  className="flex items-center gap-3 text-left no-underline group-hover:text-primary transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/60 overflow-hidden">
                    {product.primaryMediaUrl ? (
                      <img
                        src={product.primaryMediaUrl}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary truncate">
                        {product.title}
                      </strong>
                      {product.typeName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                          {product.typeName}
                        </span>
                      )}
                      {product.categoryName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-medium">
                          {product.categoryName}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground truncate">
                      /{product.slug}
                    </span>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="py-3">{formatProductStatusBadge(product.status)}</TableCell>
              <TableCell align="center" className="py-3">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/50">
                  {product.variantsCount}
                </span>
              </TableCell>
              <TableCell align="center" className="py-3">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/50">
                  {product.mediaCount}
                </span>
              </TableCell>
              <TableCell align="right" className="py-3">
                <time
                  dateTime={product.createdAt}
                  className="text-xs text-muted-foreground font-mono"
                >
                  {new Date(product.createdAt).toLocaleDateString()}
                </time>
              </TableCell>
              <TableCell align="right" className="py-3">
                <Link
                  href={`/merchant/products/${encodeURIComponent(product.id)}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <span>Edit</span>
                  <ChevronRight size={13} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination / Load more */}
      {hasMore && (
        <div className="p-4 border-t border-border/60 bg-muted/10 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            loading={isLoadingMore}
            className="text-xs font-semibold"
          >
            {isLoadingMore ? "Loading more..." : "Load More Products"}
          </Button>
        </div>
      )}
    </div>
  );
}
