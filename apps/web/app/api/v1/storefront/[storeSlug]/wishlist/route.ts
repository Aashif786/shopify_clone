import { CustomerService, WishlistService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();
const customerService = new CustomerService();
const wishlistService = new WishlistService();

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
      return apiSuccess({ items: [], count: 0 }, { status: 200, requestId });
    }

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      ctx.auth.user.id,
    );

    if (!customer) {
      return apiSuccess({ items: [], count: 0 }, { status: 200, requestId });
    }

    const items = await wishlistService.listWishlistItems(ctx.db, store.id, customer.id);
    return apiSuccess({ items, count: items.length }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    if (!ctx.auth) {
      throw new ApiHttpError(401, "UNAUTHORIZED", "Please sign in to save items to your account");
    }

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      ctx.auth.user.id,
    );

    if (!customer) {
      throw new ApiHttpError(404, "CUSTOMER_NOT_FOUND", "Customer profile not found");
    }

    const body = await req.json().catch(() => ({}));
    const productId = body.productId;
    const variantId = body.variantId ?? null;

    if (!productId || typeof productId !== "string") {
      throw new ApiHttpError(400, "INVALID_INPUT", "productId is required");
    }

    const item = await wishlistService.addItem(
      ctx.db,
      store.id,
      customer.id,
      productId.trim(),
      variantId,
    );

    return apiSuccess({ item }, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    if (!ctx.auth) {
      throw new ApiHttpError(401, "UNAUTHORIZED", "Please sign in to manage your wishlist");
    }

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      ctx.auth.user.id,
    );

    if (!customer) {
      throw new ApiHttpError(404, "CUSTOMER_NOT_FOUND", "Customer profile not found");
    }

    const body = await req.json().catch(() => ({}));
    const { productId, variantId, itemId, clear } = body;

    if (clear === true) {
      const removedCount = await wishlistService.clearWishlist(ctx.db, store.id, customer.id);
      return apiSuccess({ success: true, removedCount }, { status: 200, requestId });
    }

    if (itemId && typeof itemId === "string") {
      const removed = await wishlistService.removeItemById(ctx.db, store.id, customer.id, itemId);
      return apiSuccess({ success: removed }, { status: 200, requestId });
    }

    if (productId && typeof productId === "string") {
      const removed = await wishlistService.removeItem(
        ctx.db,
        store.id,
        customer.id,
        productId.trim(),
        variantId ?? null,
      );
      return apiSuccess({ success: removed }, { status: 200, requestId });
    }

    throw new ApiHttpError(400, "INVALID_INPUT", "productId, itemId, or clear: true is required");
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
