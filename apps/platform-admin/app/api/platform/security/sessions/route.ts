import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformAuthService } from "@calcart/platform-admin";

export async function GET() {
  try {
    await requirePlatformAdmin("security:read");

    const authService = new PlatformAuthService(getDb());
    const items = await authService.listActiveSessions();

    return NextResponse.json({ data: { items } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requirePlatformAdmin("security:write");
    const body = await req.json();
    const { sessionId, reason } = body;

    if (!sessionId || !reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Session ID and an administrative reason (at least 5 characters) are required." } },
        { status: 400 }
      );
    }

    const authService = new PlatformAuthService(getDb());
    await authService.revokeSession(sessionId, admin.userId, admin.role, reason.trim());

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
