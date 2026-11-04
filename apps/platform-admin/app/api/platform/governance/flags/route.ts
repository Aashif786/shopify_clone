import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformGovernanceService } from "@calcart/platform-admin";

export async function GET() {
  try {
    await requirePlatformAdmin("flags:read");

    const governanceService = new PlatformGovernanceService(getDb());
    const items = await governanceService.listFeatureFlags();

    return NextResponse.json({ data: { items } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requirePlatformAdmin("flags:write");
    const body = await req.json();
    const { key, enabled, rolloutPercentage, reason } = body;

    if (!key || enabled === undefined || !reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Key, enabled status, and an administrative reason (at least 5 characters) are required." } },
        { status: 400 }
      );
    }

    const governanceService = new PlatformGovernanceService(getDb());
    await governanceService.updateFeatureFlag({
      key,
      enabled,
      rolloutPercentage,
      reason: reason.trim(),
      actorId: admin.userId,
      actorRole: admin.role,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
