import type { Product, ProductVariant } from "./entities.js";
import {
  InvalidPriceError,
  ProductNotPublishableError,
} from "./errors.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function isValidSlugFormat(slug: string): boolean {
  if (!slug || slug.length < 1 || slug.length > 120) {
    return false;
  }
  return SLUG_PATTERN.test(slug);
}

export function validateProductTitle(title: unknown): string {
  if (typeof title !== "string") {
    throw new Error("Product title must be a string");
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error("Product title cannot be empty");
  }
  if (trimmed.length > 255) {
    throw new Error("Product title cannot exceed 255 characters");
  }
  return trimmed;
}

export function validatePrice(price: unknown): number {
  if (typeof price !== "number" || !Number.isInteger(price) || Number.isNaN(price)) {
    throw new InvalidPriceError("Price must be an integer minor units (e.g. cents)");
  }
  if (price < 0) {
    throw new InvalidPriceError("Price cannot be negative");
  }
  return price;
}

export function validateCompareAtPrice(
  compareAtPrice: unknown,
): number | null {
  if (compareAtPrice === null || compareAtPrice === undefined) {
    return null;
  }
  if (
    typeof compareAtPrice !== "number" ||
    !Number.isInteger(compareAtPrice) ||
    Number.isNaN(compareAtPrice)
  ) {
    throw new InvalidPriceError(
      "Compare-at price must be an integer minor units (e.g. cents)",
    );
  }
  if (compareAtPrice < 0) {
    throw new InvalidPriceError("Compare-at price cannot be negative");
  }
  return compareAtPrice;
}

export function validateSku(sku: unknown): string | null {
  if (sku === null || sku === undefined) {
    return null;
  }
  if (typeof sku !== "string") {
    throw new Error("SKU must be a string");
  }
  const trimmed = sku.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 100) {
    throw new Error("SKU cannot exceed 100 characters");
  }
  return trimmed;
}

export function validateProductPublishable(
  product: Product,
  variants: ProductVariant[],
): void {
  if (!product.title || product.title.trim().length === 0) {
    throw new ProductNotPublishableError(
      "Product cannot be published without a title",
    );
  }

  const activeVariants = variants.filter((v) => v.status === "ACTIVE");
  if (activeVariants.length === 0) {
    throw new ProductNotPublishableError(
      "Product cannot be published without at least one active variant",
    );
  }

  for (const variant of activeVariants) {
    if (variant.price < 0) {
      throw new ProductNotPublishableError(
        `Variant '${variant.title}' has an invalid price and cannot be published`,
      );
    }
  }
}
