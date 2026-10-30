import { CustomerService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  resolveRequestContext,
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

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    if (!ctx.auth) {
      return apiSuccess({ customer: null, user: null }, { status: 200, requestId });
    }

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      ctx.auth.user.id
    );

    let customerWithAddresses = null;
    if (customer) {
      customerWithAddresses = await customerService.getCustomerWithAddresses(
        ctx.db,
        store.id,
        customer.id
      );
    }

    return apiSuccess(
      {
        customer: customerWithAddresses,
        user: {
          id: ctx.auth.user.id,
          email: ctx.auth.user.email,
          name: ctx.auth.user.name,
        },
      },
      { status: 200, requestId }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
