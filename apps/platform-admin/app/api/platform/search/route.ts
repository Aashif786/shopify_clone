import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformGlobalSearchService } from "@calcart/platform-admin";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin("dashboard:read");

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    const searchService = new PlatformGlobalSearchService(getDb());
    const items = await searchService.search(query);

    return NextResponse.json({ data: { items } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
