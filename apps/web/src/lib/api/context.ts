import type { Database } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import {
  type AuthContext,
  extractSessionIdFromCookie,
  resolveAuthContext,
} from "@shopify-clone/auth";
import { getDb } from "../db";
import { extractIdempotencyKey } from "./idempotency";

export interface RequestContext {
  readonly requestId: string;
  readonly req: Request;
  readonly db: Database;
  readonly sessionId: string | null;
  readonly auth: AuthContext | null;
  readonly idempotencyKey: string | null;
}

export interface ResolveContextOptions {
  db?: Database;
}

export function extractSessionId(req: Request): string | null {
  // 1. From Cookie header
  const cookieHeader = req.headers.get("cookie");
  const cookieSession = extractSessionIdFromCookie(cookieHeader);
  if (cookieSession) {
    return cookieSession;
  }

  // 2. From Authorization: Bearer <sessionId>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return token;
    }
  }

  return null;
}

export function extractRequestId(req: Request): string {
  const header =
    req.headers.get("x-request-id") || req.headers.get("X-Request-Id");
  if (header) {
    const sanitized = header.trim();
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(sanitized)) {
      return sanitized;
    }
  }
  return generateUuidV7();
}

export async function resolveRequestContext(
  req: Request,
  options?: ResolveContextOptions
): Promise<RequestContext> {
  const db = options?.db ?? getDb();
  const requestId = extractRequestId(req);
  const sessionId = extractSessionId(req);
  const idempotencyKey = extractIdempotencyKey(req);

  let auth: AuthContext | null = null;

  if (sessionId) {
    try {
      auth = await resolveAuthContext(db, sessionId);
    } catch {
      // Session invalid, expired, revoked, or disabled
      auth = null;
    }
  }

  return {
    requestId,
    req,
    db,
    sessionId,
    auth,
    idempotencyKey,
  };
}
