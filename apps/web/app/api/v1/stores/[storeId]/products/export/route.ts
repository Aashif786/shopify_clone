import { ProductCsvParseError, ProductCsvService } from "@calcart/products";
import {
  apiError,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import { csvAttachment, readJsonObject, readProductCsvExportBody } from "@/lib/api/product-csv-request";

const productCsv = new ProductCsvService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;
    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const body = readProductCsvExportBody(await readJsonObject(req));
    const result = await productCsv.exportCsv(ctx.db, storeId, body);
    return csvAttachment(result.csv, "cal-cart-products.csv", {
      "X-Export-Product-Count": String(result.productCount),
      "X-Export-Variant-Count": String(result.variantCount),
      "X-Export-Truncated": result.truncated ? "1" : "0",
      "X-Export-Skipped": String(result.skippedIds),
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    });
  } catch (error) {
    if (error instanceof ProductCsvParseError) {
      return apiError("CSV_EXPORT_ERROR", error.message, 400, { requestId });
    }
    return handleApiError(error, requestId);
  }
}
