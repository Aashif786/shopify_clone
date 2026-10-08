import { CustomerService } from "@shopify-clone/customers";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateCustomerAddressValidator,
  validateBody,
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

export async function GET(req: Request, context: RouteContext) {
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

    await requireStoreOrNotFound(ctx, storeId, "staff");
    const address = await customerService.getAddressById(
      ctx.db,
      storeId,
      customerId,
      addressId,
    );

    return apiSuccess(address, { requestId });
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

    const body = await validateBody(req, updateCustomerAddressValidator);
    const updated = await customerService.updateAddress(
      ctx.db,
      storeId,
      customerId,
      addressId,
      body,
    );

    return apiSuccess(updated, { requestId });
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

    await customerService.deleteAddress(
      ctx.db,
      storeId,
      customerId,
      addressId,
    );

    return apiSuccess({ deleted: true }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
