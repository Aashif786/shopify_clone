import { NextResponse } from "next/server";
import type { Database } from "@shopify-clone/db";
import { getDb } from "@/lib/db";
import {
  PaymentWebhookService,
  WebhookPayloadValidationError,
  WebhookSignatureVerificationError,
  RAZORPAY_WEBHOOK_EVENT_ID_HEADER,
  RAZORPAY_WEBHOOK_SIGNATURE_HEADER,
} from "@shopify-clone/payments";

export interface HandleRazorpayWebhookOptions {
  webhookService?: PaymentWebhookService;
  webhookSecret?: string;
  db?: Database;
}

/**
 * Handles incoming Razorpay webhook requests.
 *
 * Requirements:
 * 1. Reads the request body exactly once as raw text/bytes before any JSON parsing.
 * 2. Authenticates strictly via HMAC signature (no storefront/admin tenant auth).
 * 3. Returns HTTP 200 {"received": true} for valid processed events.
 * 4. Returns HTTP 200 {"received": true, "duplicate": true} for verified duplicates.
 * 5. Returns HTTP 400 for missing/invalid signatures or malformed JSON.
 * 6. Returns HTTP 500 for transient processing failures to trigger provider retry.
 * 7. Never leaks credentials, stack traces, or sensitive internals.
 */
export async function handleRazorpayWebhook(
  req: Request,
  options?: HandleRazorpayWebhookOptions,
): Promise<Response> {
  const signature =
    req.headers.get(RAZORPAY_WEBHOOK_SIGNATURE_HEADER) ??
    req.headers.get("X-Razorpay-Signature");

  if (!signature || !signature.trim()) {
    return NextResponse.json(
      { error: "Missing webhook signature" },
      { status: 400 },
    );
  }

  const headerEventId =
    req.headers.get(RAZORPAY_WEBHOOK_EVENT_ID_HEADER) ??
    req.headers.get("X-Razorpay-Event-Id");

  // Read raw body bytes exactly once for cryptographic verification
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to read request body" },
      { status: 400 },
    );
  }

  if (!rawBody || !rawBody.trim()) {
    return NextResponse.json(
      { error: "Empty request body" },
      { status: 400 },
    );
  }

  const db = options?.db ?? getDb();
  const webhookSecret = options?.webhookSecret ?? process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret || !webhookSecret.trim()) {
    return NextResponse.json(
      { error: "Payment webhook secret is not configured" },
      { status: 500 },
    );
  }

  const lowerWebhookSecret = webhookSecret.toLowerCase();
  if (
    lowerWebhookSecret.includes("placeholder") ||
    lowerWebhookSecret.includes("<") ||
    lowerWebhookSecret.includes("example")
  ) {
    return NextResponse.json(
      { error: "Payment webhook secret is not properly configured. Placeholder credentials cannot be used." },
      { status: 500 },
    );
  }

  const webhookService = options?.webhookService ?? new PaymentWebhookService(webhookSecret);

  try {
    const outcome = await webhookService.processWebhook(db, {
      rawBody,
      signature: signature.trim(),
      headerEventId: headerEventId ? headerEventId.trim() : null,
      webhookSecret,
    });

    if (outcome.duplicate) {
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { received: true },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof WebhookSignatureVerificationError ||
      error instanceof WebhookPayloadValidationError
    ) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 },
      );
    }

    // Return HTTP 500 so Razorpay retries transient failures
    return NextResponse.json(
      { error: "Webhook processing failure" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handleRazorpayWebhook(req);
}
