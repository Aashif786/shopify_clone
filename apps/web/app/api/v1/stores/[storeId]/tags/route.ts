import { ProductService } from "@calcart/products";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";

const productService = new ProductService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const tags = await productService.listTags(ctx.db, storeId);
    return apiSuccess({ items: tags }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
