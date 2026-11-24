import { CustomerService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  clampIntParam,
  handleApiError,
  requireAuth,
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

    const auth = requireAuth(ctx);
    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STOREFRONT_NOT_FOUND", "Store is not publicly available");
    }

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      auth.user.id
    );

    if (!customer) {
      return apiSuccess({ items: [] }, { status: 200, requestId });
    }

    const url = new URL(req.url);
    const limit = clampIntParam(url.searchParams.get("limit"), 50, 1, 100);
    const offset = clampIntParam(url.searchParams.get("offset"), 0, 0);

    const result = await ctx.db.query<{
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      fulfillment_status: string;
      currency: string;
      total: string;
      created_at: Date;
    }>(
      `SELECT id, order_number, status, payment_status, fulfillment_status, currency, total, created_at
       FROM orders
       WHERE store_id = $1 AND customer_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [store.id, customer.id, limit, offset]
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      fulfillmentStatus: row.fulfillment_status,
      currency: row.currency,
      total: parseInt(row.total, 10),
      createdAt: row.created_at.toISOString(),
    }));

    return apiSuccess({ items }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
