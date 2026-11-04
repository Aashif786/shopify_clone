import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformStoreMerchantService } from "@calcart/platform-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    await requirePlatformAdmin("stores:read");
    const { storeId } = await params;

    const storeService = new PlatformStoreMerchantService(getDb());
    const data = await storeService.getStoreDetail(storeId);

    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Store not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
