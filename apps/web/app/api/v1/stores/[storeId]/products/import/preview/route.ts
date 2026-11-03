import { ProductCsvParseError, ProductCsvService } from "@calcart/products";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import { hasRoleAtLeast } from "@calcart/tenant";
import { ApiHttpError } from "@/lib/api/errors";
import { readJsonObject, readProductCsvBody } from "@/lib/api/product-csv-request";

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
    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Importing products requires an admin role in this store.");
    }

    const body = readProductCsvBody(await readJsonObject(req));
    const preview = await productCsv.preview(ctx.db, storeId, body.csv, body.columnMap);
    return apiSuccess(preview, { requestId });
  } catch (error) {
    if (error instanceof ProductCsvParseError) {
      return apiError("CSV_PARSE_ERROR", error.message, 400, { requestId });
    }
    return handleApiError(error, requestId);
  }
}
