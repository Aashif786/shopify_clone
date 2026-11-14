import { CustomerService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();
const customerService = new CustomerService();

interface RouteContext {
  params: Promise<{
    storeSlug: string;
    addressId: string;
  }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeSlug, addressId } = await Promise.resolve(context.params);
    validateUuid(addressId, "addressId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      auth.user.id,
    );

    if (!customer) {
      throw new ApiHttpError(
        404,
        "CUSTOMER_NOT_FOUND",
        "No customer account found for this store",
      );
    }

    const updated = await customerService.setDefaultAddress(
      ctx.db,
      store.id,
      customer.id,
      addressId,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
