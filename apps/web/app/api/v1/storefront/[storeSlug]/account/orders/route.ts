import { CustomerService } from "@shopify-clone/customers";
import { StoreService } from "@shopify-clone/stores";
import {
  apiSuccess,
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

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      auth.user.id
    );

    if (!customer) {
      return apiSuccess({ items: [] }, { status: 200, requestId });
    }

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
       ORDER BY created_at DESC`,
      [store.id, customer.id]
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
