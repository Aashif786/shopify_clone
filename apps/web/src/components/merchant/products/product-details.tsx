"use client";

import React from "react";
import type { ProductDetailDTO } from "@calcart/products";
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
  Badge,
} from "@calcart/ui";
import { hasRoleAtLeast } from "@calcart/tenant";
import { formatProductStatusBadge } from "./product-table";
import { ProductStatusActions } from "./product-status-actions";
import { 
  DollarSign, 
  Layers, 
  Calendar, 
  Edit,
  Info
} from "lucide-react";

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
    <div className="product-details-view space-y-6">
      {/* Header Summary & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-border/60 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
              {product.title}
            </h1>
            {formatProductStatusBadge(product.status)}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 m-0">
            <span>URL Handle:</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-medium">
              /{product.slug}
            </code>
          </p>
        </div>

        <div className="flex gap-2.5 items-center flex-wrap">
          {canEdit && onEditClick && (
            <Button variant="outline" size="sm" onClick={onEditClick} className="gap-1.5">
              <Edit className="w-3.5 h-3.5 mr-1" />
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Information & Description (2 cols on md) */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Description & Overview</CardTitle>
                  <CardDescription className="text-xs">Customer-facing product content</CardDescription>
                </div>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {product.description ? (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed m-0">
                  {product.description}
                </p>
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  No description provided for this product.
                </span>
              )}
            </CardContent>
          </Card>

          {/* Variants Table Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Variants ({product.variants.length})</CardTitle>
                  <CardDescription className="text-xs">All product variations and pricing entries</CardDescription>
                </div>
                <Layers className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            {product.options && product.options.length > 0 && (
              <div className="px-5 py-3 bg-muted/30 border-b border-border/60 flex flex-wrap gap-2.5 items-center">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Configured Options:
                </span>
                {product.options.map((opt) => (
                  <div
                    key={opt.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-card px-2.5 py-1 rounded-md border border-border/60"
                  >
                    <span className="font-semibold text-foreground">{opt.name}:</span>
                    <span className="text-muted-foreground">{opt.values.join(", ")}</span>
                    {opt.isPublishable && (
                      <Badge variant="info" className="text-[10px] px-1.5 py-0.5 ml-1 font-semibold">
                        Standalone Publishable
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            <CardContent className="p-0">
              <Table caption="Product Variants">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-xs">Variant Title</TableHead>
                    <TableHead className="font-semibold text-xs">SKU</TableHead>
                    <TableHead align="right" className="font-semibold text-xs">Price</TableHead>
                    <TableHead align="right" className="font-semibold text-xs">Compare-at</TableHead>
                    <TableHead align="center" className="font-semibold text-xs">Stock</TableHead>
                    <TableHead align="center" className="font-semibold text-xs">Low Stock</TableHead>
                    <TableHead align="center" className="font-semibold text-xs">Max Qty</TableHead>
                    <TableHead align="center" className="font-semibold text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.variants.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2.5">
                          {v.imageUrl && (
                            <img
                              src={v.imageUrl}
                              alt={v.title}
                              className="w-8 h-8 rounded-md object-cover border border-border/60 shrink-0 bg-muted"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <strong className="text-foreground">{v.title}</strong>
                              {v.displayTitle && (
                                <span className="text-xs text-muted-foreground italic">
                                  (&ldquo;{v.displayTitle}&rdquo;)
                                </span>
                              )}
                              {v.publishedAsProduct && (
                                <Badge variant="info" className="text-[10px] px-1.5 py-0.5 font-semibold uppercase">
                                  Standalone Listing
                                </Badge>
                              )}
                            </div>
                            {(v.option1 || v.option2 || v.option3) && (
                              <div className="flex items-center gap-1 mt-0.5">
                                {[v.option1, v.option2, v.option3].filter(Boolean).map((optVal, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border/50"
                                  >
                                    {optVal}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {v.sku || "—"}
                      </TableCell>
                      <TableCell align="right" className="font-semibold text-sm">
                        {formatPriceMinor(v.price, v.currency)}
                      </TableCell>
                      <TableCell align="right" className="text-xs text-muted-foreground">
                        {v.compareAtPrice
                          ? formatPriceMinor(v.compareAtPrice, v.currency)
                          : "—"}
                      </TableCell>
                      <TableCell align="center" className="text-xs font-mono">
                        {v.inventoryQuantity !== undefined && v.inventoryQuantity !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold ${
                              v.inventoryQuantity <= 0
                                ? "bg-rose-500/10 text-rose-500"
                                : v.inventoryQuantity <= (v.lowStockThreshold ?? product.lowStockThreshold ?? 5)
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-emerald-500/10 text-emerald-500"
                            }`}
                          >
                            {v.inventoryQuantity}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell align="center" className="text-xs">
                        {v.lowStockThreshold !== null
                          ? v.lowStockThreshold
                          : `${product.lowStockThreshold} (prod)`}
                      </TableCell>
                      <TableCell align="center" className="text-xs">
                        {v.maxOrderQuantity !== null
                          ? v.maxOrderQuantity
                          : product.maxOrderQuantity !== null
                            ? `${product.maxOrderQuantity} (prod)`
                            : "—"}
                      </TableCell>
                      <TableCell align="center">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            v.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {v.status.toLowerCase()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Pricing & Metadata (1 col on md) */}
        <div className="space-y-6">
          {/* Pricing & Primary Inventory */}
          {defaultVariant && (
            <Card>
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Pricing & SKU</CardTitle>
                    <CardDescription className="text-xs">Default variant selling parameters</CardDescription>
                  </div>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium block">
                    Price
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                    {formatPriceMinor(defaultVariant.price, defaultVariant.currency)}
                  </div>
                  {defaultVariant.compareAtPrice !== null && defaultVariant.compareAtPrice > 0 && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground font-medium">
                        Compare-at Price:
                      </span>
                      <span className="text-xs text-muted-foreground line-through font-mono">
                        {formatPriceMinor(defaultVariant.compareAtPrice, defaultVariant.currency)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-md border border-border/40 bg-card">
                    <span className="text-xs text-muted-foreground font-medium block">
                      SKU
                    </span>
                    <div className="text-xs font-mono font-semibold text-foreground mt-0.5 truncate">
                      {defaultVariant.sku || "None"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-md border border-border/40 bg-card">
                    <span className="text-xs text-muted-foreground font-medium block">
                      Currency
                    </span>
                    <div className="text-xs font-semibold text-foreground mt-0.5">
                      {defaultVariant.currency}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata & Timestamps Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Product Metadata</CardTitle>
                  <CardDescription className="text-xs">System identifiers and history</CardDescription>
                </div>
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs">
              <div>
                <strong className="text-muted-foreground font-medium block">Product ID:</strong>
                <div className="font-mono text-xs bg-muted/60 px-2 py-1 rounded mt-1 break-all select-all">
                  {product.id}
                </div>
              </div>
              <div className="border-t border-border/40 pt-2.5">
                <strong className="text-muted-foreground font-medium block">Published At:</strong>
                <div className="text-foreground mt-0.5 font-medium">
                  {product.publishedAt
                    ? new Date(product.publishedAt).toLocaleString()
                    : "Not published (Draft)"}
                </div>
              </div>
              <div className="border-t border-border/40 pt-2.5">
                <strong className="text-muted-foreground font-medium block">Created At:</strong>
                <div className="text-foreground mt-0.5 font-medium">
                  {new Date(product.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="border-t border-border/40 pt-2.5">
                <strong className="text-muted-foreground font-medium block">Last Updated:</strong>
                <div className="text-foreground mt-0.5 font-medium">
                  {new Date(product.updatedAt).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
