import { NextResponse } from "next/server";
import type { Database } from "@calcart/db";
import { getDb } from "@/lib/db";
import {
  PaymentWebhookService,
  PURCHASE_WORKFLOW_BLOCKED_PREFIX,
  StorePaymentGatewayService,
  WebhookPayloadValidationError,
  WebhookSignatureVerificationError,
  RAZORPAY_WEBHOOK_EVENT_ID_HEADER,
  RAZORPAY_WEBHOOK_SIGNATURE_HEADER,
} from "@calcart/payments";

export interface HandleRazorpayWebhookOptions {
  webhookService?: PaymentWebhookService;
  webhookSecret?: string;
  db?: Database;
  storeId?: string;
}

/**
 * Inspects unverified request body ONLY to select the candidate secret for HMAC verification.
 * Never trust unverified payload data for any database mutation.
 */
async function resolveCandidateStoreWebhookSecret(
  db: Database,
  rawBody: string,
  explicitStoreId?: string,
): Promise<{ candidateSecret?: string; storeId?: string }> {
  let candidateStoreId: string | undefined = explicitStoreId;

  if (!candidateStoreId) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      const payloadObj = parsed?.payload as Record<string, unknown> | undefined;
      const paymentObj = payloadObj?.payment as Record<string, unknown> | undefined;
      const paymentEntity = paymentObj?.entity as Record<string, unknown> | undefined;
      const paymentNotes = paymentEntity?.notes as Record<string, unknown> | undefined;

      const orderObj = payloadObj?.order as Record<string, unknown> | undefined;
      const orderEntity = orderObj?.entity as Record<string, unknown> | undefined;
      const orderNotes = orderEntity?.notes as Record<string, unknown> | undefined;

      const rootNotes = parsed?.notes as Record<string, unknown> | undefined;

      const storeIdFromNotes =
        (typeof paymentNotes?.store_id === "string" ? paymentNotes.store_id : null) ||
        (typeof orderNotes?.store_id === "string" ? orderNotes.store_id : null) ||
        (typeof rootNotes?.store_id === "string" ? rootNotes.store_id : null);

      if (
        storeIdFromNotes &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          storeIdFromNotes.trim(),
        )
      ) {
        candidateStoreId = storeIdFromNotes.trim();
      } else {
        const providerOrderId =
          (typeof paymentEntity?.order_id === "string" ? paymentEntity.order_id : null) ||
          (typeof orderEntity?.id === "string" ? orderEntity.id : null);
        const providerPaymentId =
          typeof paymentEntity?.id === "string" ? paymentEntity.id : null;

        if (providerOrderId || providerPaymentId) {
          const attemptRes = await db.query<{ store_id: string }>(
            `SELECT store_id FROM payment_attempts
             WHERE (provider_order_id = $1 AND $1 IS NOT NULL)
                OR (provider_payment_id = $2 AND $2 IS NOT NULL)
             LIMIT 1`,
            [providerOrderId, providerPaymentId],
          );
          if (attemptRes.rows[0]?.store_id) {
            candidateStoreId = attemptRes.rows[0].store_id;
          }
        }
      }
    } catch {
      // JSON parse error or malformed payload - will fail downstream in signature check / parsing
    }
  }

  if (candidateStoreId) {
    const gatewayService = new StorePaymentGatewayService();
    const storeGateway = await gatewayService.getRawStoreRazorpayRow(db, candidateStoreId);
    if (storeGateway && storeGateway.is_enabled && storeGateway.webhook_secret?.trim()) {
      const trimmedSecret = storeGateway.webhook_secret.trim();
      const lower = trimmedSecret.toLowerCase();
      if (!lower.includes("placeholder") && !lower.includes("<") && !lower.includes("example")) {
        return { candidateSecret: trimmedSecret, storeId: candidateStoreId };
      }
    }
    return { storeId: candidateStoreId };
  }

  return {};
}

/**
 * Handles incoming Razorpay webhook requests.
 *
 * Requirements:
 * 1. Reads the request body exactly once as raw text/bytes before any JSON parsing.
 * 2. Authenticates strictly via HMAC signature (supporting per-store secret with global fallback).
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

  let webhookSecret = options?.webhookSecret;
  if (!webhookSecret) {
    const { candidateSecret } = await resolveCandidateStoreWebhookSecret(
      db,
      rawBody,
      options?.storeId,
    );
    if (candidateSecret) {
      webhookSecret = candidateSecret;
    } else {
      webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    }
  }

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

    if (
      outcome.status === "RECONCILIATION_REQUIRED" &&
      outcome.requiresReconciliation &&
      outcome.message?.startsWith(PURCHASE_WORKFLOW_BLOCKED_PREFIX)
    ) {
      return NextResponse.json(
        { received: true, reconciliation: true },
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
