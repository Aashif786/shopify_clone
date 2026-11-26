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

interface RouteContext {
  params: Promise<{ typeId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requirePlatformAdmin("stores:read");
    const { typeId } = await params;
    const data = await getStoreTypeService().getStoreType(getDb(), typeId);
    return NextResponse.json({ data });
  } catch (error) {
    return formatStoreTypeError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requirePlatformAdmin("stores:write");
    const { typeId } = await params;
    const body = await parseJsonBody(req);
    const reason = readReason(body);
    if (!reason) return reasonRequiredResponse();

    const updated = await getStoreTypeService().updateStoreType(getDb(), typeId, {
      ...(typeof body.key === "string" ? { key: body.key } : {}),
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(body.description === null || typeof body.description === "string"
        ? { description: body.description as string | null }
        : {}),
      ...(typeof body.isFashion === "boolean" ? { isFashion: body.isFashion } : {}),
    });

    await recordStoreTypeAudit({
      req,
      admin,
      action: "store_type.updated",
      resourceId: typeId,
      reason,
      details: { key: updated.key, isFashion: updated.isFashion },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return formatStoreTypeError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requirePlatformAdmin("stores:write");
    const { typeId } = await params;
    const body = await parseJsonBody(req);
    const reason = readReason(body);
    if (!reason) return reasonRequiredResponse();

    const result = await getStoreTypeService().deleteStoreType(getDb(), typeId, {
      reassignToId: typeof body.reassignToId === "string" ? body.reassignToId : undefined,
    });

    await recordStoreTypeAudit({
      req,
      admin,
      action: "store_type.deleted",
      resourceId: typeId,
      reason,
      details: { reassignedStores: result.reassignedStores },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return formatStoreTypeError(error);
  }
}
