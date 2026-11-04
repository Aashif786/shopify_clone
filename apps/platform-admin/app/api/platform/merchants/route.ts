import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformStoreMerchantService } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("merchants:read");

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const storeService = new PlatformStoreMerchantService(getDb());
    const data = await storeService.listMerchants({ search, status, limit, offset });

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePlatformAdmin("merchants:write");
    const body = await req.json();
    const { userId, reason, action } = body;

    if (!userId || !reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "User ID and an administrative reason (at least 5 characters) are required." } },
        { status: 400 }
      );
    }

    const storeService = new PlatformStoreMerchantService(getDb());

    if (action === "revoke_sessions") {
      const result = await storeService.revokeMerchantSessions({
        userId,
        reason: reason.trim(),
        actorId: admin.userId,
        actorRole: admin.role,
      });

      return NextResponse.json({ data: { success: true, revokedCount: result.revokedCount } });
    }

    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Supported actions: 'revoke_sessions'" } },
      { status: 400 }
    );
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
