import { CartService } from "@shopify-clone/carts";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
  validateBody,
  applyDiscountValidator,
} from "@/lib/api";
import { enrichCart } from "@/lib/storefront-cart-helpers";
import { DiscountService, type DiscountDTO } from "@shopify-clone/discounts";
import {
  evaluateDiscountCode,
  normalizeDiscountCode,
  resolveStoreDiscount,
  type StoreDiscountDefinition,
} from "@/lib/storefront-discount-helpers";
import {
  assertCartOwnership,
  extractGuestIdentifier,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const cartService = new CartService();
const discountService = new DiscountService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const validated = await validateBody(req, applyDiscountValidator);

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestIdentifier = extractGuestIdentifier(req) || validated.guestIdentifier || null;
    const caller = { customerId: customer?.id, guestIdentifier };

    // 1. Fetch active cart with ownership check
    const cart = await cartService.getCart(ctx.db, store.id, validated.cartId, caller);
    assertCartOwnership(cart, caller);

    if (cart.status !== "ACTIVE") {
      throw new ApiHttpError(
        400,
        "CART_NOT_ACTIVE",
        `Cart is ${cart.status} and cannot be modified`,
      );
    }

    if (cart.items.length === 0) {
      throw new ApiHttpError(
        400,
        "EMPTY_CART",
        "Cannot apply discount to an empty cart",
      );
    }

    const normalizedCode = normalizeDiscountCode(validated.code);

    // 2. Resolve discount for this specific store
    let discountDef: DiscountDTO | StoreDiscountDefinition | null =
      await discountService.getDiscountByCode(ctx.db, store.id, normalizedCode);
    if (!discountDef) {
      discountDef = await resolveStoreDiscount(ctx.db, store.id, normalizedCode);
    }

    // 3. Evaluate eligibility against server-authoritative cart subtotal
    let isFirstTimeCustomer: boolean | undefined = undefined;
    if (customer?.id) {
      const orderCountRes = await ctx.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND store_id = $2 AND status != 'CANCELLED'`,
        [customer.id, store.id]
      );
      isFirstTimeCustomer = Number(orderCountRes.rows[0]?.count ?? 0) === 0;
    }

    const variantIds = cart.items.map((it) => it.variantId);
    const variantsRes = variantIds.length > 0 ? await ctx.db.query<{
      variant_id: string;
      product_id: string;
      type_id: string | null;
      category_id: string | null;
    }>(
      `SELECT pv.id as variant_id, pv.product_id, p.type_id, p.category_id
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ANY($1::uuid[]) AND pv.store_id = $2`,
      [variantIds, store.id]
    ) : { rows: [] };
    const varMap = new Map(variantsRes.rows.map((r) => [r.variant_id, r]));
    const productIds = Array.from(new Set(variantsRes.rows.map((r) => r.product_id)));

    const tagsRes = productIds.length > 0 ? await ctx.db.query<{ product_id: string; tag_id: string }>(
      `SELECT product_id, tag_id FROM product_tag_assignments WHERE product_id = ANY($1::uuid[]) AND store_id = $2`,
      [productIds, store.id]
    ) : { rows: [] };
    const tagMap = new Map<string, string[]>();
    for (const row of tagsRes.rows) {
      const arr = tagMap.get(row.product_id) || [];
      arr.push(row.tag_id);
      tagMap.set(row.product_id, arr);
    }

    const evaluationItems = cart.items.map((it) => {
      const v = varMap.get(it.variantId);
      const prodId = v?.product_id || it.variantId;
      return {
        productId: prodId,
        typeId: v?.type_id || null,
        categoryId: v?.category_id || null,
        tagIds: tagMap.get(prodId) || [],
        price: it.unitPrice,
        quantity: it.quantity,
      };
    });

    const evaluation = evaluateDiscountCode(discountDef, {
      targetStoreId: store.id,
      subtotal: cart.subtotal,
      currency: cart.currency,
      isFirstTimeCustomer,
      items: evaluationItems,
    });

    if (!evaluation.isValid || !evaluation.discount || !discountDef) {
      throw new ApiHttpError(
        400,
        evaluation.reason ?? "INVALID_DISCOUNT",
        evaluation.errorMessage ?? "Discount code is not valid for this order",
        { details: { reason: evaluation.reason } },
      );
    }

    // 4. Atomically persist authoritative discount total on the cart
    const updatedCart = await cartService.updateTotals(
      ctx.db,
      store.id,
      cart.id,
      {
        discountTotal: evaluation.discount.amount,
        discountId: discountDef.id,
        discountCode: normalizedCode,
      },
      caller,
    );

    const enriched = await enrichCart(ctx.db, store.id, updatedCart);

    return apiSuccess(
      {
        cart: enriched,
        discount: evaluation.discount,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId },
    );
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
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const url = new URL(req.url);
    const guestIdentifier =
      extractGuestIdentifier(req) ||
      url.searchParams.get("guestIdentifier") ||
      url.searchParams.get("guest_identifier") ||
      null;
    const caller = { customerId: customer?.id, guestIdentifier };

    const cartId =
      url.searchParams.get("cartId") ||
      req.headers.get("x-cart-id") ||
      undefined;

    if (!cartId) {
      throw new ApiHttpError(
        400,
        "MISSING_CART_ID",
        "Cart ID is required to remove discount",
      );
    }
    validateUuid(cartId, "cartId");

    const cart = await cartService.getCart(ctx.db, store.id, cartId, caller);
    assertCartOwnership(cart, caller);

    // Reset discount total to 0
    const updatedCart = await cartService.updateTotals(
      ctx.db,
      store.id,
      cartId,
      {
        discountTotal: 0,
        discountId: null,
        discountCode: null,
      },
      caller,
    );

    const enriched = await enrichCart(ctx.db, store.id, updatedCart);

    return apiSuccess(
      {
        cart: enriched,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
