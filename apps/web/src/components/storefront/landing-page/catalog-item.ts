import type { ProductSummaryDTO } from "@calcart/products";

/**
 * Stable identity for a catalog row. Parent products use `id`; standalone
 * variant listings (same product id, distinct variantId) use the variant id
 * so they can be selected and rendered independently.
 */
export function catalogItemKey(product: ProductSummaryDTO): string {
  return product.variantId || product.id;
}

/**
 * Whether a catalog row belongs to a curated productIds / productId list.
 * Accepts both variant ids (new) and parent product ids (legacy saved configs).
 */
export function matchesCatalogSelection(
  product: ProductSummaryDTO,
  selectedIds: readonly string[],
): boolean {
  if (selectedIds.length === 0) return false;
  if (selectedIds.includes(catalogItemKey(product))) return true;
  if (selectedIds.includes(product.id)) return true;
  return false;
}

export function findCatalogItem(
  products: readonly ProductSummaryDTO[],
  selectedId: string | null | undefined,
): ProductSummaryDTO | undefined {
  if (!selectedId) return undefined;
  return (
    products.find((product) => catalogItemKey(product) === selectedId) ||
    products.find((product) => product.id === selectedId)
  );
}
