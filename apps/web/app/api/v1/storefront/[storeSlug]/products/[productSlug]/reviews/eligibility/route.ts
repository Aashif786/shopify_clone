import { ProductService, ReviewService } from "@shopify-clone/products";
import { StoreService } from "@shopify-clone/stores";
import { CustomerService } from "@shopify-clone/customers";
import { apiSuccess, handleApiError, resolveRequestContext } from "@/lib/api";

const storeService = new StoreService();
const productService = new ProductService();
const reviewService = new ReviewService();
const customerService = new CustomerService();

interface RouteContext {
  params: Promise<{
    storeSlug: string;
    productSlug: string;
  }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, productSlug } = await context.params;
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    const product = await productService.getProductBySlug(ctx.db, store.id, productSlug);

    let customerId: string | null = null;
    if (ctx.auth?.user?.id) {
      const customer = await customerService.getCustomerByUserId(
        ctx.db,
        store.id,
        ctx.auth.user.id,
      );
      if (customer) {
        customerId = customer.id;
      }
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    const eligibility = await reviewService.checkEligibility(
      ctx.db,
      store.id,
      product.id,
      customerId,
      orderId,
    );

    return apiSuccess(eligibility, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
