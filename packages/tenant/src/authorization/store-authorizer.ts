import type { Database } from "@shopify-clone/db";
import { type StoreRole, hasRoleAtLeast } from "./roles.js";

export interface StoreMembershipRecord {
  id: string;
  storeId: string;
  userId: string;
  role: StoreRole;
  status: string;
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
  requiredRole?: StoreRole
): Promise<StoreMembershipRecord> {
  const membership = await resolveStoreMembership(db, storeId, userId);
  if (!membership) {
    throw new ForbiddenError("User is not an active member of this store");
  }

  if (requiredRole && !hasRoleAtLeast(membership.role, requiredRole)) {
    throw new ForbiddenError(
      `Operation requires at least ${requiredRole} role in this store`
    );
  }

  return membership;
}
