import { ProductService } from "@calcart/products";
import { TaxService } from "@calcart/tax";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  setProductTaxProfileValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const productService = new ProductService();
const taxService = new TaxService();

interface RouteContext {
  params: Promise<{ storeId: string; productId: string }>;
}

/**
 * Confirms through the products module that the product belongs to this
 * store, so the tax module never has to read another module's tables.
 */
async function assertProductInStore(
  ctx: Awaited<ReturnType<typeof resolveRequestContext>>,
  storeId: string,
  productId: string,
) {
  await productService.getProductById(ctx.db, storeId, productId);
}

/** The product's HSN/SAC code and GST rate, or null if none is set. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, productId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(productId, "productId");

    await requireStoreOrNotFound(ctx, storeId, "staff");
    await assertProductInStore(ctx, storeId, productId);

    const profile = await taxService.getProductProfile(ctx.db, storeId, productId);
    return apiSuccess({ productId, profile }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, productId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(productId, "productId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }
    await assertProductInStore(ctx, storeId, productId);

    const body = await validateBody(req, setProductTaxProfileValidator);
    const profile = await taxService.setProductProfile(
      ctx.db,
      storeId,
      productId,
      body,
    );
    return apiSuccess({ productId, profile }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, productId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(productId, "productId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }
    await assertProductInStore(ctx, storeId, productId);

    const removed = await taxService.deleteProductProfile(ctx.db, storeId, productId);
    return apiSuccess({ productId, removed }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
