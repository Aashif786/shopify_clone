import { CustomerService } from "@shopify-clone/customers";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const customerService = new CustomerService();

interface RouteContext {
  params: Promise<{
    storeId: string;
    customerId: string;
    addressId: string;
  }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, customerId, addressId } = await Promise.resolve(
      context.params,
    );
    validateUuid(storeId, "storeId");
    validateUuid(customerId, "customerId");
    validateUuid(addressId, "addressId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const updated = await customerService.setDefaultAddress(
      ctx.db,
      storeId,
      customerId,
      addressId,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
