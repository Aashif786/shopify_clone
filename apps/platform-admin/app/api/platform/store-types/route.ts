import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import {
  formatStoreTypeError,
  getStoreTypeService,
  parseJsonBody,
  readReason,
  reasonRequiredResponse,
  recordStoreTypeAudit,
} from "@/lib/store-type-route";

export async function GET() {
  try {
    await requirePlatformAdmin("stores:read");
    const items = await getStoreTypeService().listStoreTypes(getDb());
    return NextResponse.json({ data: { items } });
  } catch (error) {
    return formatStoreTypeError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePlatformAdmin("stores:write");
    const body = await parseJsonBody(req);
    const reason = readReason(body);
    if (!reason) return reasonRequiredResponse();

    const created = await getStoreTypeService().createStoreType(getDb(), {
      key: String(body.key ?? ""),
      name: String(body.name ?? ""),
      description: typeof body.description === "string" ? body.description : null,
      isFashion: body.isFashion === true,
    });

    await recordStoreTypeAudit({
      req,
      admin,
      action: "store_type.created",
      resourceId: created.id,
      reason,
      details: { key: created.key, isFashion: created.isFashion },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return formatStoreTypeError(error);
  }
}
