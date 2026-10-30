import type { EntityId } from "@calcart/types";

export interface TenantContext {
  organizationId: EntityId;
  storeId: EntityId;
}

export interface StoreContext {
  storeId: EntityId;
}
