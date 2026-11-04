import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformPaymentsFinancialService } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("payments:read");

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const storeId = searchParams.get("storeId") || undefined;
    const status = searchParams.get("status") || undefined;
    const isOrphaned = searchParams.get("orphaned") === "true";
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const paymentService = new PlatformPaymentsFinancialService(getDb());
    const data = await paymentService.listPayments({ search, storeId, status, isOrphaned, limit, offset });

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
