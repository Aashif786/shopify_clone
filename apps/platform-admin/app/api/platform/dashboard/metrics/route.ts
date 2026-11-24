import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { parseIntParam } from "@/lib/query-params";
import { PlatformDashboardMetricsService } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("dashboard:read");

    const searchParams = req.nextUrl.searchParams;
    const periodDays = parseIntParam(searchParams.get("days"), 30, 1, 365);

    const metricsService = new PlatformDashboardMetricsService(getDb());
    const data = await metricsService.getOverviewMetrics({ periodDays });

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
