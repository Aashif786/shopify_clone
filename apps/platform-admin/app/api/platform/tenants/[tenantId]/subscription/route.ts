import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformGovernanceService } from "@calcart/platform-admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await requirePlatformAdmin("subscriptions:write");
    const { tenantId } = await params;
    const body = await req.json();
    const { planCode, reason } = body;

    if (!planCode) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Plan code is required." } },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "An administrative reason is required." } },
        { status: 400 }
      );
    }

    const governanceService = new PlatformGovernanceService(getDb());
    await governanceService.updateTenantSubscription({
      tenantId,
      planCode,
      reason: reason.trim(),
      actorId: admin.userId,
      actorRole: admin.role,
    });

    return NextResponse.json({ data: { success: true, planCode } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
