import { PRODUCT_CSV_MAX_BYTES } from "@calcart/products";
import { ApiHttpError } from "./errors";

const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface ProductCsvRequestBody {
  csv: string;
  strategy?: "create" | "update" | "upsert";
  columnMap?: Record<string, string | null>;
}

export interface ProductCsvExportBody {
  scope: "all" | "filtered" | "selected";
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  search?: string;
  productIds?: string[];
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Content-Type must be application/json");
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "The CSV file exceeds the 5 MB limit.");
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "The CSV file exceeds the 5 MB limit.");
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiHttpError) throw error;
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Malformed JSON request body");
  }
}

export function readProductCsvBody(body: Record<string, unknown>): ProductCsvRequestBody {
  if (typeof body.csv !== "string" || body.csv.trim().length === 0) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Choose a CSV file to import.", {
      fields: { csv: "CSV content is required" },
    });
  }
  if (body.csv.length > PRODUCT_CSV_MAX_BYTES) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "The CSV file exceeds the 5 MB limit.");
  }
  let strategy: ProductCsvRequestBody["strategy"];
  if (body.strategy !== undefined) {
    if (body.strategy !== "create" && body.strategy !== "update" && body.strategy !== "upsert") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Import strategy must be create, update, or upsert.");
    }
    strategy = body.strategy;
  }
  return {
    csv: body.csv,
    strategy,
    columnMap: readColumnMap(body.columnMap),
  };
}

export function readProductCsvExportBody(body: Record<string, unknown>): ProductCsvExportBody {
  if (body.scope !== "all" && body.scope !== "filtered" && body.scope !== "selected") {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Choose what to export.");
  }
  let status: ProductCsvExportBody["status"];
  if (body.status !== undefined && body.status !== "") {
    if (body.status !== "ACTIVE" && body.status !== "DRAFT" && body.status !== "ARCHIVED") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Status must be active, draft, or archived.");
    }
    status = body.status;
  }
  const search = typeof body.search === "string" ? body.search : undefined;
  let productIds: string[] | undefined;
  if (body.productIds !== undefined) {
    if (!Array.isArray(body.productIds) || body.productIds.some((id) => typeof id !== "string")) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Selected products are invalid.");
    }
    productIds = body.productIds;
  }
  return { scope: body.scope, status, search, productIds };
}

function readColumnMap(value: unknown): Record<string, string | null> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Column mapping is invalid.");
  }
  const columnMap: Record<string, string | null> = {};
  for (const [key, target] of Object.entries(value)) {
    if (target === null || target === "") columnMap[key] = null;
    else if (typeof target === "string") columnMap[key] = target;
    else throw new ApiHttpError(400, "VALIDATION_ERROR", "Column mapping is invalid.");
  }
  return columnMap;
}

export function csvAttachment(csv: string, filename: string, headers: Record<string, string>): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
