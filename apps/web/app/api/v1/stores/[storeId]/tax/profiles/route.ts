import { TaxService } from "@calcart/tax";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const taxService = new TaxService();

const MAX_PRODUCT_IDS = 100;

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

/**
 * Tax profiles for a set of products, in one query, so the merchant tax screen
 * can render a page of products without a request per row. Store-scoped, so an
 * id belonging to another store simply has no profile here.
 */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const raw = new URL(req.url).searchParams.get("productIds") ?? "";
    const productIds = [
      ...new Set(
        raw
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    ];
    if (productIds.length > MAX_PRODUCT_IDS) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        `productIds cannot contain more than ${MAX_PRODUCT_IDS} ids`,
      );
    }
    for (const id of productIds) {
      validateUuid(id, "productIds");
    }

    const profiles = await taxService.listProductProfiles(ctx.db, storeId, productIds);
    return apiSuccess({ profiles }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
