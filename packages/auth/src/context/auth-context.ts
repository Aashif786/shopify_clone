import type { Database } from "@shopify-clone/db";
import {
  type AuthenticatedUser,
  type Session,
  validateSession,
} from "../sessions/session-service.js";

export interface AuthContext {
  user: AuthenticatedUser;
  session: Session;
}

export async function resolveAuthContext(
  db: Database,
  sessionId: string
): Promise<AuthContext> {
  const validated = await validateSession(db, sessionId);
  return {
    user: validated.user,
    session: validated.session,
  };
}
