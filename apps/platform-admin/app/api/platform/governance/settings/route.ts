import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformGovernanceService } from "@calcart/platform-admin";

export async function GET() {
  try {
    await requirePlatformAdmin("settings:read");

    const governanceService = new PlatformGovernanceService(getDb());
    const settings = await governanceService.getSystemSettings();

    return NextResponse.json({ data: { settings } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
