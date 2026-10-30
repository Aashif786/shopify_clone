import type { Database } from "@calcart/db";
import { type StoreRole, hasRoleAtLeast } from "./roles.js";

export interface StoreMembershipRecord {
  id: string;
  storeId: string;
  userId: string;
  role: StoreRole;
  status: string;
  isPlatformAdmin?: boolean;
}

export class ForbiddenError extends Error {
  readonly code: string;

  constructor(
    message: string = "Access denied to requested store",
    code: string = "FORBIDDEN"
  ) {
    super(message);
    this.name = "ForbiddenError";
    this.code = code;
  }
}

export async function isPlatformAdmin(
  db: Database,
  userId: string
): Promise<boolean> {
  if (!userId) return false;
  const result = await db.query<{ is_platform_admin: boolean }>(
    "SELECT COALESCE(is_platform_admin, FALSE) AS is_platform_admin FROM users WHERE id = $1",
    [userId]
  );
  return Boolean(result.rows[0]?.is_platform_admin);
}

export async function resolveStoreMembership(
  db: Database,
  storeId: string,
  userId: string
): Promise<StoreMembershipRecord | null> {
  if (!storeId || !userId) {
    return null;
  }

  const result = await db.query<{
    id: string;
    store_id: string;
    user_id: string;
    role: string;
    status: string;
  }>(
    `SELECT id, store_id, user_id, role, status
     FROM store_memberships
     WHERE store_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
    [storeId, userId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    role: row.role as StoreRole,
    status: row.status,
  };
}

export async function requireStoreAccess(
  db: Database,
  storeId: string,
  userId: string,
  requiredRole?: StoreRole,
  options?: { allowPlatformAdmin?: boolean }
): Promise<StoreMembershipRecord> {
  const membership = await resolveStoreMembership(db, storeId, userId);
  if (!membership) {
    if (options?.allowPlatformAdmin !== false) {
      const isSuperAdmin = await isPlatformAdmin(db, userId);
      if (isSuperAdmin) {
        // Verify store exists
        const storeCheck = await db.query<{ id: string }>(
          "SELECT id FROM stores WHERE id = $1",
          [storeId]
        );
        if (storeCheck.rowCount === 0) {
          throw new ForbiddenError("Store not found or access denied");
        }
        // Explicitly auditable platform super admin access
        console.warn(
          `[AUDIT:PlatformSuperAdmin] User ${userId} accessed store ${storeId} as Platform Super Admin`
        );
        return {
          id: `platform-admin:${userId}`,
          storeId,
          userId,
          role: "owner",
          status: "ACTIVE",
          isPlatformAdmin: true,
        };
      }
    }
    throw new ForbiddenError("User is not an active member of this store");
  }

  if (requiredRole && !hasRoleAtLeast(membership.role, requiredRole)) {
    throw new ForbiddenError(
      `Operation requires at least ${requiredRole} role in this store`
    );
  }

  return membership;
}
