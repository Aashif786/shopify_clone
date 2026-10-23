import { randomBytes } from "node:crypto";
import { hashToken } from "@shopify-clone/auth";
import type { CheckoutDTO } from "@shopify-clone/checkout";
import { CustomerService, type CustomerDTO } from "@shopify-clone/customers";
import type { OrderDTO } from "@shopify-clone/orders";
import type { CartDTO } from "@shopify-clone/carts";
import { ApiHttpError, type RequestContext } from "@/lib/api";

export { hashToken };

export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

const customerService = new CustomerService();

export function extractGuestToken(req: Request): string | null {
  const token =
    req.headers.get("x-guest-token") ||
    req.headers.get("x-ownership-token") ||
    req.headers.get("X-Guest-Token");
  if (token && token.trim().length > 0) {
    return token.trim();
  }

  try {
    const url = new URL(req.url);
    const param = url.searchParams.get("guestToken") || url.searchParams.get("token");
    if (param && param.trim().length > 0) {
      return param.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

export function extractGuestIdentifier(req: Request): string | null {
  const header =
    req.headers.get("x-guest-identifier") ||
    req.headers.get("X-Guest-Identifier");
  if (header && header.trim()) {
    return header.trim();
  }

  try {
    const url = new URL(req.url);
    const param = url.searchParams.get("guestIdentifier");
    if (param && param.trim()) {
      return param.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

export async function resolveStorefrontCustomer(
  ctx: RequestContext,
  storeId: string,
): Promise<CustomerDTO | null> {
  if (!ctx.auth?.user?.id) {
    return null;
  }
  return customerService.getCustomerByUserId(ctx.db, storeId, ctx.auth.user.id);
}

export function assertCheckoutOwnership(
  checkout: CheckoutDTO,
  caller: {
    customer?: CustomerDTO | null;
    guestToken?: string | null;
  },
): void {
  // 1. If authenticated customer matches checkout customerId
  if (caller.customer?.id && checkout.customerId && caller.customer.id === checkout.customerId) {
    return;
  }

  // 2. If valid guest ownership token matches checkout guest_token_hash
  if (caller.guestToken && caller.guestToken.trim().length > 0 && checkout.guestTokenHash) {
    const callerHash = hashToken(caller.guestToken.trim());
    if (callerHash === checkout.guestTokenHash) {
      return;
    }
  }

  // 3. Otherwise unauthorized -> 404 to avoid ID enumeration and data disclosure
  throw new ApiHttpError(
    404,
    "CHECKOUT_NOT_FOUND",
    "Checkout was not found in this store",
  );
}

export function assertOrderOwnership(
  order: OrderDTO,
  caller: {
    customer?: CustomerDTO | null;
    guestToken?: string | null;
  },
): void {
  // 1. If authenticated customer matches order customerId
  if (caller.customer?.id && order.customerId && caller.customer.id === order.customerId) {
    return;
  }

  // 2. If valid guest ownership token matches order guest_token_hash
  if (caller.guestToken && caller.guestToken.trim().length > 0 && order.guestTokenHash) {
    const callerHash = hashToken(caller.guestToken.trim());
    if (callerHash === order.guestTokenHash) {
      return;
    }
  }

  // 3. Otherwise unauthorized -> 404 to avoid ID enumeration and data disclosure
  throw new ApiHttpError(
    404,
    "ORDER_NOT_FOUND",
    "Order was not found in this store",
  );
}

export function assertCartOwnership(
  cart: CartDTO,
  caller: {
    customerId?: string | null;
    guestIdentifier?: string | null;
  },
): void {
  if (cart.customerId) {
    if (!caller.customerId || cart.customerId !== caller.customerId) {
      throw new ApiHttpError(
        403,
        "CART_ACCESS_DENIED",
        "Access denied to customer cart",
      );
    }
    return;
  }

  if (cart.guestIdentifier) {
    if (
      caller.guestIdentifier &&
      cart.guestIdentifier === caller.guestIdentifier
    ) {
      return;
    }
    if (caller.customerId && cart.customerId === caller.customerId) {
      return;
    }
    throw new ApiHttpError(
      403,
      "CART_ACCESS_DENIED",
      "Access denied to guest cart",
    );
  }

  // If a cart has neither customerId nor guestIdentifier, fail-closed
  throw new ApiHttpError(
    403,
    "CART_ACCESS_DENIED",
    "Access denied to unassigned cart",
  );
}
