import { CollectionService } from "@shopify-clone/products";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();
const collectionService = new CollectionService();

interface RouteContext {
  params: Promise<{ storeSlug: string; collectionSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, collectionSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!collectionSlug) {
      throw new ApiHttpError(400, "INVALID_COLLECTION_SLUG", "Collection slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const collection = await collectionService.getCollectionBySlug(
      ctx.db,
      store.id,
      collectionSlug,
    );

    if (collection.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "COLLECTION_NOT_FOUND",
        "Collection is not available",
      );
    }

    return apiSuccess(
      {
        collection,
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
