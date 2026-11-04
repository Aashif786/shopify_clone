import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformAuditService } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("audit:read");

    const searchParams = req.nextUrl.searchParams;
    const actorId = searchParams.get("actorId") || undefined;
    const action = searchParams.get("action") || undefined;
    const resourceType = searchParams.get("resourceType") || undefined;
    const tenantId = searchParams.get("tenantId") || undefined;
    const storeId = searchParams.get("storeId") || undefined;
    const status = (searchParams.get("status") as "SUCCESS" | "FAILURE") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const auditService = new PlatformAuditService(getDb());
    const data = await auditService.list({
      actorId,
      action,
      resourceType,
      tenantId,
      storeId,
      status,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
