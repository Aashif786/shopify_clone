"use client";

import React from "react";
import type { ProductDetailDTO } from "@shopify-clone/products";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
} from "@shopify-clone/ui";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import { formatProductStatusBadge } from "./product-table";
import { ProductStatusActions } from "./product-status-actions";

export interface ProductDetailsProps {
  product: ProductDetailDTO;
  storeId: string;
  userRole?: "owner" | "admin" | "staff";
  onEditClick?: () => void;
  onProductUpdate: (updatedProduct: ProductDetailDTO) => void;
}

export function formatPriceMinor(amountMinor: number, currency: string = "USD"): string {
  const amountMajor = amountMinor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMajor);
}

export function ProductDetails({
  product,
  storeId,
  userRole = "staff",
  onEditClick,
  onProductUpdate,
}: ProductDetailsProps) {
  const canEdit = hasRoleAtLeast(userRole, "admin");
  const defaultVariant = product.variants[0];

  return (
    <div className="product-details-view" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Header Summary & Actions Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--font-bold)",
                color: "var(--color-text-primary)",
              }}
            >
              {product.title}
            </h1>
            {formatProductStatusBadge(product.status)}
          </div>
          <p
            style={{
              margin: "var(--space-1) 0 0 0",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            URL Handle: <code>/{product.slug}</code>
          </p>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          {canEdit && onEditClick && (
            <Button variant="outline" size="sm" onClick={onEditClick}>
              Edit Product
            </Button>
          )}
          <ProductStatusActions
            product={product}
            storeId={storeId}
            userRole={userRole}
            onStatusChange={onProductUpdate}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-6)" }}>
        {/* Basic Information & Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description & Overview</CardTitle>
            <CardDescription>Customer-facing product content</CardDescription>
          </CardHeader>
          <CardContent>
            {product.description ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                  whiteSpace: "pre-wrap",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {product.description}
              </p>
            ) : (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                No description provided for this product.
              </span>
            )}
          </CardContent>
        </Card>

        {/* Pricing & Primary Inventory */}
        {defaultVariant && (
          <Card>
            <CardHeader>
              <CardTitle>Pricing & SKU</CardTitle>
              <CardDescription>Default variant selling parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                    Price
                  </span>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: "var(--color-text-primary)" }}>
                    {formatPriceMinor(defaultVariant.price, defaultVariant.currency)}
                  </div>
                </div>

                {defaultVariant.compareAtPrice !== null && defaultVariant.compareAtPrice > 0 && (
                  <div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                      Compare-at Price
                    </span>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-muted)",
                        textDecoration: "line-through",
                      }}
                    >
                      {formatPriceMinor(defaultVariant.compareAtPrice, defaultVariant.currency)}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                  <div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                      SKU
                    </span>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>
                      {defaultVariant.sku || "None"}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                      Currency
                    </span>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>
                      {defaultVariant.currency}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Variants Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Variants ({product.variants.length})</CardTitle>
          <CardDescription>All product variations and pricing entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table caption="Product Variants">
            <TableHeader>
              <TableRow>
                <TableHead>Variant Title</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead align="right">Price</TableHead>
                <TableHead align="right">Compare-at</TableHead>
                <TableHead align="center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <strong>{v.title}</strong>
                  </TableCell>
                  <TableCell>{v.sku || "—"}</TableCell>
                  <TableCell align="right">
                    {formatPriceMinor(v.price, v.currency)}
                  </TableCell>
                  <TableCell align="right">
                    {v.compareAtPrice
                      ? formatPriceMinor(v.compareAtPrice, v.currency)
                      : "—"}
                  </TableCell>
                  <TableCell align="center">
                    <span style={{ fontSize: "var(--text-xs)", textTransform: "capitalize" }}>
                      {v.status.toLowerCase()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Metadata & Timestamps Card */}
      <Card>
        <CardHeader>
          <CardTitle>Product Metadata</CardTitle>
          <CardDescription>System identifiers and history</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-4)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-secondary)",
            }}
          >
            <div>
              <strong>Product ID:</strong>
              <div style={{ fontFamily: "monospace", marginTop: "var(--space-1)" }}>{product.id}</div>
            </div>
            <div>
              <strong>Published At:</strong>
              <div style={{ marginTop: "var(--space-1)" }}>
                {product.publishedAt
                  ? new Date(product.publishedAt).toLocaleString()
                  : "Not published (Draft)"}
              </div>
            </div>
            <div>
              <strong>Created At:</strong>
              <div style={{ marginTop: "var(--space-1)" }}>
                {new Date(product.createdAt).toLocaleString()}
              </div>
            </div>
            <div>
              <strong>Last Updated:</strong>
              <div style={{ marginTop: "var(--space-1)" }}>
                {new Date(product.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
