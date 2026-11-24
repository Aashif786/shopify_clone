import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { parseIntParam } from "@/lib/query-params";
import { PlatformTenantService } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("tenants:read");

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const planCode = searchParams.get("plan") || undefined;
    const limit = parseIntParam(searchParams.get("limit"), 25, 1, 100);
    const offset = parseIntParam(searchParams.get("offset"), 0, 0);

    const tenantService = new PlatformTenantService(getDb());
    const data = await tenantService.listTenants({ search, status, planCode, limit, offset });

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
