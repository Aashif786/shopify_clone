import { ProductService } from "@calcart/products";
import { ShippingService } from "@calcart/shipping";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  setProductWeightValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const productService = new ProductService();
const shippingService = new ShippingService();

interface RouteContext {
  params: Promise<{ storeId: string; productId: string }>;
}

/**
 * Confirms through the products module that the product belongs to this store,
 * so the shipping module never reads another module's tables.
 */
async function assertProductInStore(
  ctx: Awaited<ReturnType<typeof resolveRequestContext>>,
  storeId: string,
  productId: string,
) {
  await productService.getProductById(ctx.db, storeId, productId);
}

function requireAdmin(role: Parameters<typeof hasRoleAtLeast>[0]) {
  if (!hasRoleAtLeast(role, "admin")) {
    throw new ApiHttpError(
      403,
      "FORBIDDEN",
      "Operation requires at least admin role in this store",
    );
  }
}

/** The product's unit weight, or null when it uses the store default. */
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

    const profile = await shippingService.getProductProfile(ctx.db, storeId, productId);
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
    requireAdmin(member.role);
    await assertProductInStore(ctx, storeId, productId);

    const body = await validateBody(req, setProductWeightValidator);
    const profile = await shippingService.setProductWeight(
      ctx.db,
      storeId,
      productId,
      body.weightGrams,
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
    requireAdmin(member.role);
    await assertProductInStore(ctx, storeId, productId);

    const removed = await shippingService.deleteProductWeight(ctx.db, storeId, productId);
    return apiSuccess({ productId, removed }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
