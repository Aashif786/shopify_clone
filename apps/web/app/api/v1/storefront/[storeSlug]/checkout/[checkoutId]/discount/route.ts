import { CheckoutService } from "@calcart/checkout";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { enrichCheckout } from "@/lib/storefront-checkout-helpers";
import { DiscountService, type DiscountDTO } from "@calcart/discounts";
import {
  evaluateDiscountCode,
  normalizeDiscountCode,
  resolveStoreDiscount,
  type StoreDiscountDefinition,
} from "@/lib/storefront-discount-helpers";

const storeService = new StoreService();
const checkoutService = new CheckoutService();
const discountService = new DiscountService();

interface RouteContext {
  params: Promise<{ storeSlug: string; checkoutId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, checkoutId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!checkoutId) {
      throw new ApiHttpError(400, "INVALID_CHECKOUT_ID", "Checkout ID is required");
    }
    validateUuid(checkoutId, "checkoutId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const body = (await req.json()) as {
      code?: string;
    };

    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body is required");
    }

    const normalizedCode = normalizeDiscountCode(body.code);
    if (!normalizedCode) {
      throw new ApiHttpError(
        400,
        "INVALID_DISCOUNT_CODE",
        "Discount code cannot be empty",
      );
    }

    // 1. Fetch active checkout session
    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    // 2. Resolve discount for this store (persistent domain with demo fallback)
    let discountDef: DiscountDTO | StoreDiscountDefinition | null =
      await discountService.getDiscountByCode(ctx.db, store.id, normalizedCode);
    if (!discountDef) {
      discountDef = await resolveStoreDiscount(ctx.db, store.id, normalizedCode);
    }

    // 3. Evaluate eligibility and calculate discount against checkout subtotal
    let isFirstTimeCustomer: boolean | undefined = undefined;
    if (checkout.customerId) {
      const orderCountRes = await ctx.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND store_id = $2 AND status != 'CANCELLED'`,
        [checkout.customerId, store.id]
      );
      isFirstTimeCustomer = Number(orderCountRes.rows[0]?.count ?? 0) === 0;
    }

    const variantIds = checkout.items.map((it) => it.variantId);
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

    const evaluationItems = checkout.items.map((it) => {
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
      subtotal: checkout.subtotal,
      currency: checkout.currency,
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

    // 4. Update checkout totals
    const updatedCheckout = await checkoutService.updateTotals(ctx.db, store.id, checkoutId, {
      discountTotal: evaluation.discount.amount,
      discountId: discountDef.id,
      discountCode: normalizedCode,
    });

    const enriched = await enrichCheckout(ctx.db, store.id, updatedCheckout);

    return apiSuccess(
      {
        checkout: enriched,
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

    const { storeSlug, checkoutId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!checkoutId) {
      throw new ApiHttpError(400, "INVALID_CHECKOUT_ID", "Checkout ID is required");
    }
    validateUuid(checkoutId, "checkoutId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    const updatedCheckout = await checkoutService.updateTotals(ctx.db, store.id, checkoutId, {
      discountTotal: 0,
      discountId: null,
      discountCode: null,
    });

    const enriched = await enrichCheckout(ctx.db, store.id, updatedCheckout);

    return apiSuccess(
      {
        checkout: enriched,
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