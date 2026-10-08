import type { AuthContext } from "@shopify-clone/auth";
import {
  type StoreMembershipRecord,
  type StoreRole,
  ForbiddenError,
  requireStoreAccess,
} from "@shopify-clone/tenant";
import type { RequestContext } from "./context";
import { ApiHttpError } from "./errors";

export function requireAuth(ctx: RequestContext): AuthContext {
  if (!ctx.auth) {
    throw new ApiHttpError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required to access this resource"
    );
  }
  return ctx.auth;
}

export async function requireStore(
  ctx: RequestContext,
  storeId: string,
  requiredRole?: StoreRole
): Promise<StoreMembershipRecord> {
  const auth = requireAuth(ctx);

  if (!storeId || typeof storeId !== "string" || !storeId.trim()) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Store identifier is required",
      {
        fields: {
          storeId: "Store ID is required",
        },
      }
    );
  }

  try {
    return await requireStoreAccess(
      ctx.db,
      storeId.trim(),
      auth.user.id,
      requiredRole
    );
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new ApiHttpError(403, error.code, error.message);
    }
    throw error;
  }
}

export async function requireStoreOrNotFound(
  ctx: RequestContext,
  storeId: string,
  requiredRole?: StoreRole
): Promise<StoreMembershipRecord> {
  try {
    return await requireStore(ctx, storeId, requiredRole);
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 403) {
      throw new ApiHttpError(404, "NOT_FOUND", "Resource not found");
    }
    throw error;
  }
}
