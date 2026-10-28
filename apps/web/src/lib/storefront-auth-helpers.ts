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

    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const slugMatch = url.pathname.match(/(?:storefront|stores)\/([^/?#]+)/);
      if (slugMatch && slugMatch[1]) {
        const storeSlug = decodeURIComponent(slugMatch[1]);
        const storeCookie = extractCookieValue(cookieHeader, `sc_${storeSlug}_guest_token`);
        if (storeCookie && storeCookie.trim()) {
          return storeCookie.trim();
        }
      }

      const genericCookie =
        extractCookieValue(cookieHeader, "sc_guest_token") ||
        extractCookieValue(cookieHeader, "guest_token") ||
        extractCookieValue(cookieHeader, "x_guest_token");
      if (genericCookie && genericCookie.trim()) {
        return genericCookie.trim();
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function extractCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return null;
  }
}

export function extractGuestIdentifier(req: Request): string | null {
  // 1. HTTP Headers
  const header =
    req.headers.get("x-guest-identifier") ||
    req.headers.get("X-Guest-Identifier");
  if (header && header.trim()) {
    return header.trim();
  }

  // 2. Query Parameters
  try {
    const url = new URL(req.url);
    const param =
      url.searchParams.get("guestIdentifier") ||
      url.searchParams.get("guest_identifier");
    if (param && param.trim()) {
      return param.trim();
    }

    // 3. Cookie extraction
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      // Check store-specific cookie if slug present in pathname
      const slugMatch = url.pathname.match(/(?:storefront|stores)\/([^/?#]+)/);
      if (slugMatch && slugMatch[1]) {
        const storeSlug = decodeURIComponent(slugMatch[1]);
        const storeCookie = extractCookieValue(cookieHeader, `sc_${storeSlug}_guest_id`);
        if (storeCookie && storeCookie.trim()) {
          return storeCookie.trim();
        }
      }

      // Check generic cookies
      const genericCookie =
        extractCookieValue(cookieHeader, "sc_guest_id") ||
        extractCookieValue(cookieHeader, "guest_identifier") ||
        extractCookieValue(cookieHeader, "x_guest_identifier");
      if (genericCookie && genericCookie.trim()) {
        return genericCookie.trim();
      }
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
  let customer = await customerService.getCustomerByUserId(ctx.db, storeId, ctx.auth.user.id);
  if (!customer && ctx.auth.user.email) {
    const existingByEmail = await customerService.getCustomerByEmail(ctx.db, storeId, ctx.auth.user.email);
    if (existingByEmail && !existingByEmail.userId) {
      customer = await customerService.updateCustomer(ctx.db, storeId, existingByEmail.id, {
        userId: ctx.auth.user.id,
      });
    } else if (!existingByEmail) {
      customer = await customerService.createCustomer(ctx.db, storeId, {
        userId: ctx.auth.user.id,
        email: ctx.auth.user.email,
        firstName: ctx.auth.user.name?.split(" ")[0] || "Customer",
        lastName: ctx.auth.user.name?.split(" ").slice(1).join(" ") || "",
      });
    }
  }
  return customer;
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
