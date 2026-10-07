import type { EntityId } from "@shopify-clone/types";

export interface TenantContext {
  organizationId: EntityId;
  storeId: EntityId;
}

export interface StoreContext {
  storeId: EntityId;
}
