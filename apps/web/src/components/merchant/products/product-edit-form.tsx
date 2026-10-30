"use client";

import React from "react";
import type { ProductDetailDTO } from "@calcart/products";
import { ProductForm } from "./product-form";

export interface VariantEditState {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  inventoryQuantity: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  imageId: string | null;
}

export interface ProductEditFormData {
  title: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  lowStockThreshold: string;
  maxOrderQuantity: string;
}

export interface ProductEditFormProps {
  product: ProductDetailDTO;
  storeId: string;
  onSuccess: (updatedProduct: ProductDetailDTO) => void;
  onCancel: () => void;
}

export function ProductEditForm({
  product,
  storeId,
  onSuccess,
  onCancel,
}: ProductEditFormProps) {
  return (
    <ProductForm
      storeId={storeId}
      initialProduct={product}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
