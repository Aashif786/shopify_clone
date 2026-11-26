import { GarmentAssetService, inspectGlb } from "@calcart/products";
import { StoreTypeService } from "@calcart/stores";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import {
  GarmentStorageError,
  MAX_GARMENT_BYTES,
  removeGarmentFile,
  saveGarmentFile,
} from "@/lib/garment-storage";

const garmentService = new GarmentAssetService();
const storeTypeService = new StoreTypeService();

interface RouteContext {
  params: Promise<{ storeId: string; productId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;
    requireAuth(ctx);
    const { storeId, productId } = await Promise.resolve(context.params);
    await requireStoreOrNotFound(ctx, storeId);

    const assets = await garmentService.listForProduct(ctx.db, storeId, productId);
    const fitCheckActive = await storeTypeService.isFitCheckActive(ctx.db, storeId);
    return apiSuccess({ assets, fitCheckActive }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

function numberField(form: FormData, name: string): number {
  const raw = form.get(name);
  return typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^\x20-\x7e]/g, "").slice(0, 120);
  return cleaned || "garment.glb";
}

/** Uploads (or replaces) a GLB garment for the product, or for one variant when `variantId` is given. */
export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  let storedName: string | undefined;
  let storeIdForCleanup: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;
    requireAuth(ctx);
    const { storeId, productId } = await Promise.resolve(context.params);
    storeIdForCleanup = storeId;

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Operation requires at least admin role in this store");
    }
    if (!(await storeTypeService.isFitCheckActive(ctx.db, storeId))) {
      throw new ApiHttpError(
        403,
        "FIT_CHECK_NOT_ACTIVE",
        "Enable Fit Check for this store before uploading garments",
      );
    }

    const contentType = req.headers.get("content-type") || "";

    // Photo-driven garment: JSON body, no file. The storefront builds the 3D garment per customer.
    if (contentType.includes("application/json")) {
      const body = await parseJsonBody<{
        variantId?: unknown;
        template?: unknown;
        fit?: unknown;
        textureMediaId?: unknown;
      }>(req);
      const result = await garmentService.saveGeneratedAsset(ctx.db, storeId, productId, {
        variantId: typeof body?.variantId === "string" && body.variantId ? body.variantId : null,
        template: (typeof body?.template === "string" ? body.template : "") as never,
        fit: (typeof body?.fit === "string" ? body.fit : "") as never,
        textureMediaId:
          typeof body?.textureMediaId === "string" && body.textureMediaId ? body.textureMediaId : null,
      });
      await removeGarmentFile(storeId, result.replacedFileName);
      return apiSuccess({ asset: result.asset }, { status: 201, requestId });
    }

    if (!contentType.includes("multipart/form-data")) {
      throw new ApiHttpError(
        400,
        "INVALID_CONTENT_TYPE",
        "Request must be multipart/form-data (3D model) or application/json (photo-driven garment)",
      );
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "A .glb file is required");
    }
    if (file.size > MAX_GARMENT_BYTES) {
      throw new ApiHttpError(400, "FILE_TOO_LARGE", "Garment models are limited to 15MB");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    inspectGlb(buffer); // throws InvalidGarmentAssetError (400) unless this is a safe, self-contained GLB

    const variantRaw = form.get("variantId");
    const slotRaw = form.get("slot");
    const saved = await saveGarmentFile(storeId, buffer);
    storedName = saved.fileName;

    const result = await garmentService.saveAsset(ctx.db, storeId, productId, {
      variantId: typeof variantRaw === "string" && variantRaw ? variantRaw : null,
      slot: (typeof slotRaw === "string" ? slotRaw : "") as never,
      fileName: saved.fileName,
      originalName: safeName(file.name || "garment.glb"),
      fileSize: buffer.length,
      sha256: saved.sha256,
      reference: {
        heightCm: numberField(form, "referenceHeightCm"),
        chestCm: numberField(form, "referenceChestCm"),
        waistCm: numberField(form, "referenceWaistCm"),
        hipCm: numberField(form, "referenceHipCm"),
      },
    });
    storedName = undefined; // committed: keep the new file
    await removeGarmentFile(storeId, result.replacedFileName);

    return apiSuccess({ asset: result.asset }, { status: 201, requestId });
  } catch (error) {
    if (storedName && storeIdForCleanup) {
      await removeGarmentFile(storeIdForCleanup, storedName).catch(() => undefined);
    }
    if (error instanceof GarmentStorageError) {
      return handleApiError(new ApiHttpError(500, "UPLOAD_FAILED", error.message), requestId);
    }
    return handleApiError(error, requestId);
  }
}
