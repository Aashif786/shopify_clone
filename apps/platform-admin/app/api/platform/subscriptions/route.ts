import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformGovernanceService } from "@calcart/platform-admin";

export async function GET() {
  try {
    await requirePlatformAdmin("subscriptions:read");

    const governanceService = new PlatformGovernanceService(getDb());
    const data = await governanceService.getSubscriptionsOverview();

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
