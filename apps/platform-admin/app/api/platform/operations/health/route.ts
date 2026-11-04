import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformSystemHealthService } from "@calcart/platform-admin";

export async function GET() {
  try {
    await requirePlatformAdmin("operations:read");

    const healthService = new PlatformSystemHealthService(getDb());
    const data = await healthService.getHealthAndIncidents();

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
