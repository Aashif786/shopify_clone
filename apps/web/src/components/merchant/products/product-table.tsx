"use client";

import React from "react";
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
        className="product-table-loading"
        role="status"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-12) var(--space-4)",
          gap: "var(--space-3)",
        }}
      >
        <Spinner size="lg" label="Loading products..." />
        <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
          Loading products...
        </span>
      </div>
    );
  }

  // Empty state
  if (!isLoading && products.length === 0) {
    return (
      <EmptyState
        title="No products found"
        description="Get started by adding your first product to this store."
        action={
          onCreateProduct ? (
            <Button variant="primary" size="md" onClick={onCreateProduct}>
              Add Product
            </Button>
          ) : (
            <a href="/merchant/products/new" className="btn btn--primary btn--md">
              Add Product
            </a>
          )
        }
      />
    );
  }

  return (
    <div className="product-table-wrapper">
      <Table caption="Store Products" aria-label="Products Table">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Status</TableHead>
            <TableHead align="center">Variants</TableHead>
            <TableHead align="center">Media</TableHead>
            <TableHead align="right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <strong
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {product.title}
                  </strong>
                  <span
                    style={{
                      color: "var(--color-text-muted)",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    /{product.slug}
                  </span>
                </div>
              </TableCell>
              <TableCell>{formatProductStatusBadge(product.status)}</TableCell>
              <TableCell align="center">
                <span style={{ fontSize: "var(--text-sm)" }}>
                  {product.variantsCount}
                </span>
              </TableCell>
              <TableCell align="center">
                <span style={{ fontSize: "var(--text-sm)" }}>
                  {product.mediaCount}
                </span>
              </TableCell>
              <TableCell align="right">
                <time
                  dateTime={product.createdAt}
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  {new Date(product.createdAt).toLocaleDateString()}
                </time>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination / Load more */}
      {hasMore && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "var(--space-4)",
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            loading={isLoadingMore}
          >
            {isLoadingMore ? "Loading more..." : "Load More Products"}
          </Button>
        </div>
      )}
    </div>
  );
}
