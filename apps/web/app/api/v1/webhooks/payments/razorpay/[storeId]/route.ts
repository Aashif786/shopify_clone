import { NextResponse } from "next/server";
import { validateUuid } from "@/lib/api";
import { handleRazorpayWebhook, type HandleRazorpayWebhookOptions } from "../handler";

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function POST(
  req: Request,
  context: RouteContext,
  options?: Omit<HandleRazorpayWebhookOptions, "storeId">,
) {
  try {
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    return await handleRazorpayWebhook(req, { ...options, storeId });
  } catch (error) {
    if (
      (error as { statusCode?: number })?.statusCode === 400 ||
      (error as { status?: number })?.status === 400 ||
      (error as Error).message?.includes("must be a valid UUID")
    ) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Webhook processing failure" },
      { status: 500 },
    );
  }
}
