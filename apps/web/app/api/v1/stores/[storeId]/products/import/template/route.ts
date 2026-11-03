import { ProductCsvService } from "@calcart/products";
import {
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import { csvAttachment } from "@/lib/api/product-csv-request";

const productCsv = new ProductCsvService();

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
    return csvAttachment(productCsv.template(), "cal-cart-product-template.csv", {
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
