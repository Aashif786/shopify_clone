import type { EntityId } from "@shopify-clone/types";

export interface Session {
  id: string;
  userId: EntityId;
  expiresAt: Date;
}

export interface AuthContext {
  userId: EntityId;
  sessionId: string;
}
