import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";
import { PlatformPaymentsFinancialService } from "@calcart/platform-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    await requirePlatformAdmin("payments:read");
    const { paymentId } = await params;

    const paymentService = new PlatformPaymentsFinancialService(getDb());
    const data = await paymentService.getPaymentDetail(paymentId);

    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Payment transaction not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const admin = await requirePlatformAdmin("payments:reconcile");
    const { paymentId } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "A detailed reconciliation reason (at least 5 characters) is required." } },
        { status: 400 }
      );
    }

    const paymentService = new PlatformPaymentsFinancialService(getDb());
    await paymentService.markReconciliationNote({
      paymentId,
      reason: reason.trim(),
      actorId: admin.userId,
      actorRole: admin.role,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
