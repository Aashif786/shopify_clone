import { StorePaymentGatewayService } from "@calcart/payments";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateStoreRazorpayValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const gatewayService = new StorePaymentGatewayService();

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
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const config = await gatewayService.getStoreRazorpayConfig(ctx.db, storeId);

    return apiSuccess(config, { requestId, status: 200 });
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
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Only store owners or admins can configure payment gateway credentials",
      );
    }

    const body = await validateBody(req, updateStoreRazorpayValidator);

    const saved = await gatewayService.saveStoreRazorpayConfig(ctx.db, storeId, {
      keyId: body.keyId,
      keySecret: body.keySecret,
      webhookSecret: body.webhookSecret,
      isEnabled: body.isEnabled,
    });

    return apiSuccess(saved, { requestId, status: 200 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
