import { CustomerService } from "@shopify-clone/customers";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateCustomerValidator,
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
    const customer = await customerService.getCustomerWithAddresses(
      ctx.db,
      storeId,
      customerId,
    );

    return apiSuccess(customer, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
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

    const body = await validateBody(req, updateCustomerValidator);
    const updated = await customerService.updateCustomer(
      ctx.db,
      storeId,
      customerId,
      body,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
