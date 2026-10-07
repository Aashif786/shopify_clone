export type StoreRole = "owner" | "admin" | "staff";

export const ROLE_HIERARCHY: Record<StoreRole, number> = {
  owner: 3,
  admin: 2,
  staff: 1,
};

export function hasRoleAtLeast(
  userRole: StoreRole,
  requiredRole: StoreRole
): boolean {
  const userRank = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredRank = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userRank >= requiredRank;
}
