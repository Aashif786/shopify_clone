import { CheckoutService } from "@shopify-clone/checkout";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateCheckoutValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const checkoutService = new CheckoutService();

interface RouteContext {
  params: Promise<{ storeId: string; checkoutId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, checkoutId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(checkoutId, "checkoutId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const checkout = await checkoutService.getCheckout(ctx.db, storeId, checkoutId);
    return apiSuccess(checkout, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, checkoutId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(checkoutId, "checkoutId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, updateCheckoutValidator);

    // 1. Update customer/email if provided
    if (body.customerId !== undefined || body.email !== undefined) {
      await checkoutService.updateCustomer(ctx.db, storeId, checkoutId, {
        customerId: body.customerId,
        email: body.email,
      });
    }

    // 2. Update addresses if provided
    if (body.shippingAddress !== undefined || body.billingAddress !== undefined) {
      await checkoutService.updateAddresses(ctx.db, storeId, checkoutId, {
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress,
      });
    }

    // 3. Update totals if provided
    if (
      body.discountTotal !== undefined ||
      body.taxTotal !== undefined ||
      body.shippingTotal !== undefined
    ) {
      await checkoutService.updateTotals(ctx.db, storeId, checkoutId, {
        discountTotal: body.discountTotal,
        taxTotal: body.taxTotal,
        shippingTotal: body.shippingTotal,
      });
    }

    // 4. Update items if requested
    if (body.itemAction) {
      if (body.itemAction.action === "add") {
        await checkoutService.addItem(ctx.db, storeId, checkoutId, {
          variantId: body.itemAction.variantId!,
          quantity: body.itemAction.quantity!,
        });
      } else if (body.itemAction.action === "update") {
        const current = await checkoutService.getCheckout(ctx.db, storeId, checkoutId);
        const targetItem = current.items.find(
          (i) => i.id === body.itemAction!.itemId || i.variantId === body.itemAction!.variantId,
        );
        const targetVariantId = targetItem?.variantId ?? body.itemAction.variantId ?? body.itemAction.itemId!;
        await checkoutService.updateItemQuantity(
          ctx.db,
          storeId,
          checkoutId,
          targetVariantId,
          body.itemAction.quantity!,
        );
      } else if (body.itemAction.action === "remove") {
        const current = await checkoutService.getCheckout(ctx.db, storeId, checkoutId);
        const targetItem = current.items.find(
          (i) => i.id === body.itemAction!.itemId || i.variantId === body.itemAction!.variantId,
        );
        const targetVariantId = targetItem?.variantId ?? body.itemAction.variantId ?? body.itemAction.itemId!;
        await checkoutService.removeItem(ctx.db, storeId, checkoutId, targetVariantId);
      }
    }

    const updated = await checkoutService.getCheckout(ctx.db, storeId, checkoutId);
    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
