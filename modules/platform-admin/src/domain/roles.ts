export type PlatformAdminRole =
  | "super_admin"
  | "platform_admin"
  | "finance_admin"
  | "support_admin"
  | "security_admin"
  | "analyst";

export const PLATFORM_ROLES: readonly PlatformAdminRole[] = [
  "super_admin",
  "platform_admin",
  "finance_admin",
  "support_admin",
  "security_admin",
  "analyst",
] as const;

export type PlatformPermission =
  | "dashboard:read"
  | "tenants:read"
  | "tenants:write"
  | "stores:read"
  | "stores:write"
  | "merchants:read"
  | "merchants:write"
  | "users:read"
  | "users:write"
  | "payments:read"
  | "payments:reconcile"
  | "subscriptions:read"
  | "subscriptions:write"
  | "analytics:read"
  | "analytics:export"
  | "operations:read"
  | "incidents:write"
  | "security:read"
  | "security:write"
  | "audit:read"
  | "flags:read"
  | "flags:write"
  | "settings:read"
  | "settings:write";

export const ROLE_PERMISSIONS: Record<PlatformAdminRole, ReadonlySet<PlatformPermission>> = {
  super_admin: new Set<PlatformPermission>([
    "dashboard:read",
    "tenants:read",
    "tenants:write",
    "stores:read",
    "stores:write",
    "merchants:read",
    "merchants:write",
    "users:read",
    "users:write",
    "payments:read",
    "payments:reconcile",
    "subscriptions:read",
    "subscriptions:write",
    "analytics:read",
    "analytics:export",
    "operations:read",
    "incidents:write",
    "security:read",
    "security:write",
    "audit:read",
    "flags:read",
    "flags:write",
    "settings:read",
    "settings:write",
  ]),

  platform_admin: new Set<PlatformPermission>([
    "dashboard:read",
    "tenants:read",
    "tenants:write",
    "stores:read",
    "stores:write",
    "merchants:read",
    "merchants:write",
    "users:read",
    "users:write",
    "payments:read",
    "subscriptions:read",
    "analytics:read",
    "operations:read",
    "incidents:write",
    "flags:read",
    "audit:read",
  ]),

  finance_admin: new Set<PlatformPermission>([
    "dashboard:read",
    "tenants:read",
    "stores:read",
    "payments:read",
    "payments:reconcile",
    "subscriptions:read",
    "subscriptions:write",
    "analytics:read",
    "analytics:export",
    "audit:read",
  ]),

  support_admin: new Set<PlatformPermission>([
    "dashboard:read",
    "tenants:read",
    "stores:read",
    "merchants:read",
    "merchants:write", // restricted to password-reset trigger or session termination
    "users:read",
    "payments:read",
    "operations:read",
    "audit:read",
  ]),

  security_admin: new Set<PlatformPermission>([
    "dashboard:read",
    "users:read",
    "users:write",
    "security:read",
    "security:write",
    "audit:read",
    "operations:read",
    "incidents:write",
  ]),

  analyst: new Set<PlatformPermission>([
    "dashboard:read",
    "tenants:read",
    "stores:read",
    "subscriptions:read",
    "analytics:read",
    "analytics:export",
    "operations:read",
  ]),
};

export function hasPlatformPermission(
  role: PlatformAdminRole | string | undefined | null,
  permission: PlatformPermission
): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as PlatformAdminRole];
  if (!permissions) return false;
  return permissions.has(permission);
}

export function isPlatformRole(role: string): role is PlatformAdminRole {
  return (PLATFORM_ROLES as readonly string[]).includes(role);
}
