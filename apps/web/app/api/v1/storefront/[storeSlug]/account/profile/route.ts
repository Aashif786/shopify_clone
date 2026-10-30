import { CustomerService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  resolveRequestContext,
  updateCustomerProfileValidator,
  validateBody,
} from "@/lib/api";

const storeService = new StoreService();
const customerService = new CustomerService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      auth.user.id
    );

    if (!customer) {
      throw new ApiHttpError(
        404,
        "CUSTOMER_NOT_FOUND",
        "No customer account found for this store"
      );
    }

    const customerWithAddresses = await customerService.getCustomerWithAddresses(
      ctx.db,
      store.id,
      customer.id
    );

    return apiSuccess({ customer: customerWithAddresses }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      auth.user.id
    );

    if (!customer) {
      throw new ApiHttpError(
        404,
        "CUSTOMER_NOT_FOUND",
        "No customer account found for this store"
      );
    }

    const validated = await validateBody(req, updateCustomerProfileValidator);

    const updated = await customerService.updateCustomer(
      ctx.db,
      store.id,
      customer.id,
      validated
    );

    const customerWithAddresses = await customerService.getCustomerWithAddresses(
      ctx.db,
      store.id,
      updated.id
    );

    return apiSuccess({ customer: customerWithAddresses }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
