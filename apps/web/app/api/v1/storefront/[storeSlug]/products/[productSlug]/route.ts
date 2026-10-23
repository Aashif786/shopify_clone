import { InventoryService } from "@shopify-clone/inventory";
import { ProductService } from "@shopify-clone/products";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();
const productService = new ProductService();
const inventoryService = new InventoryService();

interface RouteContext {
  params: Promise<{ storeSlug: string; productSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, productSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!productSlug) {
      throw new ApiHttpError(400, "INVALID_PRODUCT_SLUG", "Product slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    // Resolve product strictly within the store
    const product = await productService.getProductBySlug(
      ctx.db,
      store.id,
      productSlug,
    );

    // Customer storefront visibility check: only ACTIVE (published) products are accessible
    if (product.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "PRODUCT_NOT_FOUND",
        "Product not found or unavailable",
      );
    }

    // Only expose active variants to customers
    const activeVariants = product.variants.filter((v) => v.status === "ACTIVE");
    const variantIds = activeVariants.map((v) => v.id);
    const availabilityMap = await inventoryService.getBatchAvailability(
      ctx.db,
      store.id,
      variantIds,
    );

    const enrichedVariants = activeVariants.map((v) => {
      const avail = availabilityMap.get(v.id);
      const availableQuantity = avail?.availableQuantity ?? 0;
      const effectiveThreshold =
        v.lowStockThreshold ?? product.lowStockThreshold ?? 5;
      const maxOrderQuantity =
        v.maxOrderQuantity ?? product.maxOrderQuantity ?? null;
      const isOutOfStock = availableQuantity <= 0;
      const isLowStock =
        !isOutOfStock && availableQuantity <= effectiveThreshold;
      const effectiveMaxQuantity = Math.max(
        0,
        maxOrderQuantity !== null
          ? Math.min(availableQuantity, maxOrderQuantity)
          : availableQuantity,
      );

      return {
        ...v,
        inventory: {
          availableQuantity,
          isLowStock,
          isOutOfStock,
          lowStockThreshold: effectiveThreshold,
          maxOrderQuantity,
          effectiveMaxQuantity,
        },
      };
    });

    const isAllOutOfStock =
      enrichedVariants.length === 0 ||
      enrichedVariants.every((v) => v.inventory.isOutOfStock);
    const hasLowStockVariant = enrichedVariants.some(
      (v) => v.inventory.isLowStock,
    );
    const totalAvailableQuantity = enrichedVariants.reduce(
      (sum, v) => sum + v.inventory.availableQuantity,
      0,
    );

    return apiSuccess(
      {
        product: {
          ...product,
          variants: enrichedVariants,
          inventory: {
            isOutOfStock: isAllOutOfStock,
            isLowStock: hasLowStockVariant,
            totalAvailableQuantity,
          },
        },
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
