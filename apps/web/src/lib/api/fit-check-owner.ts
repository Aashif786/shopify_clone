import { CustomerService } from "@calcart/customers";
import { StoreService, StoreTypeService } from "@calcart/stores";
import type { Database } from "@calcart/db";
import { ApiHttpError } from "./errors";
import { resolveRequestContext } from "./context";
import { requireAuth } from "./guard";

const storeService = new StoreService();
const storeTypeService = new StoreTypeService();
const customerService = new CustomerService();

export interface FitCheckRouteContext {
  params: Promise<{ storeSlug: string }>;
}

/**
 * Resolves the store and the signed-in customer's identity from the session.
 * The customer id is NEVER taken from the request, so a customer can only ever
 * reach their own Fit Check data in this store.
 */
export async function resolveFitCheckOwner(req: Request, context: FitCheckRouteContext) {
  const ctx = await resolveRequestContext(req);
  const auth = requireAuth(ctx);
  const { storeSlug } = await Promise.resolve(context.params);
  const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

  if (store.status !== "ACTIVE" || !(await storeTypeService.isFitCheckActive(ctx.db, store.id))) {
    throw new ApiHttpError(403, "FIT_CHECK_UNAVAILABLE", "Fit Check is not available for this store");
  }

  const customer = await customerService.getCustomerByUserId(ctx.db, store.id, auth.user.id);
  if (!customer) {
    throw new ApiHttpError(404, "CUSTOMER_NOT_FOUND", "No customer account found for this store");
  }
  return { ctx, db: ctx.db as Database, storeId: store.id, customerId: customer.id };
}

export function noStore(init: { requestId?: string; status?: number }) {
  return { ...init, headers: { "Cache-Control": "private, no-store" } };
}
