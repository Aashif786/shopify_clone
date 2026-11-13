import type { Database } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import {
  type AuthContext,
  extractSessionIdFromCookie,
  extractCustomerSessionIdFromCookie,
  resolveAuthContext,
} from "@calcart/auth";
import { getDb } from "../db";
import { extractIdempotencyKey } from "./idempotency";

export interface RequestTiming {
  readonly startTime: number;
  readonly stages: Map<string, number>;
  recordStage(name: string, durationMs: number): void;
  getDuration(): number;
  getServerTimingHeader(): string;
}

export function createRequestTiming(startTime: number = performance.now()): RequestTiming {
  const stages = new Map<string, number>();
  return {
    startTime,
    stages,
    recordStage(name: string, durationMs: number) {
      const current = stages.get(name) ?? 0;
      stages.set(name, current + durationMs);
    },
    getDuration() {
      return performance.now() - startTime;
    },
    getServerTimingHeader() {
      const parts: string[] = [];
      for (const [name, duration] of stages.entries()) {
        parts.push(`${name};dur=${duration.toFixed(1)}`);
      }
      parts.push(`total;dur=${(performance.now() - startTime).toFixed(1)}`);
      return parts.join(", ");
    },
  };
}

export interface RequestContext {
  readonly requestId: string;
  readonly req: Request;
  readonly db: Database;
  readonly sessionId: string | null;
  readonly auth: AuthContext | null;
  readonly idempotencyKey: string | null;
  readonly timing: RequestTiming;
}

export interface ResolveContextOptions {
  db?: Database;
  sessionType?: "merchant" | "customer" | "auto";
  storeSlug?: string;
}

export function detectStoreSlugFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const match = url.pathname.match(/^\/(?:api\/v1\/storefront|stores)\/([^/?#]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // ignore
  }
  return null;
}

export function extractSessionId(req: Request, options?: ResolveContextOptions): string | null {
  const storeSlug = options?.storeSlug || detectStoreSlugFromUrl(req);
  const isStorefront =
    options?.sessionType === "customer" ||
    (options?.sessionType !== "merchant" && Boolean(storeSlug));

  const cookieHeader = req.headers.get("cookie");

  if (isStorefront) {
    // 1. For storefront routes, only read customer-scoped session cookies
    const customerSession = extractCustomerSessionIdFromCookie(cookieHeader, storeSlug);
    if (customerSession) {
      return customerSession;
    }
  } else {
    // 2. For merchant/platform routes, read merchant session cookie
    const merchantSession = extractSessionIdFromCookie(cookieHeader);
    if (merchantSession) {
      return merchantSession;
    }
  }

  // 3. Fallback from Authorization: Bearer <sessionId>
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
  const timing = createRequestTiming();
  const db = options?.db ?? getDb();
  const requestId = extractRequestId(req);
  const sessionId = extractSessionId(req, options);
  const idempotencyKey = extractIdempotencyKey(req);

  let auth: AuthContext | null = null;

  if (sessionId) {
    const authStart = performance.now();
    try {
      auth = await resolveAuthContext(db, sessionId);
    } catch {
      // Session invalid, expired, revoked, or disabled
      auth = null;
    } finally {
      timing.recordStage("auth", performance.now() - authStart);
    }
  }

  return {
    requestId,
    req,
    db,
    sessionId,
    auth,
    idempotencyKey,
    timing,
  };
}
