export type ApiKeyScope =
  | "read:products"
  | "write:products"
  | "read:orders"
  | "write:orders"
  | "read:inventory"
  | "write:inventory"
  | "read:webhooks"
  | "write:webhooks";

export interface StoreApiKeyRow {
  id: string;
  store_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  last_used_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateStoreApiKeyInput {
  id?: string;
  storeId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes?: string[];
  expiresAt?: Date | null;
}
