import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    return apiSuccess(
      {
        id: store.id,
        name: store.name,
        slug: store.slug,
        currency: store.currency,
        locale: store.locale,
        timezone: store.timezone,
        settings: store.settings
          ? {
              description: store.settings.description,
              contactEmail: store.settings.contactEmail,
              contactPhone: store.settings.contactPhone,
            }
          : null,
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
