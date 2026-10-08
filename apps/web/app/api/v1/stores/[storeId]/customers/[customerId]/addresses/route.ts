import { CustomerService } from "@shopify-clone/customers";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  createCustomerAddressValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const customerService = new CustomerService();

interface RouteContext {
  params: Promise<{ storeId: string; customerId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, customerId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(customerId, "customerId");

    await requireStoreOrNotFound(ctx, storeId, "staff");
    const addresses = await customerService.listAddresses(
      ctx.db,
      storeId,
      customerId,
    );

    return apiSuccess({ items: addresses }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, customerId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(customerId, "customerId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, createCustomerAddressValidator);
    const created = await customerService.createAddress(
      ctx.db,
      storeId,
      customerId,
      body,
    );

    return apiSuccess(created, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
