import { NextResponse, type NextRequest } from "next/server";
import { StoreDomainError, StoreTypeService } from "@calcart/stores";
import {
  PlatformAuditService,
  type PlatformAdminRole,
} from "@calcart/platform-admin";
import { getDb } from "./db";
import { formatAuthErrorResponse } from "./platform-auth";
import { extractClientMetadata } from "./query-params";

export function getStoreTypeService(): StoreTypeService {
  return new StoreTypeService();
}

export function formatStoreTypeError(error: unknown): NextResponse {
  if (error instanceof StoreDomainError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  return formatAuthErrorResponse(error);
}

export function readReason(body: unknown): string | null {
  const reason = (body as { reason?: unknown } | null)?.reason;
  return typeof reason === "string" && reason.trim().length >= 5 ? reason.trim() : null;
}

export function reasonRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "An administrative reason (at least 5 characters) is required.",
      },
    },
    { status: 400 },
  );
}

export async function parseJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function recordStoreTypeAudit(params: {
  req: NextRequest;
  admin: { userId: string; role: PlatformAdminRole };
  action: string;
  resourceId: string;
  reason: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { ipAddress, userAgent } = extractClientMetadata(params.req);
  await new PlatformAuditService(getDb()).record({
    actorId: params.admin.userId,
    actorRole: params.admin.role,
    action: params.action,
    resourceType: "store_type",
    resourceId: params.resourceId,
    reason: params.reason,
    details: params.details,
    status: "SUCCESS",
    ipAddress,
    userAgent,
  });
}
