import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformStoreMerchantService } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("stores:read");

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const organizationId = searchParams.get("organizationId") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const storeService = new PlatformStoreMerchantService(getDb());
    const data = await storeService.listStores({ search, organizationId, status, limit, offset });

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
