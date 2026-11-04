import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformTenantService } from "@calcart/platform-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    await requirePlatformAdmin("tenants:read");
    const { tenantId } = await params;

    const tenantService = new PlatformTenantService(getDb());
    const data = await tenantService.getTenant360(tenantId);

    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Tenant organization not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await requirePlatformAdmin("tenants:write");
    const { tenantId } = await params;
    const body = await req.json();
    const { status, reason } = body;

    if (!status || !["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid status ('ACTIVE', 'SUSPENDED', 'ARCHIVED') is required." } },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "A detailed administrative reason (at least 5 characters) is required." } },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
    const userAgent = req.headers.get("user-agent");

    const tenantService = new PlatformTenantService(getDb());
    await tenantService.updateTenantStatus({
      tenantId,
      newStatus: status,
      reason: reason.trim(),
      actorId: admin.userId,
      actorRole: admin.role,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: { success: true, status } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
