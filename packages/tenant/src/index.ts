export {
  type StoreContext,
  type TenantContext,
} from "./context/tenant-context.js";

export {
  type StoreRole,
  ROLE_HIERARCHY,
  hasRoleAtLeast,
} from "./authorization/roles.js";

export {
  type StoreMembershipRecord,
  ForbiddenError,
  isPlatformAdmin,
  requireStoreAccess,
  resolveStoreMembership,
} from "./authorization/store-authorizer.js";

export {
  normalizeHostname,
  parseHostname,
  RESERVED_SUBDOMAINS,
  type ParsedHostname,
} from "./domains/hostname-parser.js";

export {
  resolveStoreFromHostname,
  type ResolvedStoreDomain,
} from "./domains/store-domain-resolver.js";
