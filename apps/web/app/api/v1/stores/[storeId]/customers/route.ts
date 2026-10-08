import { CustomerService } from "@shopify-clone/customers";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  createCustomerValidator,
  handleApiError,
  listCustomersQueryValidator,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateQuery,
  validateUuid,
} from "@/lib/api";

const customerService = new CustomerService();

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
    const query = validateQuery(req, listCustomersQueryValidator);

    const result = await customerService.listCustomers(ctx.db, storeId, query);
    return apiSuccess(result, { requestId });
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
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, createCustomerValidator);
    const created = await customerService.createCustomer(ctx.db, storeId, body);

    return apiSuccess(created, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
