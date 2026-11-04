import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformSecurityService, type SecuritySeverity } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("security:read");

    const searchParams = req.nextUrl.searchParams;
    const eventType = searchParams.get("type") || undefined;
    const severity = (searchParams.get("severity") as SecuritySeverity) || undefined;
    const userId = searchParams.get("userId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const securityService = new PlatformSecurityService(getDb());
    const data = await securityService.list({ eventType, severity, userId, limit, offset });

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
