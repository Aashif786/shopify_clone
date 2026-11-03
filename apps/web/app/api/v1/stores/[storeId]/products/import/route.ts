import { createHash } from "node:crypto";
import {
  ProductCsvParseError,
  ProductCsvService,
  type ProductCsvStrategy,
} from "@calcart/products";
import { generateUuidV7, IdempotencyRepository, type Database } from "@calcart/db";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireIdempotencyKey,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import { ApiHttpError } from "@/lib/api/errors";
import { readJsonObject, readProductCsvBody } from "@/lib/api/product-csv-request";

const productCsv = new ProductCsvService();
const idempotency = new IdempotencyRepository();
const IMPORT_SCOPE = "product_csv_import";

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  let storeId = "";
  let idempotencyKey = "";
  let reserved = false;
  let database: Database | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    database = ctx.db;
    requestId = ctx.requestId;
    requireAuth(ctx);
    storeId = (await Promise.resolve(context.params)).storeId;
    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Importing products requires an admin role in this store.");
    }

    idempotencyKey = requireIdempotencyKey(req);
    const body = readProductCsvBody(await readJsonObject(req));
    if (!body.strategy) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Choose an import strategy.");
    }
    const requestHash = hashImport(body.csv, body.strategy, body.columnMap);
    const reservation = await idempotency.reserve(ctx.db, {
      id: generateUuidV7(),
      storeId,
      scope: IMPORT_SCOPE,
      idempotencyKey,
      requestHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    if (!reservation.reserved) {
      const record = reservation.record;
      if (record.request_hash !== requestHash) {
        throw new ApiHttpError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This import key was already used for a different file.",
        );
      }
      if (record.status === "COMPLETED") {
        return replay(record.response_status, record.response_body, requestId);
      }
      const ageMs = Date.now() - new Date(record.created_at).getTime();
      if (record.status === "IN_PROGRESS" && ageMs < 30 * 60 * 1000) {
        throw new ApiHttpError(409, "IMPORT_IN_PROGRESS", "This import is already running.");
      }
      await ctx.db.query(
        `UPDATE idempotency_records
         SET status = 'IN_PROGRESS', response_status = NULL, response_body = NULL
         WHERE store_id = $1 AND scope = $2 AND idempotency_key = $3`,
        [storeId, IMPORT_SCOPE, idempotencyKey],
      );
    }
    reserved = true;

    const result = await productCsv.execute(
      ctx.db,
      storeId,
      body.csv,
      body.strategy,
      body.columnMap,
    );
    if (!result.applied) {
      await idempotency.complete(
        ctx.db,
        storeId,
        IMPORT_SCOPE,
        idempotencyKey,
        422,
        { result: result as unknown as Record<string, unknown> },
      );
      reserved = false;
      return apiError(
        "CSV_VALIDATION_FAILED",
        "The CSV has blocking errors and was not imported.",
        422,
        { requestId, details: result },
      );
    }

    await idempotency.complete(
      ctx.db,
      storeId,
      IMPORT_SCOPE,
      idempotencyKey,
      200,
      { result: result as unknown as Record<string, unknown> },
    );
    reserved = false;
    return apiSuccess(result, { requestId });
  } catch (error) {
    if (reserved && database && storeId && idempotencyKey) {
      try {
        await idempotency.fail(database, storeId, IMPORT_SCOPE, idempotencyKey);
      } catch {
        // The original error is the one to report.
      }
    }
    if (error instanceof ProductCsvParseError) {
      return apiError("CSV_PARSE_ERROR", error.message, 400, { requestId });
    }
    return handleApiError(error, requestId);
  }
}

function hashImport(
  csv: string,
  strategy: ProductCsvStrategy,
  columnMap?: Record<string, string | null>,
): string {
  const mapping = columnMap
    ? Object.keys(columnMap)
        .sort()
        .map((key) => [key, columnMap[key] ?? null])
    : [];
  return createHash("sha256").update(JSON.stringify({ csv, strategy, mapping })).digest("hex");
}

function replay(status: number | null, body: unknown, requestId?: string): Response {
  const record = asRecord(body);
  const result = record?.result ?? record;
  if ((status ?? 200) >= 400) {
    return apiError(
      "CSV_VALIDATION_FAILED",
      "The CSV has blocking errors and was not imported.",
      status ?? 422,
      { requestId, details: result },
    );
  }
  return apiSuccess(result, { requestId });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
